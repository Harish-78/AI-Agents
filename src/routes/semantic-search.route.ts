import { fetchAllDocuments, insertDocument, searchDocument } from "../controllers/semantic-search.controller"


const express = require("express")
const semanticRouter = express.Router()


semanticRouter.post("/", insertDocument)
semanticRouter.get("/",fetchAllDocuments)
semanticRouter.get("/search",searchDocument );


export default semanticRouter