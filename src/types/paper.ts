export type Paper = {
    paper_id: string;
    title: string;
    authors: string[];
    abstract: string;
    url: string;
    published_date: Date;
    updated_date: Date | undefined;
    source: string;
    categories: string[];
    keywords: string[];
    doi: string;
    pdf_url: string;
}