import fs from "fs";
import path from "path";
import { PaperSource } from "../paper-source.js";
import { PdfReader } from "pdfreader";
import { Paper } from "../types/paper.js";

export class BiorxivSearcher implements PaperSource {
  BASE_URL: string;
  timeout = 100000;
  maxRetries = 3;

  constructor(baseUrl?: string) {
    this.BASE_URL = baseUrl || "https://api.biorxiv.org/details/biorxiv";
  }

  async search(query: string, max_results: number = 10, days: number = 30): Promise<Paper[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const end_date = endDate.toISOString().slice(0, 10);
    const start_date = startDate.toISOString().slice(0, 10);

    const category = query.toLowerCase().replace(/ /g, "_");
    const papers: Paper[] = [];
    let cursor = 0;

    while (papers.length < max_results) {
      let url = `${this.BASE_URL}/${start_date}/${end_date}/${cursor}`;
      if (category) url += `?category=${category}`;
      let tries = 0;
      while (tries < this.maxRetries) {
        try {
          
          const response = await fetch(url, { signal: AbortSignal.timeout(this.timeout) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          const collection = data.collection || [];
          for (const item of collection) {
            try {
              const date = new Date(item.date);
              papers.push({
                paper_id: item.doi,
                title: item.title,
                authors: item.authors.split("; "),
                abstract: item.abstract,
                url: `https://www.biorxiv.org/content/${item.doi}v${
                  item.version || "1"
                }`,
                pdf_url: `https://www.biorxiv.org/content/${item.doi}v${
                  item.version || "1"
                }.full.pdf`,
                published_date: date,
                updated_date: date,
                source: "biorxiv",
                categories: [item.category],
                keywords: [],
                doi: item.doi,
              } as Paper);
            } catch (e) {
              console.error(`Error processing item: ${e}`);
            }
          }
          if (collection.length < 100) break;
          cursor += 100;
          break;
        } catch (e) {
          tries += 1;
          if (tries === this.maxRetries) {
            console.error(`Max retries reached for ${url}`);
            break;
          }
        }
      }
      break;
    }
    return papers.slice(0, max_results);
  }

  async downloadPDF(paperId: string, savePath: string): Promise<string> {
    if (!paperId) throw new Error("Invalid paperId: paperId is empty");
    const pdfUrl = `https://www.biorxiv.org/content/${paperId}v1.full.pdf`;
    let tries = 0;
    while (tries < this.maxRetries) {
      try {
        const headers = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        };
        const response = await fetch(pdfUrl, { headers, signal: AbortSignal.timeout(this.timeout) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!fs.existsSync(savePath))
          fs.mkdirSync(savePath, { recursive: true });
        const outputFile = path.join(
          savePath,
          `${paperId.replace(/\//g, "_")}.pdf`
        );
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(outputFile, buffer);
        return outputFile;
      } catch (e) {
        tries += 1;
        if (tries === this.maxRetries) {
          throw new Error(
            `Failed to download PDF after ${this.maxRetries} attempts: ${e}`
          );
        }
      }
    }
    throw new Error("Failed to download PDF");
  }

  async readPaper(paperId: string, savePath: string = "./downloads"): Promise<string> {
        let pdfPath = path.join(savePath, `${paperId.replace(/\//g, "_")}.pdf`);
        if (!fs.existsSync(pdfPath)) {
            pdfPath = await this.downloadPDF(paperId, savePath);
        }
        let rows: Record<string, string[]> = {};

        function flushRows(): string {
            return Object.keys(rows)
                .sort((y1, y2) => parseFloat(y1) - parseFloat(y2))
                .map((y) => (rows[y] || []).join(""))
                .join("\n");
        }

        return new Promise((resolve, reject) => {
            new PdfReader().parseFileItems(pdfPath, (err, item: any) => {
                if (err) {
                    console.error({ err });
                    reject(err);
                } else if (!item) {
                    // End of file
                    const text = flushRows();
                    resolve(text);
                } else if (item.page) {
                    // New page, flush rows (optional: add page breaks)
                    // flushRows(); // Not needed unless you want per-page text
                } else if (item.text) {
                    (rows[item.y] = rows[item.y] || []).push(item.text);
                }
            });
        });
  }
}