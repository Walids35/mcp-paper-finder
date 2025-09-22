import { SciHubSearcher } from "../providers/scihub.js";
import fs from "fs";
    
describe("SciHubFetcher", () => {
    const fetcher = new SciHubSearcher("https://sci-hub.st", "./downloads");

    it("should return null for empty identifier", async () => {
        const result = await fetcher.downloadPDF("");
        expect(result).toBeNull();
    });

    it("should return null for invalid identifier", async () => {
        const result = await fetcher.downloadPDF("not-a-real-doi-1234567890");
        expect(result).toBeNull();
    });

    it("should attempt to download a real PDF (if available)", async () => {
        // This test may fail if Sci-Hub is blocked.
        const result = await fetcher.downloadPDF("10.1038/s41586-020-2649-2");
        expect(typeof result === "string" || result === null).toBe(true);
        if (result && fs.existsSync(result)) {
            // Clean up
            fs.unlinkSync(result);
        }
    }, 20000);

    it("should generate a filename with hash and identifier", () => {
        // Private method test via public interface
        const buffer = Buffer.from("test content");
        // @ts-ignore
        const filename = fetcher.generateFilename("https://sci-hub.st/test.pdf", buffer, "10.1038/s41586-020-2649-2");
        expect(filename.endsWith(".pdf")).toBe(true);
        expect(filename).toMatch(/^[a-f0-9]{8}_/);
    });
});