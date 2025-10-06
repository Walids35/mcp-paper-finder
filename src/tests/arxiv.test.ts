import fs from "fs";
import { ArxivSearcher } from "../providers/arxiv.js";

describe("ArxivSearcher", () => {
    const searcher = new ArxivSearcher();

    it("should search arXiv and return papers", async () => {
        const results = await searcher.search("news sentiment stock prediction deep learning", 10);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty("title");
    });

    it("should download a PDF", async () => {
        const paperId = "2509.11982v1";
        const savePath = "./downloads";
        if (!fs.existsSync(savePath)) fs.mkdirSync(savePath);
        const pdfPath = await searcher.downloadPDF(paperId, savePath);
        expect(fs.existsSync(pdfPath)).toBe(true);
        // Clean up
        fs.unlinkSync(pdfPath);
    }, 20000); // Increased timeout for downloading

    it("should read a PDF and extract text", async () => {
        const paperId = "2509.11982v1";
        const savePath = "./downloads";
        if (!fs.existsSync(savePath)) fs.mkdirSync(savePath);
        const pdfPath = await searcher.downloadPDF(paperId, savePath);
        const text = await searcher.readPaper(paperId, savePath);
        expect(typeof text).toBe("string");
        expect(text.length).toBeGreaterThan(0);
        // Clean up
        fs.unlinkSync(pdfPath);
    }, 50000);
});