// src/services/document.service.ts
import { Document } from "@langchain/core/documents";
import { parsePDF } from "../utils/pdf-parser.util";
import logger from "../middlewares/logger.middleware";

export interface ProcessResult {
  url: string;
  success: boolean;
  documentCount: number;
  pageCount: number;
  error?: string;
}

export class DocumentService {
  async processUrls(
    urls: string[],
    options: { chunkSize: number; chunkOverlap: number }
  ): Promise<{ documents: Document[]; results: ProcessResult[] }> {
    const allDocuments: Document[] = [];
    const results: ProcessResult[] = [];

    // Process URLs in parallel
    const promises = urls.map(async (url) => {
      try {
        logger.info(`Processing: ${url}`);
        
        // Parse PDF
        const pdfData = await parsePDF(url);
        
        // Create documents from PDF
        const documents = this.createDocuments(pdfData, url, options);
        
        allDocuments.push(...documents);
        
        results.push({
          url,
          success: true,
          documentCount: documents.length,
          pageCount: pdfData.metadata.pageCount,
        });
        
        logger.info(`Successfully processed: ${url} (${documents.length} chunks)`);
      } catch (error) {
        logger.error(`Failed to process: ${url}`, error);
        results.push({
          url,
          success: false,
          documentCount: 0,
          pageCount: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    await Promise.all(promises);
    
    return { documents: allDocuments, results };
  }

  private createDocuments(
    pdfData: any,
    sourceUrl: string,
    options: { chunkSize: number; chunkOverlap: number }
  ): Document[] {
    const documents: Document[] = [];
    const text = pdfData.text;
    
    // Split text into chunks
    const chunks = this.splitText(text, options.chunkSize, options.chunkOverlap);
    
    // Create document for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const doc = new Document({
        pageContent: chunks[i],
        metadata: {
          source: sourceUrl,
          title: pdfData.metadata.title || "Untitled",
          pageCount: pdfData.metadata.pageCount,
          chunkIndex: i,
          totalChunks: chunks.length,
          fileName: pdfData.metadata.fileName,
        },
      });
      documents.push(doc);
    }
    
    return documents;
  }

  private splitText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const words = text.split(' ');
    let currentChunk: string[] = [];
    let currentLength = 0;
    
    for (const word of words) {
      const wordLength = word.length + 1;
      
      if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        
        const overlapWords = Math.floor(overlap / 10);
        currentChunk = currentChunk.slice(-overlapWords);
        currentLength = currentChunk.join(' ').length;
      }
      
      currentChunk.push(word);
      currentLength += wordLength;
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }
    
    return chunks;
  }
}