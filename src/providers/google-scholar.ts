import * as cheerio from "cheerio";
import { PaperSource } from "../paper-source.js";
import { Paper } from "../types/paper.js";

function getRandomBrowser(): string {
  const BROWSERS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
  ];
  return BROWSERS[Math.floor(Math.random() * BROWSERS.length)];
}

export class GoogleScholarSearcher implements PaperSource {
  SCHOLAR_URL = "https://scholar.google.com/scholar";

  private getHeaders(): Record<string, string> {
    return {
      "User-Agent": getRandomBrowser(),
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9"
    };
  }

  private extractYear(text: string): number | null {
    for (const word of text.split(/\s+/)) {
      const n = parseInt(word, 10);
      const year = new Date().getFullYear();
      if (!isNaN(n) && n >= 1900 && n <= year) {
        return n;
      }
    }
    return null;
  }

  private parsePaper(item: any): Paper | null {
    try {
      const titleElem = item.find("h3.gs_rt");
      const infoElem = item.find("div.gs_a");
      const abstractElem = item.find("div.gs_rs");

      if (!titleElem.length || !infoElem.length) return null;

      let title = titleElem.text().replace("[PDF]", "").replace("[HTML]", "").trim();
      const linkElem = titleElem.find("a");
      const url = linkElem.length ? linkElem.attr("href") || "" : "";

      const infoText = infoElem.text();
      const authors = infoText.split("-")[0].split(",").map((a: any) => a.trim());
      const year = this.extractYear(infoText);

      return {
        paper_id: `gs_${Math.abs(this.hashString(url))}`,
        title,
        authors,
        abstract: abstractElem.text() || "",
        url,
        pdf_url: "",
        published_date: year ? new Date(year, 0, 1) : undefined,
        updated_date:undefined,
        source: "google_scholar",
        categories: [],
        keywords: [],
        doi: "",
        citations: 0,
        extra: {}
      } as Paper;
    } catch (e) {
      return null;
    }
  }

  private hashString(str: string): number {
    // Simple hash for demonstration (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  async search(query: string, max_results: number = 10): Promise<Paper[]> {
    const papers: Paper[] = [];
    let start = 0;
    const resultsPerPage = Math.min(10, max_results);

    while (papers.length < max_results) {
      try {
        const params = new URLSearchParams({
          q: query,
          start: start.toString(),
          hl: "en",
          as_sdt: "0,5"
        });
        // Random delay to mimic human behavior
        await new Promise(res => setTimeout(res, 1000 + Math.random() * 2000));
        const response = await fetch(`${this.SCHOLAR_URL}?${params.toString()}`, {
          headers: this.getHeaders()
        });
        if (!response.ok) break;
        const html = await response.text();
        const $ = cheerio.load(html);
        const results = $("div.gs_ri");
        if (!results.length) break;

        results.each((_, el) => {
          if (papers.length >= max_results) return false;
          const paper = this.parsePaper($(el));
          if (paper) papers.push(paper);
        });

        start += resultsPerPage;
      } catch (e) {
        break;
      }
    }
    return papers.slice(0, max_results);
  }

  async downloadPDF(paperId: string, savePath: string): Promise<string> {
    throw new Error(
      "Google Scholar doesn't provide direct PDF downloads. Please use the paper URL to access the publisher's website."
    );
  }

  async readPaper(paperId: string, savePath: string = "./downloads"): Promise<string> {
    return (
      "Google Scholar doesn't support direct paper reading. " +
      "Please use the paper URL to access the full text on the publisher's website."
    );
  }
}