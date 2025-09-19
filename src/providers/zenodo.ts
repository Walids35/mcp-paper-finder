import { PaperSource } from "../paper-source.js";
import { Paper } from "../types/paper.js";
import fs from "fs";
import path from "path";

type ZenodoRecord = Record<string, any>;
type ZenodoFile = Record<string, any>;

function isPdfFile(f: ZenodoFile): boolean {
  const key = (f?.key || "").toLowerCase();
  return (
    key.endsWith(".pdf") ||
    f?.type === "pdf" ||
    f?.mimetype === "application/pdf"
  );
}

export class ZenodoSearcher implements PaperSource {
  BASE_URL: string;
  API_TOKEN: string;
  headers: Record<string, string>;

  constructor() {
    this.BASE_URL = "https://zenodo.org";
    this.API_TOKEN = process.env.ZENODO_API_TOKEN || "";
    this.headers = this.setupHeaders();
  }

  private setupHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; ZenodoSearcher/1.0)",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (this.API_TOKEN) {
      headers["Authorization"] = `Bearer ${this.API_TOKEN}`;
    }
    return headers;
  }

  private selectPdfFile(rec: ZenodoRecord): ZenodoFile | null {
    const files = rec.files || [];
    if (!Array.isArray(files)) return null;
    const pdfs = files.filter(isPdfFile);
    return pdfs.length > 0 ? pdfs[0] : null;
  }

  private recordToPaper(rec: ZenodoRecord): Paper | null {
    try {
      const metadata = rec.metadata || {};
      const title = metadata.title || "";
      const creators = metadata.creators || [];
      const authors = creators
        .map((c: any) => (typeof c === "object" && c.name ? c.name : null))
        .filter(Boolean);
      const description = metadata.description || "";

      // Publication date logic
      let publication_date_raw: string | undefined = metadata.publication_date;
      if (!publication_date_raw) {
        const dates_field = metadata.dates;
        if (Array.isArray(dates_field)) {
          let preferred: string | undefined;
          for (const d of dates_field) {
            if (typeof d === "object" && d.date) {
              if (
                ["issued", "published", "publication"].includes(
                  String(d.type || "").toLowerCase()
                )
              ) {
                preferred = d.date;
                break;
              }
              if (!preferred) preferred = d.date;
            }
          }
          publication_date_raw = preferred;
        }
      }
      if (!publication_date_raw) {
        publication_date_raw = rec.updated || rec.created;
      }

      const published_date = this.parseDate(publication_date_raw);
      const doi = rec.doi || metadata.doi || "";
      const links = rec.links || {};
      const url = links.html || links.latest_html || "";

      let pdf_url = "";
      const selected_file = this.selectPdfFile(rec);
      if (selected_file) {
        const file_links = selected_file.links || {};
        pdf_url = file_links.download || file_links.self || "";
      }

      let keywords = metadata.keywords || [];
      if (typeof keywords === "string") keywords = [keywords];

      const categories: string[] = [];
      try {
        const resource_type = metadata.resource_type || {};
        if (typeof resource_type === "object" && resource_type.type) {
          categories.push(resource_type.type);
        }
      } catch {}

      const paper_id =
        rec.id !== undefined ? String(rec.id) : doi || url || title;

      const extra = {
        conceptdoi: rec.conceptdoi,
        resource_type: metadata.resource_type,
        communities: metadata.communities,
      };

      return {
        paper_id,
        title,
        authors,
        abstract: description,
        url,
        pdf_url,
        published_date: published_date || undefined,
        updated_date: this.parseDate(rec.updated) || undefined,
        source: "zenodo",
        categories,
        keywords,
        doi,
        citations: 0,
        extra,
      } as Paper;
    } catch (e) {
      // Optionally log
      return null;
    }
  }

  private parseDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    try {
      const sIso = s.replace("Z", "+00:00");
      return new Date(sIso);
    } catch {}
    if (s.includes("T")) {
      return new Date(s.split("T")[0]);
    }
    const fmts = [/^\d{4}-\d{2}-\d{2}$/, /^\d{4}-\d{2}$/, /^\d{4}$/];
    for (const fmt of fmts) {
      if (fmt.test(s)) {
        try {
          return new Date(s);
        } catch {}
      }
    }
    return null;
  }

  private yearFilter(year?: string | null): string | null {
    if (!year) return null;
    const y = year.trim();
    if (y.includes("-")) {
      const parts = y.split("-");
      const start = parts[0].trim() || "*";
      const end = parts[1]?.trim() || "*";
      return `metadata.publication_date:[${start} TO ${end}]`;
    }
    return `metadata.publication_date:[${y} TO ${y}]`;
  }

  private buildQuery(options: {
    query?: string;
    community?: string;
    year?: string;
    resource_type?: string;
    subtype?: string;
    creators?: string[];
    keywords?: string[];
  }): string {
    const {
      query,
      community,
      year,
      resource_type,
      subtype,
      creators,
      keywords,
    } = options;
    const parts: string[] = [];
    if (query) parts.push(`(${query})`);
    if (community) parts.push(`communities:${community}`);
    const yf = this.yearFilter(year);
    if (yf) parts.push(yf);
    if (resource_type) parts.push(`resource_type.type:${resource_type}`);
    if (subtype) parts.push(`resource_type.subtype:${subtype}`);
    if (creators && creators.length) {
      const names = creators.map((c) => `"${c}"`).join(" OR ");
      if (names) parts.push(`creators.name:(${names})`);
    }
    if (keywords && keywords.length) {
      const kws = keywords.map((k) => `"${k}"`).join(" OR ");
      if (kws) parts.push(`keywords:(${kws})`);
    }
    return parts.length ? parts.join(" AND ") : "*";
  }

  async search(
    query: string = "",
    max_results: number = 10,
    options: {
      community?: string;
      year?: string;
      resource_type?: string;
      subtype?: string;
      creators?: string[];
      keywords?: string[];
      sort?: string;
      order?: string;
    } = {}
  ): Promise<Paper[]> {
    const papers: Paper[] = [];
    let page = 1;
    const page_size = Math.min(max_results, 100);
    try {
      const q = this.buildQuery({
        query,
        community: options.community,
        year: options.year,
        resource_type: options.resource_type,
        subtype: options.subtype,
        creators: options.creators,
        keywords: options.keywords,
      });
      while (papers.length < max_results) {
        const params: Record<string, any> = {
          q,
          page,
          size: page_size,
        };
        if (options.sort) params["sort"] = options.sort;
        if (options.order) params["order"] = options.order;
        const url = `${this.BASE_URL}/api/records`;
        const resp = await fetch(`${url}?${new URLSearchParams(params)}`, {
          headers: this.headers,
        });
        if (!resp.ok) break;
        const data = await resp.json();
        const hits = (data.hits || {}).hits || [];
        if (!hits.length) break;
        for (const rec of hits) {
          if (papers.length >= max_results) break;
          const paper = this.recordToPaper(rec);
          if (paper) papers.push(paper);
        }
        page += 1;
      }
    } catch (e) {
      // Optionally log
    }
    return papers.slice(0, max_results);
  }

  private async getRecord(paper_id: string): Promise<ZenodoRecord | null> {
    try {
      let id = paper_id;
      if (id.startsWith("http")) {
        for (const part of id.split("/")) {
          if (/^\d+$/.test(part)) {
            id = part;
            break;
          }
        }
      }
      const url = `${this.BASE_URL}/api/records/${id}`;
      const resp = await fetch(url, { headers: this.headers });
      if (resp.ok) {
        return await resp.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  async downloadPDF(
    paper_id: string,
    save_path: string = "./downloads"
  ): Promise<string> {
    try {
      const rec = await this.getRecord(paper_id);
      if (!rec) return `Error: Could not fetch Zenodo record ${paper_id}`;
      const file_entry = this.selectPdfFile(rec);
      if (!file_entry) return "Error: No PDF file available for this record";
      const links = file_entry.links || {};
      const download_url = links.download || links.self;
      if (!download_url)
        return "Error: No downloadable link for the selected file";
      if (!fs.existsSync(save_path))
        fs.mkdirSync(save_path, { recursive: true });
      let filename = file_entry.key || `zenodo_${rec.id || "file"}.pdf`;
      if (!filename.toLowerCase().endsWith(".pdf")) filename += ".pdf";
      const outfile = path.join(
        save_path,
        `zenodo_${String(rec.id)}_${path.basename(filename)}`
      );
      const response = await fetch(download_url, { headers: this.headers });
      if (!response.ok) return `Error downloading PDF: ${response.statusText}`;
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outfile, buffer);
      return outfile;
    } catch (e: any) {
      return `Error downloading PDF: ${e}`;
    }
  }

  async readPaper(
    paper_id: string,
    save_path: string = "./downloads"
  ): Promise<string> {
    try {
      const pdf_path = await this.downloadPDF(paper_id, save_path);
      if (!fs.existsSync(pdf_path)) return pdf_path;
      // You need to implement PDF text extraction here, e.g. using pdfreader or pdf-parse
      // Placeholder:
      return `PDF downloaded to ${pdf_path}, but text extraction is not implemented.`;
    } catch (e: any) {
      return `Error reading paper: ${e}`;
    }
  }

  async searchCommunities(
    query: string = "",
    max_results: number = 20,
    options: { sort?: string; order?: string } = {}
  ): Promise<any[]> {
    const results: any[] = [];
    let page = 1;
    const page_size = Math.min(max_results, 100);
    try {
      while (results.length < max_results) {
        const params: Record<string, any> = {
          q: query || "*",
          page,
          size: page_size,
        };
        if (options.sort) params["sort"] = options.sort;
        if (options.order) params["order"] = options.order;
        const url = `${this.BASE_URL}/api/communities`;
        const resp = await fetch(`${url}?${new URLSearchParams(params)}`, {
          headers: this.headers,
        });
        if (!resp.ok) break;
        const data = await resp.json();
        const hits = (data.hits || {}).hits || [];
        if (!hits.length) break;
        for (const com of hits) {
          if (results.length >= max_results) break;
          results.push({
            id: com.id,
            slug: com.slug,
            title:
              com.title ||
              (typeof com.metadata === "object"
                ? com.metadata.title
                : undefined),
            description:
              com.description ||
              (typeof com.metadata === "object"
                ? com.metadata.description
                : undefined),
            created: com.created,
            updated: com.updated,
            links: com.links || {},
          });
        }
        page += 1;
      }
    } catch (e) {
      // Optionally log
    }
    return results.slice(0, max_results);
  }

  async getRecordDetails(paper_id: string): Promise<ZenodoRecord | null> {
    return this.getRecord(paper_id);
  }

  async listFiles(paper_id: string): Promise<any[]> {
    const files_info: any[] = [];
    try {
      const rec = await this.getRecord(paper_id);
      if (!rec) return files_info;
      const files = rec.files || [];
      if (!Array.isArray(files)) return files_info;
      for (const f of files) {
        const links = f.links || {};
        files_info.push({
          key: f.key,
          size: f.size,
          checksum: f.checksum,
          type: f.type,
          mimetype: f.mimetype,
          download: links.download || links.self,
        });
      }
    } catch (e) {
      // Optionally log
    }
    return files_info;
  }

  async searchByCreator(
    creator: string,
    max_results: number = 10,
    options: {
      community?: string;
      year?: string;
      resource_type?: string;
      subtype?: string;
      sort?: string;
      order?: string;
    } = {}
  ): Promise<Paper[]> {
    try {
      return this.search("", max_results, {
        ...options,
        creators: creator ? [creator] : undefined,
      });
    } catch {
      return [];
    }
  }
}
