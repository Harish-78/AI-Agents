
import winston from 'winston';

// Define custom log levels (optional - Winston has defaults)
const customLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for different levels
const customColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(customColors);

// Format for development (pretty, colored)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Format for production (JSON structured logging)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';

// Create the logger
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  levels: customLevels,
  format: isProduction ? productionFormat : developmentFormat,
  transports: [
    // Console transport (always active)
    new winston.transports.Console({
      format: isProduction ? productionFormat : developmentFormat,
    }),
  ],
});




process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

export default logger;