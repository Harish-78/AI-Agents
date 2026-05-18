import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import semanticRouter from "./routes/semantic-search.route";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/semantic", semanticRouter);
 
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
 