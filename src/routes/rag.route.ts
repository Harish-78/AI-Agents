// src/routes/chat.routes.ts
import { Router } from "express";
import {
  processDocuments,
  queryDocuments,
  getStats,
  clearDocuments,
} from "../controllers/rag.controller";

const ragRouter = Router();

ragRouter.post("/process", processDocuments);
ragRouter.post("/query", queryDocuments);
ragRouter.get("/stats", getStats);
ragRouter.delete("/clear", clearDocuments);

export default ragRouter;
