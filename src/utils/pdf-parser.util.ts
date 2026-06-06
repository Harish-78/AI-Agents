// utils/pdf-parser.ts
import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from "pdf-parse";
import { Document } from "@langchain/core/documents";

export interface ParsedPDFData {
  text: string;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modDate?: Date;
  pageCount: number;
  fileSize: number;
  fileName: string;
}

export interface PageData {
  pageNumber: number;
  text: string;
  content: string;
}

export interface PDFParseOptions {
  maxPages?: number;
  password?: string;
  preserveImages?: boolean;
  storePageData?: boolean;
}

/**
 * Main PDF parsing function with comprehensive options
 */
export async function parsePDF(
  filePath: string,
  options: PDFParseOptions = {}
): Promise<ParsedPDFData> {
  const {
    maxPages,
    password,
    storePageData = true,
  } = options;

  try {
    const parser = new PDFParse({ url: filePath });
    const result = await parser.getText();

    return {
      text: result.text,
    };
  } catch (error) {
    console.error(`Failed to parse PDF: ${filePath}`, error);
    throw new Error(
      `PDF parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Extract individual pages from the full text
 */
function extractPages(fullText: string, numPages: number): PageData[] {
  const pages: PageData[] = [];
  
  // Simple page splitting (pdf-parse combines all pages)
  const textPerPage = fullText.length / numPages;
  
  for (let i = 0; i < numPages; i++) {
    const start = Math.floor(i * textPerPage);
    const end = Math.floor((i + 1) * textPerPage);
    const pageText = fullText.substring(start, end);
    
    pages.push({
      pageNumber: i + 1,
      text: pageText,
      content: pageText,
    });
  }
  
  return pages;
}

/**
 * Clean and normalize PDF text for better embeddings
 */
export function cleanPDFText(text: string): string {
  return text
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/(\r\n|\n|\r)/gm, ' ')          // Remove line breaks
    .replace(/[^\w\s.,!?;:'"()-]/g, '')      // Remove special characters
    .replace(/\s{2,}/g, ' ')                 // Remove multiple spaces
    .trim();
}

/**
 * Create LangChain documents from parsed PDF
 */
export function pdfToLangChainDocuments(
  parsedData: ParsedPDFData,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    includeMetadata?: boolean;
  } = {}
): Document<Record<string, any>>[] {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    includeMetadata = true,
  } = options;
  
  const documents: Document<Record<string, any>>[] = [];
  const cleanedText = cleanPDFText(parsedData.text);
  
  // Split text into chunks
  const chunks = splitTextIntoChunks(cleanedText, chunkSize, chunkOverlap);
  
  // Create document for each chunk
  chunks.forEach((chunk, index) => {
    const metadata: Record<string, any> = includeMetadata
      ? {
          chunkIndex: index,
          totalChunks: chunks.length,
        }
      : {};
    
    documents.push(new Document({
      pageContent: chunk,
      metadata,
    }));
  });
  
  return documents;
}

/**
 * Split text into overlapping chunks
 */
function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const words = text.split(' ');
  let currentChunk: string[] = [];
  let currentLength = 0;
  
  for (const word of words) {
    const wordLength = word.length + 1; // +1 for space
    
    if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
      // Push current chunk
      chunks.push(currentChunk.join(' '));
      
      // Keep overlap words
      const overlapWords = Math.floor(overlap / 10); // Rough estimate
      currentChunk = currentChunk.slice(-overlapWords);
      currentLength = currentChunk.join(' ').length;
    }
    
    currentChunk.push(word);
    currentLength += wordLength;
  }
  
  // Push last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

/**
 * Get PDF text statistics
 */
export function getPDFStats(parsedData: ParsedPDFData) {
  return {
    characterCount: parsedData.text.length,
    wordCount: parsedData.text.split(/\s+/).length,
    estimatedTokens: Math.ceil(parsedData.text.length / 4),
  };
}

/**
 * Validate PDF file before parsing
 */
export async function validatePDF(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    
    const fileStats = await fs.stat(filePath);
    if (fileStats.size === 0) {
      throw new Error('PDF file is empty');
    }
    
    if (fileStats.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('PDF file too large (max 50MB)');
    }
    
    const buffer = await fs.readFile(filePath);
    const header = buffer.toString('utf8', 0, 5);
    
    if (header !== '%PDF-') {
      throw new Error('Invalid PDF format');
    }
    
    return true;
  } catch (error) {
    console.error('PDF validation failed:', error);
    return false;
  }
}