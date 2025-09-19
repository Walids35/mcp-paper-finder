import { ZenodoSearcher } from "../providers/zenodo.js";
import fs from "fs";

async function checkZenodoAccessible(): Promise<boolean> {
  try {
    const resp = await fetch("https://zenodo.org/api/records?q=*&size=1", { method: "GET" });
    return resp.status === 200;
  } catch {
    return false;
  }
}

describe("ZenodoSearcher", () => {
  let zenodoAvailable = false;
  const searcher = new ZenodoSearcher();

  beforeAll(async () => {
    zenodoAvailable = await checkZenodoAccessible();
  });

  it("should search Zenodo and return papers", async () => {
    const results = await searcher.search("stock market prediction", 2);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("authors");
  });

  it("should list files for a known record", async () => {
    // Use a known Zenodo record ID (public dataset)
    const files = await searcher.listFiles("3973623");
    expect(Array.isArray(files)).toBe(true);
    if (files.length > 0) {
      expect(files[0]).toHaveProperty("key");
      expect(files[0]).toHaveProperty("download");
    }
  });

  it("should get record details for a known record", async () => {
    const record = await searcher.getRecordDetails("3973623");
    expect(record).not.toBeNull();
    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("metadata");
  });

  it("should download a PDF if available or return an error message", async () => {
    const savePath = "./downloads";
    if (!fs.existsSync(savePath)) fs.mkdirSync(savePath);
    const result = await searcher.downloadPDF("3973623", savePath);
    // Result is either a file path or an error message
    expect(typeof result).toBe("string");
    if (fs.existsSync(result)) {
      // Clean up
      fs.unlinkSync(result);
    }
  });

  it("should read a paper and return text or a message", async () => {
    const savePath = "./downloads";
    if (!fs.existsSync(savePath)) fs.mkdirSync(savePath);
    const text = await searcher.readPaper("3973623", savePath);
    expect(typeof text).toBe("string");
  });

  it("should search communities", async () => {
    const results = await searcher.searchCommunities("climate", 2);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("title");
  });

  it("should search by creator", async () => {
    const results = await searcher.searchByCreator("Smith", 2);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("authors");
    }
  });
});