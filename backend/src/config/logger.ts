import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

// Define transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(
      !isProduction ? colorize() : winston.format.uncolorize(),
      logFormat
    )
  })
];

// Always add file transports to ensure persistent logs even in production
transports.push(
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports,
  exceptionHandlers: isProduction ? [] : [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: isProduction ? [] : [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});
