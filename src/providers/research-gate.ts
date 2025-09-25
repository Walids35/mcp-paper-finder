import * as cheerio from "cheerio";
import { Paper } from "../types/paper.js";
import { PaperSource } from "../paper-source.js";
import dotenv from 'dotenv';
dotenv.config();

function getRandomBrowser(): string {
  const BROWSERS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
  ];
  return BROWSERS[Math.floor(Math.random() * BROWSERS.length)];
}

export class ResearchGateSearcher implements PaperSource {
  BASE_URL: string;
  constructor() {
    this.BASE_URL = "https://www.researchgate.net";
  }

  private getHeaders(): Record<string, string> {
    return {
      "User-Agent": getRandomBrowser(),
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Host": "www.researchgate.net",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cookie": process.env.RESEARCHGATE_COOKIE || "",
    };
  }

  private abs(url?: string | null): string {
    if (!url) return "";
    try { return new URL(url, this.BASE_URL).toString(); } catch { return url; }
  }

  private async parseVisible($: cheerio.CheerioAPI): Promise<any[]> {
    const items: any[] = [];

    const cards = $(".nova-legacy-v-publication-item").toArray();

    for (const el of cards) {
      const root = $(el);

      // Title + URL
      const a = root.find(".nova-legacy-v-publication-item__title a").first();
      const title = a.text().trim();
      const url = this.abs(a.attr("href"));

      // Abstract (async)
      let abstract: string | undefined;
      try {
        const res = await fetch(url, { headers: this.getHeaders() }); // Node 18+: global fetch
        const html = await res.text();
        await new Promise(resolve => setTimeout(resolve, 1000));
        const v = cheerio.load(html);
        abstract = v(".research-detail-middle-section__abstract").text().trim();
      } catch (err) {
        console.error("Error fetching abstract:", err);
      }

      // Type
      const type =
        root.find(".nova-legacy-v-publication-item__badge").first().text().trim() || undefined;

      // Meta
      const metaSpans = root.find(
        ".nova-legacy-v-publication-item__meta .nova-legacy-e-list__item span"
      );
      let date: string | undefined;
      let doi: string | undefined;
      let isbn: string | undefined;
      let issn: string | undefined;

      metaSpans.each((_, m) => {
        const t = $(m).text().trim();
        if (/^\w{3}\s\d{4}$/.test(t) || /\d{4}/.test(t)) date ??= t;
        if (t.startsWith("DOI:")) doi = t.replace(/^DOI:\s*/, "").trim();
        if (t.startsWith("ISBN:")) isbn = t.replace(/^ISBN:\s*/, "").trim();
        if (t.startsWith("ISSN:")) issn = t.replace(/^ISSN:\s*/, "").trim();
      });

      // Authors (names only)
      const authors: string[] = root
        .find(".nova-legacy-v-publication-item__person-list a.nova-legacy-v-person-inline-item")
        .map((_, aEl) => $(aEl).find(".nova-legacy-v-person-inline-item__fullname").text().trim())
        .get()
        .filter(Boolean);

      const previewImage =
        root.find(".nova-legacy-v-publication-item__preview-image").attr("src") || undefined;

      items.push({ title, abstract, url, type, date, doi, isbn, issn, authors, previewImage });
    }
    return items;
  }

  async search(query: string, page: number) {
    const searchUrl = `${
      this.BASE_URL
    }/search/publication?q=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetch(searchUrl, { headers: this.getHeaders() });
    if(!response.ok) {
      throw new Error(`ResearchGate search failed: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    const $ = cheerio.load(text);

    const results: any[] = [];
    const visibleResults = await this.parseVisible($);
    results.push(...visibleResults);
    return results;
  }

  async downloadPDF(paperId: string, savePath: string): Promise<string> {
    throw new Error("ResearchGate PDF download not implemented.");
  }

  async readPaper(paperId: string, savePath: string): Promise<string> {
    throw new Error("ResearchGate readPaper not implemented.");
  }
}
