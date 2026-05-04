import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, splat, json } = winston.format;

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_, currentValue) => {
      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) {
          return '[Circular]';
        }
        seen.add(currentValue);
      }
      return currentValue;
    });
  } catch {
    return '[Unserializable metadata]';
  }
}

const logFormat = printf((info) => {
  const {
    level,
    message,
    timestamp: logTimestamp,
    stack,
    ...meta
  } = info;

  const metaString = Object.keys(meta).length > 0 ? ` ${safeStringify(meta)}` : '';
  return `${logTimestamp} [${level}]: ${stack || message}${metaString}`;
});

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

const baseFormat = combine(
  errors({ stack: true }),
  splat(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
);

// Define transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction
      ? combine(baseFormat, json())
      : combine(baseFormat, colorize(), logFormat)
  })
];

// Only add file transports if not in production/Vercel
if (!isProduction) {
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
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction
    ? combine(baseFormat, json())
    : combine(baseFormat, logFormat),
  transports,
  exceptionHandlers: isProduction ? [] : [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: isProduction ? [] : [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});
