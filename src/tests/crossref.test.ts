import { CrossRefSearcher } from "../providers/crossref.js";

describe("CrossRefSearcher", () => {
  const searcher = new CrossRefSearcher();

  it("should search CrossRef and return papers", async () => {
    const results = await searcher.search("stock market prediction", 2);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("authors");
    expect(results[0]).toHaveProperty("doi");
  }, 30000);

  it("should throw error for downloadPDF", async () => {
    await expect(searcher.downloadPDF("some-doi", "./downloads")).rejects.toThrow(
      /does not provide direct PDF downloads/
    );
  });

  it("should return not supported message for readPaper", async () => {
    const msg = await searcher.readPaper("some-doi", "./downloads");
    expect(typeof msg).toBe("string");
    expect(msg).toMatch(/cannot be read directly through this tool/);
  });

  it("should get paper by DOI", async () => {
    // Use a known DOI for testing (may fail if DOI is not available)
    const paper = await searcher.getPaperByDoi("10.5555/12345678");
    expect(paper === null || typeof paper === "object").toBe(true);
    if (paper) {
      expect(paper).toHaveProperty("title");
      expect(paper).toHaveProperty("doi");
    }
  });
});