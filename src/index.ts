import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ArxivSearcher } from "./providers/arxiv.js";

// Create server instance
const server = new McpServer({
  name: "paper-finder",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Arxiv Tool
server.tool(
    "arxiv_search", 
    "Search for academic papers on arXiv", 
    {
        query: z.string().describe("The search query string"),
        max_results: z.number().optional().describe("Maximum number of results to return"),
    },
    async ({ query, max_results }) => {
        const searcher = new ArxivSearcher();
        const results = await searcher.search(query, max_results);
        return {
            content: [{
                type: "text",
                text: `${JSON.stringify(results, null, 2)}`
            }]
        }
    }
)

// Download Arxiv Paper Tool
server.tool(
    "download_arxiv_paper", 
    "Download a paper from arXiv by its ID",
    {
        paper_id: z.string().describe("The arXiv paper ID"),
        save_path: z.string().describe("Directory to save the downloaded paper").default("./downloads"),
    },
    async ({ paper_id, save_path }) => {
        const searcher = new ArxivSearcher();
        const result = await searcher.downloadPDF(paper_id, save_path);
        return {
            content: [{
                type: "text",
                text: `${JSON.stringify(result, null, 2)}`
            }]
        }
    }
)

// Read Arxiv Paper Tool
server.tool(
    "read_arxiv_paper",
    "Read and extract text from a downloaded arXiv paper by its ID",
    {
        paper_id: z.string().describe("The arXiv paper ID"),
        save_path: z.string().describe("Directory where the paper is saved").default("./downloads"),
    },
    async ({ paper_id, save_path }) => {
        const searcher = new ArxivSearcher();
        const result = await searcher.readPaper(paper_id, save_path);
        return {
            content: [{
                type: "text",
                text: `${result}`
            }]
        }
    }
)

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Server connected and running...");
}

main().catch((err) => {
    console.error("Error starting server:", err);
    process.exit(1);
});