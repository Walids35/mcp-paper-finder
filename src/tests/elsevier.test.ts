import { ElsevierSearcher } from "../providers/elsevier.js";

describe("ElsevierSearcher", () => {
    const searcher = new ElsevierSearcher();

    it("should search Elsevier and return papers", async () => {
        const results = await searcher.search("stock market prediction", 2, "2023");
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty("title");
    });

    // Note: Downloading and reading papers from Elsevier may require proper access rights.
    // These tests are commented out to avoid potential access issues.
    it("should return message for downloading a PDF", async () => {
        const paperId = "10.1016/j.ins.2020.06.037"; // Example DOI
        const savePath = "./downloads";
        const message = await searcher.downloadPDF(paperId, savePath);
        expect(message).toContain("PDF download not supported for Elsevier papers");
    });

    it("should return message for reading a PDF", async () => {
        const paperId = "10.1016/j.ins.2020.06.037"; // Example DOI
        const savePath = "./downloads";
        const message = await searcher.readPaper(paperId, savePath);
        expect(message).toContain("PDF reading not supported for Elsevier papers");
    });
});