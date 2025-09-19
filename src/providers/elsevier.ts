import { PaperSource } from "../paper-source.js";
import { Paper } from "../types/paper.js";
import { DOMParser } from "xmldom";
import dotenv from 'dotenv';
dotenv.config();

export class ElsevierSearcher implements PaperSource {
  BASE_URL: string;
  ARTICLE_URL: string;
  API_KEY: string;
  constructor() {
    this.BASE_URL = "https://api.elsevier.com/content/search/sciencedirect";
    this.ARTICLE_URL = "https://api.elsevier.com/content/article/pii/";
    this.API_KEY =
      process.env.ELSEVIER_API_KEY || "";
  }

  async search(query: string, max_results: number = 10, date: string = "2020"): Promise<Paper[]> {
    try {
      const params = new URLSearchParams({
        query: query,
        apiKey: this.API_KEY,
        count: max_results.toString(),
        date: `${date}-${new Date().getFullYear()}`,
        sort: "relevance",
      });

      const response = await fetch(`${this.BASE_URL}?${params.toString()}`);
      const text = await response.json();
      const papers: Paper[] = [];

      const parser = new DOMParser();

      for (const item of text["search-results"].entry) {
        const article = await fetch(
          `${this.ARTICLE_URL}${item.pii}?apiKey=${this.API_KEY}`
        );
        const articleText = await article.text();
        const xml = parser.parseFromString(articleText, "application/xml");
        const article_details = xml.getElementsByTagName("coredata");
        const getText = (tag: string) =>
          article_details[0].getElementsByTagName(tag)[0]?.textContent || "";

        papers.push({
          paper_id: item["prism:doi"] || item.pii || "",
          title: item["dc:title"] || "",
          authors: getText("dc:creator")
            ? Array.from(article_details[0].getElementsByTagName("dc:creator"))
                .map((el) => el.textContent || "")
                .join(": ")
                .split(": ")
            : [],
          abstract: getText("dc:description") || "",
          url: item["prism:url"] || "",
          pdf_url: `https://doi.org/${item["prism:doi"]}`,
          published_date: new Date(item["prism:coverDate"]),
          updated_date: new Date(item["prism:coverDate"]),
          source: item["prism:publicationName"] || "",
          categories: getText("dcterms:subject")
            ? Array.from(
                article_details[0].getElementsByTagName("dcterms:subject")
              ).map((el) => el.textContent || "")
            : [],
          keywords: getText("dcterms:subject")
            ? Array.from(
                article_details[0].getElementsByTagName("dcterms:subject")
              ).map((el) => el.textContent || "")
            : [],
          doi: item["prism:doi"] || "",
        });
      }
      return papers;
    } catch (error) {
      console.error("Error fetching from Elsevier API:", error);
      return [];
    }
  }

  async downloadPDF(paperId: string, savePath: string): Promise<string> {
    const message = `PDF download not supported for Elsevier papers due to access restrictions. Please access the paper via its DOI link: https://doi.org/${paperId}`;
    return message;
  }

  async readPaper(paperId: string, savePath: string): Promise<string> {
        const message = `PDF reading not supported for Elsevier papers due to access restrictions. Please access the paper via its DOI link: https://doi.org/${paperId}`;
        return message;
  }

}
