// ESM Import
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { fileURLToPath } from 'url';
import { PORT, NODE_ENV } from './config/env.js';

// Router Import
import indexRouter from './routes/index.js';
import userRouter from './routes/user.js';
import authRouter from './routes/auth.js';
import subscriptionRouter from './routes/subscription.js'
import workflowRouter from './routes/workflow.js';

// Middlewares
import connectToDatabase from './database/mongodb.js';
import errorHandler from './middlewares/error.middleware.js';
import arcjetMiddleware from './middlewares/arcjet.middleware.js';

// Apps
const app = express();

// Paths
const __filename = fileURLToPath(import.meta.url);

// Logging Middleware
if (NODE_ENV === 'development') { app.use(logger('dev')); }
else if (NODE_ENV === 'production') { app.use(logger('combined')); }
else { console.log('Logging is disabled in', NODE_ENV); }

const isDev = NODE_ENV !== "production";

// For logging
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
  const spoofedIp = `203.0.113.${Math.floor(Math.random() * 100)}`;
  req.headers["x-forwarded-for"] = spoofedIp;
  next();
});
}

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(errorHandler);
app.set('trust proxy', true); 
app.use(express.json());
// app.use(arcjetMiddleware);

// Router
app.use('/', indexRouter);

// API Routes
app.use('/api/v1/user', userRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/subscription', subscriptionRouter);
app.use('/api/v1/workflow', workflowRouter);

// Listen
app.listen(PORT , async () => {
    console.log( `Subscription Tracker running on https://localhost:${PORT}.`);

    // Log the datbase
    await connectToDatabase();
})

export default app;
