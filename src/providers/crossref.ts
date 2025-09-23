import { Paper } from "../types/paper.js";
import { PaperSource } from "../paper-source.js";

export class CrossRefSearcher implements PaperSource {
  BASE_URL = "https://api.crossref.org";
  USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

  private getHeaders(): Record<string, string> {
    return {
      "User-Agent": this.USER_AGENT,
      "Accept": "application/json",
    };
  }

  async search(
    query: string,
    max_results: number = 10,
    options: { filter?: string; sort?: string; order?: string } = {}
  ): Promise<Paper[]> {
    try {
      const params: Record<string, string | number> = {
        query,
        rows: Math.min(max_results, 1000),
        sort: options.sort || "relevance",
        order: options.order || "desc",
      };
      if (options.filter) params["filter"] = options.filter;

      const url = `${this.BASE_URL}/works?${new URLSearchParams(params as any)}`;
      let response = await fetch(url, { headers: this.getHeaders(), signal: AbortSignal.timeout(30000) });

      if (response.status === 429) {
        // Rate limited - wait and retry once
        await new Promise((res) => setTimeout(res, 2000));
        response = await fetch(url, { headers: this.getHeaders(), signal: AbortSignal.timeout(30000) });
      }

      if (!response.ok) return [];
      const data = await response.json();
      const items = (data.message && data.message.items) || [];
      const papers: Paper[] = [];
      for (const item of items) {
        const paper = this.parseCrossRefItem(item);
        if (paper) papers.push(paper);
      }
      return papers;
    } catch (e) {
      return [];
    }
  }

  private parseCrossRefItem(item: any): Paper | null {
    try {
      const doi = item.DOI || "";
      const title = this.extractTitle(item);
      const authors = this.extractAuthors(item);
      const abstract = item.abstract || "";
      let published_date =
        this.extractDate(item, "published") ||
        this.extractDate(item, "issued") ||
        this.extractDate(item, "created") ||
        new Date(1970, 0, 1);
      const url = item.URL || (doi ? `https://doi.org/${doi}` : "");
      const pdf_url = this.extractPdfUrl(item);
      const container_title = this.extractContainerTitle(item);
      const publisher = item.publisher || "";
      const categories = [item.type || ""];
      const subjects = item.subject || [];
      const keywords = Array.isArray(subjects) ? subjects : [];

      return {
        paper_id: doi,
        title,
        authors,
        abstract,
        doi,
        published_date,
        updated_date: undefined,
        pdf_url,
        url,
        source: "crossref",
        categories,
        keywords,
        citations: item["is-referenced-by-count"] || 0,
        extra: {
          publisher,
          container_title,
          volume: item.volume || "",
          issue: item.issue || "",
          page: item.page || "",
          issn: item.ISSN || [],
          isbn: item.ISBN || [],
          crossref_type: item.type || "",
          member: item.member || "",
          prefix: item.prefix || "",
        },
      } as Paper;
    } catch (e) {
      return null;
    }
  }

  private extractTitle(item: any): string {
    const titles = item.title || [];
    if (Array.isArray(titles) && titles.length) return titles[0];
    return titles ? String(titles) : "";
  }

  private extractAuthors(item: any): string[] {
    const authors: string[] = [];
    const authorList = item.author || [];
    for (const author of authorList) {
      if (typeof author === "object") {
        const given = author.given || "";
        const family = author.family || "";
        if (given && family) authors.push(`${given} ${family}`);
        else if (family) authors.push(family);
        else if (given) authors.push(given);
      }
    }
    return authors;
  }

  private extractDate(item: any, dateField: string): Date | null {
    const dateInfo = item[dateField] || {};
    if (!dateInfo) return null;
    const dateParts = dateInfo["date-parts"] || [];
    if (!dateParts.length || !dateParts[0]) return null;
    const parts = dateParts[0];
    try {
      const year = parts[0] || 1970;
      const month = parts[1] || 1;
      const day = parts[2] || 1;
      return new Date(year, month - 1, day);
    } catch {
      return null;
    }
  }

  private extractContainerTitle(item: any): string {
    const containerTitles = item["container-title"] || [];
    if (Array.isArray(containerTitles) && containerTitles.length) return containerTitles[0];
    return containerTitles ? String(containerTitles) : "";
  }

  private extractPdfUrl(item: any): string {
    const resource = item.resource || {};
    if (resource && resource.primary && resource.primary.URL && resource.primary.URL.endsWith(".pdf")) {
      return resource.primary.URL;
    }
    const links = item.link || [];
    for (const link of links) {
      if (typeof link === "object") {
        const contentType = link["content-type"] || "";
        if (contentType.toLowerCase().includes("pdf")) {
          return link.URL || "";
        }
      }
    }
    return "";
  }

  async downloadPDF(paperId: string, savePath: string): Promise<string> {
    throw new Error(
      "CrossRef does not provide direct PDF downloads. CrossRef is a citation database that provides metadata about academic papers. To access the full text, please use the paper's DOI or URL to visit the publisher's website."
    );
  }

  async readPaper(paperId: string, savePath: string = "./downloads"): Promise<string> {
    return (
      "CrossRef papers cannot be read directly through this tool. " +
      "CrossRef is a citation database that provides metadata about academic papers. " +
      "Only metadata and abstracts are available through CrossRef's API. " +
      "To access the full text, please use the paper's DOI or URL to visit the publisher's website."
    );
  }

  async getPaperByDoi(doi: string): Promise<Paper | null> {
    try {
      const url = `${this.BASE_URL}/works/${doi}?mailto=paper-search@example.org`;
      const response = await fetch(url, { headers: this.getHeaders(), signal: AbortSignal.timeout(30000) });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) return null;
      const data = await response.json();
      const item = data.message || {};
      return this.parseCrossRefItem(item);
    } catch (e) {
      return null;
    }
  }
}