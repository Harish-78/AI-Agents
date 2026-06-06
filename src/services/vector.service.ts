// src/services/vector.service.ts
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { Document } from "@langchain/core/documents";

export class VectorService {
  private embeddings: GoogleGenerativeAIEmbeddings;
  private collectionName: string;

  constructor() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      model: "embedding-001",
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      apiKey: process.env.GEMINI_API_KEY,
    
    });
    this.collectionName = "documents";
  } 

  async storeDocuments(documents: Document[]): Promise<void> {
    await Chroma.fromDocuments(documents, this.embeddings, {
      collectionName: this.collectionName,
      url: `http://${process.env.CHROMA_HOST || "localhost"}:${process.env.CHROMA_PORT || "8000"}`,
    });
  }

  async similaritySearch(query: string, topK: number = 5): Promise<Document[]> {
    const vectorStore = new Chroma(this.embeddings, {
      collectionName: this.collectionName,
      url: `http://${process.env.CHROMA_HOST || "localhost"}:${process.env.CHROMA_PORT || "8000"}`,
    });
    
    return await vectorStore.similaritySearch(query, topK);
  }

  async getStats(): Promise<any> {
    // Simple stats - you can enhance this
    return {
      collectionName: this.collectionName,
      status: "active",
    };
  }

  async clearCollection(): Promise<void> {
    // Recreate collection (simplest way to clear)
    const vectorStore = new Chroma(this.embeddings, {
      collectionName: this.collectionName,
      url: `http://${process.env.CHROMA_HOST || "localhost"}:${process.env.CHROMA_PORT || "8000"}`,
    });
    
    // Delete and recreate
    try {
       // Get all documents from the collection
    const collection = await (vectorStore as any).ensureCollection();
    
    // Get all document IDs
    const allDocs = await collection.get();
    const ids = allDocs.ids;
    
    // Delete documents by IDs (delete requires params)
    if (ids && ids.length > 0) {
      await vectorStore.delete({ ids });
      console.log(`Deleted ${ids.length} documents from ${this.collectionName}`);
    }
    
    console.log(`Collection ${this.collectionName} cleared`);
    } catch (error) {
      // Collection might not exist
    }
  }
}