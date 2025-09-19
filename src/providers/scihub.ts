/**
 * Sci-Hub downloader integration.
 * Simple wrapper for downloading PDFs via Sci-Hub.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as cheerio from "cheerio";

export class SciHubSearcher {
    baseUrl: string;
    outputDir: string;
    headers: Record<string, string>;

    constructor(baseUrl: string = "https://sci-hub.st", outputDir: string = "./downloads") {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.outputDir = outputDir;
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };
    }

    async downloadPDF(identifier: string): Promise<string | null> {
        if (!identifier.trim()) return null;
        try {
            const pdfUrl = await this.getDirectUrl(identifier);
            if (!pdfUrl) {
                console.error(`Could not find PDF URL for identifier: ${identifier}`);
                return null;
            }

            const response = await fetch(pdfUrl, {
                headers: this.headers
            });

            if (!response.ok) {
                console.error(`Failed to download PDF, status ${response.status}`);
                return null;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/pdf')) {
                console.error("Response is not a PDF");
                return null;
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const filename = this.generateFilename(response.url, buffer, identifier);
            const filePath = path.join(this.outputDir, filename);
            fs.writeFileSync(filePath, buffer);
            return filePath;
        } catch (e) {
            console.error(`Error downloading PDF for ${identifier}: ${e}`);
            return null;
        }
    }

    private async getDirectUrl(identifier: string): Promise<string | null> {
        try {
            if (identifier.endsWith('.pdf')) return identifier;

            const searchUrl = `${this.baseUrl}/${identifier}`;
            const resp = await fetch(searchUrl, { headers: this.headers });
            if (!resp.ok) return null;

            const html = await resp.text();
            const $ = cheerio.load(html);

            if (html.toLowerCase().includes("article not found")) {
                console.warn("Article not found on Sci-Hub");
                return null;
            }

            // Look for embed tag with PDF
            const embed = $('embed[type="application/pdf"]');
            if (embed.length) {
                let src = embed.attr('src');
                if (src) {
                    if (src.startsWith('//')) return 'https:' + src;
                    if (src.startsWith('/')) return this.baseUrl + src;
                    return src;
                }
            }

            // Look for iframe with PDF
            const iframe = $('iframe');
            if (iframe.length) {
                let src = iframe.attr('src');
                if (src) {
                    if (src.startsWith('//')) return 'https:' + src;
                    if (src.startsWith('/')) return this.baseUrl + src;
                    return src;
                }
            }

            // Look for download button with onclick
            $('button').each((_, el) => {
                const onclick = $(el).attr('onclick') || '';
                if (onclick.toLowerCase().includes('pdf')) {
                    const match = onclick.match(/location\.href='([^']+)'/);
                    if (match && match[1]) {
                        let url = match[1];
                        if (url.startsWith('//')) found = 'https:' + url;
                        else if (url.startsWith('/')) found = this.baseUrl + url;
                        else found = url;
                    }
                }
            });

            // Look for direct download links
            let found: string | null = null;
            $('a').each((_, el) => {
                const href = $(el).attr('href') || '';
                if (href && (href.toLowerCase().includes('pdf') || href.endsWith('.pdf'))) {
                    if (href.startsWith('//')) found = 'https:' + href;
                    else if (href.startsWith('/')) found = this.baseUrl + href;
                    else if (href.startsWith('http')) found = href;
                }
            });
            if (found) return found;

            return null;
        } catch (e) {
            console.error(`Error getting direct URL for ${identifier}: ${e}`);
            return null;
        }
    }

    private generateFilename(responseUrl: string, buffer: Buffer, identifier: string): string {
        // Try to get filename from URL
        const urlParts = responseUrl.split('/');
        if (urlParts.length) {
            let name = urlParts[urlParts.length - 1];
            name = name.replace(/#view=(.+)/, '');
            if (name.endsWith('.pdf')) {
                const pdfHash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
                const baseName = name.slice(0, -4);
                return `${pdfHash}_${baseName}.pdf`;
            }
        }
        // Fallback: use identifier
        const cleanIdentifier = identifier.replace(/[^\w\-_.]/g, '_');
        const pdfHash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
        return `${pdfHash}_${cleanIdentifier}.pdf`;
    }
}