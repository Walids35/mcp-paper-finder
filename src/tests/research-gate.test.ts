import { ResearchGateSearcher } from "../providers/research-gate.js";

describe("ResearchGateSearcher", () => {
  const searcher = new ResearchGateSearcher();

  it("should search ResearchGate and return papers", async () => {
    // This test may fail if ResearchGate blocks automated requests or changes its HTML structure.
    const results = await searcher.search("stock market prediction", 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("url");
    expect(results[0]).toHaveProperty("abstract");
    expect(results[0]).toHaveProperty("authors");
  }, 50000);
});