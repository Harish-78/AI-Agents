// src/services/vector.service.ts
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { Document } from "@langchain/core/documents";
import { CloudClient } from "chromadb";
import logger from "../middlewares/logger.middleware";

export class VectorService {
  private embeddings: GoogleGenerativeAIEmbeddings;
  private collectionName: string;
  private chromaClient: CloudClient;
  private cloudConfig: {
    host: string;
    port: number;
    apiKey: string;
    tenant: string;
    database: string;
  };

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      logger.error("Missing Gemini API key");
      throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required");
    }

    // Get Chroma Cloud configuration
    const chromaApiKey = process.env.CHROMA_API_KEY;
    if (!chromaApiKey) {
      logger.error("Missing CHROMA_API_KEY for Chroma Cloud");
      throw new Error("CHROMA_API_KEY is required for Chroma Cloud");
    }

    logger.info("Initializing VectorService with Chroma Cloud...");

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-2",
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      apiKey: apiKey,
    });

    this.collectionName = process.env.CHROMA_COLLECTION || "documents";

    // Chroma Cloud configuration
    this.cloudConfig = {
      host: process.env.CHROMA_HOST || "api.trychroma.com",
      port: parseInt(process.env.CHROMA_PORT || "443"),
      apiKey: chromaApiKey,
      tenant: process.env.CHROMA_TENANT || "default_tenant",
      database: process.env.CHROMA_DATABASE || "default_database",
    };

    // Initialize Chroma Cloud client - THIS IS KEY
    this.chromaClient = new CloudClient({
      apiKey: this.cloudConfig.apiKey,
      host: this.cloudConfig.host,
      port: this.cloudConfig.port,
      tenant: this.cloudConfig.tenant,
      database: this.cloudConfig.database,
    });

    logger.info("VectorService initialized for Chroma Cloud", {
      collectionName: this.collectionName,
      host: this.cloudConfig.host,
      port: this.cloudConfig.port,
      tenant: this.cloudConfig.tenant,
      database: this.cloudConfig.database,
    });
  }

  /**
   * Get or create collection using CloudClient
   */
  private async getOrCreateCollection() {
    try {
      // Try to get existing collection
      const collection = await this.chromaClient.getCollection({
        name: this.collectionName,
      });
      logger.info(`Using existing collection: ${this.collectionName}`);
      return collection;
    } catch (error) {
      // Collection doesn't exist, create it
      logger.info(`Creating new collection: ${this.collectionName}`);
      const collection = await this.chromaClient.createCollection({
        name: this.collectionName,
        metadata: {
          "hnsw:space": "cosine",
          created: new Date().toISOString(),
        },
      });
      return collection;
    }
  }

  /**
   * Store documents in Chroma Cloud
   */
  async storeDocuments(documents: Document[]): Promise<void> {
    if (documents.length === 0) {
      logger.warn("No documents to store, skipping...");
      return;
    }

    logger.info(`Starting to store ${documents.length} documents`, {
      collectionName: this.collectionName,
    });

    try {
      const collection = await this.getOrCreateCollection();

      const startTime = Date.now();

      // Prepare records for Chroma Cloud
      const ids: string[] = [];
      const embeddings: number[][] = [];
      const metadatas: Record<string, any>[] = [];
      const documents_list: string[] = [];

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const id =
          doc.metadata.chunkIndex !== undefined
            ? `${Date.now()}_${doc.metadata.chunkIndex}`
            : `${Date.now()}_${i}`;

        ids.push(id);

        // Generate embedding for the document
        const embedding = await this.embeddings.embedQuery(doc.pageContent);
        embeddings.push(embedding);

        metadatas.push(doc.metadata);
        documents_list.push(doc.pageContent);
      }

      // Add to Chroma Cloud in batches (Chroma Cloud has batch limits)
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);
        const batchDocuments = documents_list.slice(i, i + batchSize);

        await collection.add({
          ids: batchIds,
          embeddings: batchEmbeddings,
          metadatas: batchMetadatas,
          documents: batchDocuments,
        });

        logger.debug(
          `Added batch ${i / batchSize + 1} of ${Math.ceil(ids.length / batchSize)}`,
        );
      }

      const duration = Date.now() - startTime;

      logger.info(`✅ Successfully stored ${documents.length} documents`, {
        duration: `${duration}ms`,
        collectionName: this.collectionName,
      });
    } catch (error) {
      logger.error("Failed to store documents", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        documentCount: documents.length,
        collectionName: this.collectionName,
      });
      throw new Error(
        `Chroma Cloud storage failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Search for similar documents using CloudClient
   */
  async similaritySearch(query: string, topK: number = 5): Promise<Document[]> {
    logger.info(`Performing similarity search`, {
      query: query.substring(0, 100),
      topK,
      collectionName: this.collectionName,
    });

    try {
      const startTime = Date.now();
      const collection = await this.getOrCreateCollection();

      // Generate embedding for query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Perform search
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        include: ["documents", "metadatas", "distances"],
      });

      const duration = Date.now() - startTime;

      // Convert results to LangChain Document format
      const documents: Document[] = [];
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          if (results.documents[0][i]) {
            documents.push(
              new Document({
                pageContent: results.documents[0][i] || "",
                metadata: results.metadatas?.[0]?.[i] || {},
              }),
            );
          }
        }
      }

      logger.info(`✅ Similarity search completed`, {
        resultsCount: documents.length,
        duration: `${duration}ms`,
        topK,
      });

      return documents;
    } catch (error) {
      logger.error("Failed to perform similarity search", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        query: query.substring(0, 100),
        topK,
      });
      throw error;
    }
  }

  /**
   * Search with similarity scores
   */
  async similaritySearchWithScore(
    query: string,
    topK: number = 5,
  ): Promise<[Document, number][]> {
    logger.info(`Performing similarity search with scores`, {
      query: query.substring(0, 100),
      topK,
      collectionName: this.collectionName,
    });

    try {
      const startTime = Date.now();
      const collection = await this.getOrCreateCollection();

      const queryEmbedding = await this.embeddings.embedQuery(query);

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        include: ["documents", "metadatas", "distances"],
      });

      const duration = Date.now() - startTime;

      const documentsWithScores: [Document, number][] = [];
      if (
        results.documents &&
        results.documents[0] &&
        results.distances &&
        results.distances[0]
      ) {
        for (let i = 0; i < results.documents[0].length; i++) {
          if (results.documents[0][i]) {
            const doc = new Document({
              pageContent: results.documents[0][i] || "",
              metadata: results.metadatas?.[0]?.[i] || {},
            });
            // Convert distance to similarity score (1 - distance for cosine)
            const score = 1 - (results.distances[0][i] || 0);
            documentsWithScores.push([doc, score]);
          }
        }
      }

      logger.info(`✅ Similarity search with scores completed`, {
        resultsCount: documentsWithScores.length,
        duration: `${duration}ms`,
        topK,
      });

      return documentsWithScores;
    } catch (error) {
      logger.error("Failed to perform similarity search with scores", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        query: query.substring(0, 100),
        topK,
      });
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<any> {
    logger.info(`Getting collection stats`, {
      collectionName: this.collectionName,
    });

    try {
      let count = 0;

      try {
        const collection = await this.chromaClient.getCollection({
          name: this.collectionName,
        });
        count = await collection.count();
      } catch (error) {
        logger.warn(`Collection ${this.collectionName} does not exist yet`);
      }

      const stats = {
        collectionName: this.collectionName,
        documentCount: count,
        host: this.cloudConfig.host,
        port: this.cloudConfig.port,
        tenant: this.cloudConfig.tenant,
        database: this.cloudConfig.database,
        status: count > 0 ? "active" : "empty",
        platform: "Chroma Cloud",
      };

      logger.info(`✅ Collection stats retrieved`, stats);

      return stats;
    } catch (error) {
      logger.error("Failed to get collection stats", {
        error: error instanceof Error ? error.message : "Unknown error",
        collectionName: this.collectionName,
      });

      return {
        collectionName: this.collectionName,
        documentCount: 0,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Clear all documents from collection
   */
  async clearCollection(): Promise<void> {
    logger.warn(`Clearing collection`, {
      collectionName: this.collectionName,
    });

    try {
      const collection = await this.chromaClient.getCollection({
        name: this.collectionName,
      });

      const allDocs = await collection.get();
      const ids = allDocs.ids;

      if (ids && ids.length > 0) {
        await collection.delete({ ids });
        logger.info(`✅ Cleared ${ids.length} documents`, {
          collectionName: this.collectionName,
          deletedCount: ids.length,
        });
      } else {
        logger.info(`Collection was already empty`, {
          collectionName: this.collectionName,
        });
      }
    } catch (error) {
      logger.error("Failed to clear collection", {
        error: error instanceof Error ? error.message : "Unknown error",
        collectionName: this.collectionName,
      });

      if (error instanceof Error && error.message.includes("does not exist")) {
        logger.info(`Collection ${this.collectionName} does not exist`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Health check for Chroma Cloud connection
   */
  async healthCheck(): Promise<boolean> {
    logger.info(`Performing Chroma Cloud health check...`);

    try {
      await this.chromaClient.heartbeat();

      logger.info(`✅ Chroma Cloud health check passed`, {
        host: this.cloudConfig.host,
        port: this.cloudConfig.port,
        tenant: this.cloudConfig.tenant,
      });

      return true;
    } catch (error) {
      logger.error(`❌ Chroma Cloud health check failed`, {
        error: error instanceof Error ? error.message : "Unknown error",
        host: this.cloudConfig.host,
        port: this.cloudConfig.port,
      });

      return false;
    }
  }
}
