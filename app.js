// ESM Import
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { PORT, NODE_ENV } from './config/env.js';
import process from 'process';

// Router Import
import indexRouter from './routes/index.js';
import userRouter from './routes/user.js';
import authRouter from './routes/auth.js';
import subscriptionRouter from './routes/subscription.js'
import workflowRouter from './routes/workflow.js';
import categoryRouter from './routes/category.js';

// Middlewares
import errorHandler from './middlewares/error.middleware.js';

/**
 * Create and configure Express application
 * This function is exported for testing purposes
 */
export function createApp() {
  const app = express();

  // Logging Middleware
  if (NODE_ENV === 'development') { app.use(logger('dev')); }
  else if (NODE_ENV === 'production') { app.use(logger('combined')); }
  else if (NODE_ENV !== 'test') { console.log('Logging is disabled in', NODE_ENV); }

  // For logging in non-production environments
  if (process.env.NODE_ENV !== "production") {
    app.use((req, res, next) => {
      const spoofedIp = `203.0.113.${Math.floor(Math.random() * 100)}`;
      req.headers["x-forwarded-for"] = spoofedIp;
      next();
    });
  }

  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.set('trust proxy', true);
  app.use(express.json());

  app.use('/', indexRouter);
  app.use('/api/v1/user', userRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/subscription', subscriptionRouter);
  app.use('/api/v1/workflow', workflowRouter);
  app.use('/api/v1/category', categoryRouter);

  app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.statusCode = 404;
    next(err);
  });
  app.use(errorHandler);

  return app;
}

// Create app instance
const app = createApp();

// Only start server if not in test mode
if (NODE_ENV !== 'test') {
  const connectToDatabase = (await import('./database/mongodb.js')).default;
  
  app.listen(PORT, async () => {
    console.log(`Subscription Tracker running on https://localhost:${PORT}.`);
    await connectToDatabase();
  });
}

export default app;
