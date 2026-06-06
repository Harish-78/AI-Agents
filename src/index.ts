import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import semanticRouter from "./routes/semantic-search.route";
import logger from "./middlewares/logger.middleware";
import requestLogger from "./middlewares/request-logger.middleware";
import ragRouter from "./routes/rag.route";



const app = express();

// ============ MIDDLEWARE ============

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (logs all HTTP requests)
app.use(requestLogger);

// Custom middleware to add request ID for tracking
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', req.headers['x-request-id'] as string);
  next();
});

// ============ ROUTES ============

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('Health check performed', {
    requestId: req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  });
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use("/api/semantic", semanticRouter);
app.use('/api/rag',ragRouter)

// 404 handler for unknown routes
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
    requestId: req.headers['x-request-id'],
    ip: req.ip
  });
  res.status(404).json({ error: 'Route not found' });
});

// ============ ERROR HANDLING ============

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, {
    requestId: req.headers['x-request-id'],
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    query: req.query
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ SERVER STARTUP ============

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info("Received shutdown signal, closing server gracefully...");

  server.close(() => {
    logger.info("Server closed successfully");
    process.exit(0);
  });

  // Force close after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error(
      "Could not close connections in time, forcefully shutting down",
    );
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
});

// Helper function to generate request ID
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export default app;