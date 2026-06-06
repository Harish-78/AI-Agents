// src/controllers/chat.controller.ts
import { Request, Response } from "express";
import { DocumentService } from "../services/document.service";
import { VectorService } from "../services/vector.service";
import { ChatService } from "../services/chat.service";
import logger from "../middlewares/logger.middleware";

const documentService = new DocumentService();
const vectorService = new VectorService();
const chatService = new ChatService();

/**
 * Process documents from URLs and store in vector database
 */
export const processDocuments = async (req: Request, res: Response) => {
  try {
    const { urls, chunkSize = 1000, chunkOverlap = 200 } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of URLs",
      });
    } 

    logger.info(`Processing ${urls.length} documents`);

    // Process all URLs
    const { documents, results } = await documentService.processUrls(urls, {
      chunkSize,
      chunkOverlap,
    });

    // Store in vector database
    if (documents.length > 0) {
      await vectorService.storeDocuments(documents);
    }

    return res.status(200).json({
      success: true,
      message: "Documents processed successfully",
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      details: results,
    });
  } catch (error) {
    logger.error("Error in processDocuments", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Query the documents using RAG
 */
export const queryDocuments = async (req: Request, res: Response) => {
  try {
    const { query, topK = 5 } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid query string",
      });
    }

    logger.info(`Query: "${query}"`);

    // Search for relevant documents
    const relevantDocs = await vectorService.similaritySearch(query, topK);

    if (relevantDocs.length === 0) {
      return res.status(200).json({
        success: true,
        query,
        answer:
          "No relevant documents found. Please process some documents first.",
        sources: [],
      });
    }

    // Generate response using LLM
    const response = await chatService.generateResponse(query, relevantDocs);

    return res.status(200).json({
      success: true,
      query: response.query,
      answer: response.answer,
      sources: response.sources,
      metadata: response.metadata,
    });
  } catch (error) {
    logger.error("Error in queryDocuments", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get vector store statistics
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const stats = await vectorService.getCollectionStats();

    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error("Error in getStats", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get statistics",
    });
  }
};

/**
 * Clear all documents from vector store
 */
export const clearDocuments = async (req: Request, res: Response) => {
  try {
    await vectorService.clearCollection();

    return res.status(200).json({
      success: true,
      message: "All documents cleared successfully",
    });
  } catch (error) {
    logger.error("Error in clearDocuments", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear documents",
    });
  }
};
