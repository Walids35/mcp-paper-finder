import { Paper } from "./types/paper.js";

export abstract class PaperSource {
    /**
     * Search for papers.
     * @param query The search query string.
     * @param kwargs Additional keyword arguments.
     */
    abstract search(query: string, ...kwargs: any[]): Promise<Paper[]>;

    /**
     * Download a paper's PDF.
     * @param paperId The paper's ID.
     * @param savePath Where to save the PDF.
     */
    abstract downloadPDF(paperId: string, savePath: string): Promise<string>;

    /**
     * Read a paper and extract its text.
     * @param paperId The paper's ID.
     * @param savePath Where the PDF is saved.
     */
    abstract readPaper(paperId: string, savePath: string): Promise<string>;
}