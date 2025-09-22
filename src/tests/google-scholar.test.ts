import { GoogleScholarSearcher } from "../providers/google-scholar.js";

describe("GoogleScholarSearcher", () => {
  const searcher = new GoogleScholarSearcher();

  it("should search Google Scholar and return papers", async () => {
    const results = await searcher.search("stock market prediction", 5);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("authors");
    expect(results[0]).toHaveProperty("url");
  });

  it("should throw error for downloadPDF", async () => {
    await expect(searcher.downloadPDF("some-id", "./downloads")).rejects.toThrow(
      /doesn't provide direct PDF downloads/
    );
  });

  it("should return not supported message for readPaper", async () => {
    const msg = await searcher.readPaper("some-id", "./downloads");
    expect(typeof msg).toBe("string");
    expect(msg).toMatch(/doesn't support direct paper reading/);
  });
});