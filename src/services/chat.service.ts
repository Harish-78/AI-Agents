// src/services/chat.service.ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Document } from "@langchain/core/documents";

export class ChatService {
  private model: ChatGoogleGenerativeAI;

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash-preview",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1,
      maxOutputTokens: 2048,
    });
  }

  async generateResponse(query: string, contextDocs: Document[]): Promise<any> {
    // Prepare context
    const context = contextDocs
      .map((doc, i) => {
        const source = doc.metadata.source;
        return `[${i + 1}] From ${source}:\n${doc.pageContent}\n`;
      })
      .join("\n");

    // Build prompt
    const prompt = `You are a helpful assistant. Answer the question based ONLY on the context below.

Context:
${context}

Question: ${query}

Answer based only on the context above:`;

    // Generate response
    const response = await this.model.invoke(prompt);
    
    // Prepare sources
    const sources = contextDocs.map(doc => ({
      source: doc.metadata.source,
      content: doc.pageContent.substring(0, 200) + "...",
    }));

    return {
      query,
      answer: response.content.toString(),
      sources,
      metadata: {
        retrievedCount: contextDocs.length,
        modelUsed: "gemini-2.0-flash-exp",
      },
    };
  }
}