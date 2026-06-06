// src/middlewares/request-logger.middleware.ts
import { Request, Response, NextFunction } from 'express';
import logger from './logger.middleware';

type LogData = Record<string, any>;

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log request start for debugging
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`➡️  ${req.method} ${req.originalUrl} started`, {
      query: req.query,
      body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }
  
  // Capture original end function
  const originalSend = res.send;
  let responseBody: any;
  
  res.send = function(body: any): Response {
    responseBody = body;
    return originalSend.call(this, body);
  };
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    const logLevel = statusCode >= 500 ? 'error' : 
                     statusCode >= 400 ? 'warn' : 
                     'http';
    
    // Build log data dynamically
    const logData: LogData = {
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id']
    };
    
    // Conditionally add optional fields
    if (statusCode >= 400 && responseBody) {
      const bodyStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
      logData.responseBody = bodyStr.substring(0, 500);
    }
    
    if (req.method === 'GET' && Object.keys(req.query).length > 0) {
      logData.query = req.query;
    }
    
    // Log with appropriate level
    const logMessage = `${req.method} ${req.originalUrl} - ${statusCode} (${duration}ms)`;
    const logMethod = logLevel === 'error' ? logger.error : 
                      logLevel === 'warn' ? logger.warn : 
                      logger.http;
    
    logMethod(logMessage, logData);
  });
  
  next();
};

export default requestLogger;