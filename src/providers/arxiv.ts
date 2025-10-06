import {DOMParser} from "xmldom";
import { Paper } from "../types/paper.js";
import path from "path/win32";
import fs from "fs";
import { PdfReader } from "pdfreader";
import { PaperSource } from "../paper-source.js";

export class ArxivSearcher implements PaperSource {
    BASE_URL: string;
    constructor() {
        this.BASE_URL = "http://export.arxiv.org/api/query";
    }

    async search(query: string, max_results: number = 10): Promise<Paper[]> {
        const params = new URLSearchParams({
            search_query: `all:${query}`,
            max_results: max_results.toString(),
            sortBy: "submittedDate",
            sortOrder: "descending",
        });

        const response = await fetch(`${this.BASE_URL}?${params.toString()}`);
        const text = await response.text();

        // Use a lightweight XML parser since arXiv returns Atom XML
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "application/xml");
        const entries = Array.from(xml.getElementsByTagName("entry"));
        const papers: Paper[] = [];

        for (const entry of entries) {
            try {
                const getText = (tag: string) =>
                    entry.getElementsByTagName(tag)[0]?.textContent || "";

                const authors = Array.from(entry.getElementsByTagName("author")).map(
                    (author) => author.getElementsByTagName("name")[0]?.textContent || ""
                );

                const published = new Date(getText("published"));
                const updated = new Date(getText("updated"));

                const links = Array.from(entry.getElementsByTagName("link"));
                const pdf_url =
                    links.find((link: Element) => link.getAttribute("type") === "application/pdf")
                        ?.getAttribute("href") || "";

                const categories = Array.from(entry.getElementsByTagName("category")).map(
                    (cat) => cat.getAttribute("term") || ""
                );

                const doi = getText("arxiv:doi");

                papers.push({
                    paper_id: getText("id").split("/").pop() || "",
                    title: getText("title"),
                    authors,
                    abstract: getText("summary"),
                    url: getText("id"),
                    pdf_url,
                    published_date: published,
                    updated_date: updated,
                    source: "arxiv",
                    categories,
                    keywords: [],
                    doi,
                });
            } catch (e) {
                console.error(`Error parsing arXiv entry: ${e}`);
            }
        }
        return papers;
    }

    async downloadPDF(paperId: string, savePath: string): Promise<string> {
        const pdfURL = `http://arxiv.org/pdf/${paperId}.pdf`;
        const response = await fetch(pdfURL);
        if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const outputFile = path.join(savePath, `${paperId}.pdf`);
        fs.writeFileSync(outputFile, Buffer.from(arrayBuffer));
        return outputFile;
    }

    async readPaper(paperId: string, savePath: string = "./downloads"): Promise<string> {
        const pdfPath = path.join(savePath, `${paperId}.pdf`);
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