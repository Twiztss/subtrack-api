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
 * NOTE: MongoMemoryReplSet (single-node replica set) is used instead of the
 * standalone MongoMemoryServer because several controllers use mongoose
 * sessions and multi-document transactions, which MongoDB only supports on
 * replica set members.
 */

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let mongoServer;

/**
 * Spin up an in-memory replica set and connect Mongoose to it.
 * Should be called by suite-specific setupTests() inside a `beforeAll` hook.
 */
export const setupDatabase = async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(mongoUri);
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
