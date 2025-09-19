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

// Elsevier Tool
server.tool(
    "elsevier_search",
    "Search for academic papers on Elsevier",
    {
        query: z.string().describe("The search query string"),
        max_results: z.number().optional().describe("Maximum number of results to return"),
        date: z.string().describe("Start date in YYYY format"),
    },
    async ({ query, max_results, date }) => {
        const { ElsevierSearcher } = await import("./providers/elsevier.js");
        const searcher = new ElsevierSearcher();
        const results = await searcher.search(query, max_results, date);
        return {
            content: [{
                type: "text",
                text: `${JSON.stringify(results, null, 2)}`
            }]
        }
    }
)


// Zenodo Tool
server.tool(
    "zenodo_search",
    "Search for academic papers on Zenodo",
    {
        query: z.string().describe("The search query string"),
        max_results: z.number().optional().describe("Maximum number of results to return"),
        community: z.string().optional().describe("Community slug (e.g., 'kios-coe')"),
        year: z.string().optional().describe("Year or range (e.g., '2025', '2016-2020', '2010-', '-2015')"),
        resource_type: z.string().optional().describe("Resource type (e.g., 'publication', 'dataset')"),
        subtype: z.string().optional().describe("Subtype (e.g., 'conferencepaper', 'article')"),
        creators: z.array(z.string()).optional().describe("List of author names to match"),
        keywords: z.array(z.string()).optional().describe("List of keywords to match"),
        sort: z.string().optional().describe("Field to sort by (e.g., 'mostrecent', 'bestmatch', 'version')"),
        order: z.string().optional().describe("'asc' or 'desc'"),
    },
    async ({
        query,
        max_results,
        community,
        year,
        resource_type,
        subtype,
        creators,
        keywords,
        sort,
        order,
    }) => {
        const { ZenodoSearcher } = await import("./providers/zenodo.js");
        const searcher = new ZenodoSearcher();
        const results = await searcher.search(
            query,
            max_results,
            {
                community,
                year,
                resource_type,
                subtype,
                creators,
                keywords,
                sort,
                order,
            }
        );
        return {
            content: [{
                type: "text",
                text: `${JSON.stringify(results, null, 2)}`
            }]
        };
    }
);

// Download Zenodo Paper Tool
server.tool(
    "download_zenodo_paper",
    "Download a paper from Zenodo by its record ID",
    {
        record_id: z.string().describe("The Zenodo record ID"),
        save_path: z.string().describe("Directory to save the downloaded paper").default("./downloads"),
    },
    async ({ record_id, save_path }) => {
        const { ZenodoSearcher } = await import("./providers/zenodo.js");
        const searcher = new ZenodoSearcher();
        const result = await searcher.downloadPDF(record_id, save_path);
        return {
            content: [{
                type: "text",
                text: `${JSON.stringify(result, null, 2)}`
            }]
        };
    }
);

// Read Zenodo Paper Tool
server.tool(
    "read_zenodo_paper",
    "Read and extract text from a downloaded Zenodo paper by its record ID",
    {
        record_id: z.string().describe("The Zenodo record ID"),
        save_path: z.string().describe("Directory where the paper is saved").default("./downloads"),
    },
    async ({ record_id, save_path }) => {
        const { ZenodoSearcher } = await import("./providers/zenodo.js");
        const searcher = new ZenodoSearcher();
        const result = await searcher.readPaper(record_id, save_path);
        return {
            content: [{
                type: "text",
                text: `${result}`
            }]
        };
    }
);

// Download Sci-Hub Paper Tool
server.tool(
    "download_scihub_paper",
    "Download a paper from Sci-Hub by its identifier (DOI, URL, etc.)",
    {
        identifier: z.string().describe("The paper identifier (DOI, URL, etc.)"),
        save_path: z.string().describe("Directory to save the downloaded paper").default("./downloads"),
    },
    async ({ identifier, save_path }) => {
        const { SciHubSearcher } = await import("./providers/scihub.js");
        const searcher = new SciHubSearcher(save_path);
        const result = await searcher.downloadPDF(identifier);
        return {
            content: [{
                type: "text",
                text: result ? `Downloaded to: ${result}` : "Failed to download paper."
            }]
        };
    }
);

// Biorxiv Tool
server.tool(
    "biorxiv_search",
    "Search for academic papers on bioRxiv",
    {
        query: z.string().describe("The search query string"),
        max_results: z.number().optional().describe("Maximum number of results to return"),
    },
    async ({ query, max_results }) => {
        const { BiorxivSearcher } = await import("./providers/biorxiv.js");
        const searcher = new BiorxivSearcher();
        const results = await searcher.search(query, max_results);
        return {
            content: [{
                type: "text",
                text: `${JSON.stringify(results, null, 2)}`
            }]
        }
    }
)

// Download Biorxiv Paper Tool
server.tool(
    "download_biorxiv_paper",
    "Download a paper from bioRxiv by its DOI",
    {
        doi: z.string().describe("The bioRxiv paper DOI"),
        save_path: z.string().describe("Directory to save the downloaded paper").default("./downloads"),
    },
    async ({ doi, save_path }) => {
        const { BiorxivSearcher } = await import("./providers/biorxiv.js");
        const searcher = new BiorxivSearcher();
        const result = await searcher.downloadPDF(doi, save_path);
        return {
            content: [{
                type: "text",
                text: `${JSON.stringify(result, null, 2)}`
            }]
        }
    }
)

// Read Biorxiv Paper Tool
server.tool(
    "read_biorxiv_paper",
    "Read and extract text from a downloaded bioRxiv paper by its DOI",
    {
        doi: z.string().describe("The bioRxiv paper DOI"),
        save_path: z.string().describe("Directory where the paper is saved").default("./downloads"),
    },
    async ({ doi, save_path }) => {
        const { BiorxivSearcher } = await import("./providers/biorxiv.js");
        const searcher = new BiorxivSearcher();
        const result = await searcher.readPaper(doi, save_path);
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