// ESM Import
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import logger from 'morgan';
import { PORT, NODE_ENV, ENABLE_ARCJET } from './config/env.js';

// Router Import
import indexRouter from './routes/index.js';
import userRouter from './routes/user.js';
import authRouter from './routes/auth.js';
import subscriptionRouter from './routes/subscription.js'
import workflowRouter from './routes/workflow.js';
import categoryRouter from './routes/category.js';

// Middlewares
import errorHandler from './middlewares/error.middleware.js';
import arcjetMiddleware from './middlewares/arcjet.middleware.js';

/**
 * Create and configure Express application
 * This function is exported for testing purposes
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  // Logging Middleware
  if (NODE_ENV === 'development') { app.use(logger('dev')); }
  else if (NODE_ENV === 'production') { app.use(logger('combined')); }
  else if (NODE_ENV !== 'test') { console.log('Logging is disabled in', NODE_ENV); }

  app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));
  app.use(cookieParser());
  // Trust exactly one upstream proxy hop (e.g. a load balancer / reverse proxy).
  // Using `true` would trust all X-Forwarded-For headers including client-supplied ones.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  // Rate limiting, bot detection, and shield protection via Arcjet (opt-in)
  if (NODE_ENV !== 'test' && ENABLE_ARCJET === 'true') {
    app.use(arcjetMiddleware);
  }

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
