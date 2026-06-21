/**
 * Shared Database Infrastructure
 *
 * Low-level database lifecycle primitives shared by all test suites.
 * This file intentionally contains NO test context, NO per-suite cleanup,
 * and NO data factory helpers.  Those belong in the suite-specific files:
 *
 *   - tests/helpers/subscription-setup.js  → subscription test suites
 *   - tests/helpers/user-setup.js          → user test suites
 *
 * Do NOT import this file directly from test files.
 *
 * NOTE: A standalone MongoMemoryServer is used (not a replica set) because
 * no controller uses multi-document transactions; every write is a single,
 * already-atomic operation.  The replica-set approach caused 30s server-
 * selection timeouts on Windows because the single-node set never elected a
 * usable primary for transactions.
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

/**
 * Spin up a standalone in-memory MongoDB and connect Mongoose to it.
 * Should be called by suite-specific setupTests() inside a `beforeAll` hook.
 */
export const setupDatabase = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // serverSelectionTimeoutMS: 5000 ensures any future connection problems
  // fail fast rather than hanging for the 30s MongoDB default.
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.syncIndexes();
};

/**
 * Disconnect Mongoose and stop the in-memory replica set.
 * Should be called by suite-specific teardownTests() inside an `afterAll` hook.
 */
export const teardownDatabase = async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
};
