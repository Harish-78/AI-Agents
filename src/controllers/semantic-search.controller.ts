import { NextFunction, Request, Response } from "express";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatGoogle } from "@langchain/google";
import * as assert from "node:assert";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const documents = [
  new Document({
    pageContent:
      "Dogs are great companions, known for their loyalty and friendliness.",
    metadata: { source: "mammal-pets-doc" },
  }),
  new Document({
    pageContent: "Cats are independent pets that often enjoy their own space.",
    metadata: { source: "mammal-pets-doc" },
  }),
];




export const insertDocument =async(req:Request,res:Response,next:NextFunction)=>{
    try {
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const allSplits = await textSplitter.splitDocuments(documents);

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
});

const vector1 = await embeddings.embedQuery(allSplits[0].pageContent);
const vector2 = await embeddings.embedQuery(allSplits[1].pageContent);

// assert vector1.length === vector2.length;
console.log(`Generated vectors of length ${vector1.length}\n`);
console.log(vector1.slice(0, 10));

return res.status(200).json({
  message: "Document inserted successffully",
  docs: documents,
  allSplits,
});
        
    } catch (error) {
        next(error)
    }
}


export const fetchAllDocuments = async(req:Request,res:Response,next:NextFunction)=>{
    try {
        
    } catch (error) {
        next(error)
    }
}


export const searchDocument = async(req:Request,res:Response,next:NextFunction)=>{
    try {
        
    } catch (error) {
        next(error)
    }
}
