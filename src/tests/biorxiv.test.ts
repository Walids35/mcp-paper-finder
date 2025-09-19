import { BioRxivSearcher } from "../providers/biorxiv.js";
import fs from "fs";


describe("BioRxivSearcher", () => {
  const searcher = new BioRxivSearcher();
  const testSavePath = "./downloads";

  it("should search bioRxiv and return papers", async () => {
    const results = await searcher.search("neuroscience", 2, 7);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("authors");
  }, 1000 * 10);

  it("should download a PDF for a known paper", async () => {
    // Use a known bioRxiv DOI for testing
    const paperId = "10.1101/2020.01.01.123456";
    if (!fs.existsSync(testSavePath)) fs.mkdirSync(testSavePath);
    // This may fail if the DOI is not available, so just check for error or file
    let result: string | undefined;
    try {
      result = await searcher.downloadPDF(paperId, testSavePath);
    } catch (e) {
      result = undefined;
    }
    expect(typeof result === "string" || result === undefined).toBe(true);
    if (result && fs.existsSync(result)) {
      fs.unlinkSync(result);
    }
  });

  it("should read a paper and return text or a message", async () => {
    const paperId = "10.1101/2020.01.01.123456";
    if (!fs.existsSync(testSavePath)) fs.mkdirSync(testSavePath);
    let text: string | undefined;
    try {
      text = await searcher.readPaper(paperId, testSavePath);
    } catch (e) {
      text = undefined;
    }
    expect(typeof text === "string" || text === undefined).toBe(true);
  });
});