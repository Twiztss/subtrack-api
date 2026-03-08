/**
 * Test Setup for Subscription Test Suites
 *
 * Provides everything that tests/subscription/*.test.js need:
 *   - A mutable testContext carrying the shared test user, auth token, and category
 *   - setupTests()              → beforeAll: database + auth user + base category
 *   - teardownTests()           → afterAll:  disconnect + stop server
 *   - cleanupTestData()         → afterEach: wipe subscriptions & categories,
 *                                            then restore the base category
 *   - createTestSubscription()  → direct DB insertion of a single subscription
 *   - createTestSubscriptions() → bulk DB insertion of subscriptions
 *   - getAuthHeaders()          → convenience helper for Authorization header
 *
 * Import this file in subscription tests.
 * Do NOT import user-setup.js or test-setup.js directly from test files.
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/env.js';
import User from '../../models/user.model.js';
import Category from '../../models/category.model.js';
import Subscription from '../../models/subscription.model.js';
import { setupDatabase, teardownDatabase } from './test.setup.js';

// ─── Shared context ───────────────────────────────────────────────────────────

/**
 * Mutable context object shared across all tests in a subscription suite.
 *
 * Fields:
 *   authToken   – JWT signed for testUser; used in Authorization headers
 *   testUser    – The persistent User document created in setupTests()
 *   testCategory – The "entertainment" Category document; recreated after each
 *                  test by cleanupTestData() so foreign-key references stay valid
 */
export const testContext = {
  authToken: null,
  testUser: null,
  testCategory: null,
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Full beforeAll setup for subscription suites:
 *   1. Start MongoMemoryReplSet → connect Mongoose
 *   2. Create the persistent test user and mint a 1-hour JWT
 *   3. Create the base "entertainment" category referenced by subscription fixtures
 */
export const setupTests = async () => {
  await setupDatabase();

  testContext.testUser = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    // Plain-text password is intentional: these tests exercise subscription
    // behaviour, not bcrypt or auth logic on this particular user.
    password: 'hashedPassword123',
  });

  testContext.authToken = jwt.sign(
    { userId: testContext.testUser._id, email: testContext.testUser.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  testContext.testCategory = await Category.create({ name: 'entertainment' });
};

/**
 * Full afterAll teardown: disconnect Mongoose and stop the in-memory server.
 */
export const teardownTests = async () => {
  await teardownDatabase();
};

// ─── Per-test cleanup ─────────────────────────────────────────────────────────

/**
 * afterEach cleanup for subscription suites.
 *
 * Removes ALL Subscription and Category documents so that each test starts
 * from a clean slate.  The base "entertainment" category is then recreated so
 * that factory helpers (createTestSubscription / createTestSubscriptions) can
 * still attach a valid category reference in subsequent tests.
 */
export const cleanupTestData = async () => {
  await Subscription.deleteMany({});
  await Category.deleteMany({});
  testContext.testCategory = await Category.create({ name: 'entertainment' });
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a pre-filled Authorization header object.
 * @returns {{ Authorization: string }}
 */
export const getAuthHeaders = () => ({
  Authorization: `Bearer ${testContext.authToken}`,
});

// ─── Subscription factory helpers ─────────────────────────────────────────────

/**
 * Insert a single Subscription document directly into the database,
 * bypassing the HTTP layer.
 *
 * Defaults pull category and user from testContext so callers only need to
 * supply the fields that are relevant to the test being written.
 *
 * @param {Object} data - Fields to merge over the defaults
 * @returns {Promise<import('mongoose').Document>} Saved Subscription document
 */
export const createTestSubscription = async (data = {}) => {
  const defaultData = {
    name: 'Test Subscription',
    price: '9.99',
    category: testContext.testCategory._id,
    frequency: 'monthly',
    startDate: new Date('2026-02-01'),
    renewalDate: new Date('2026-03-01'),
    user: testContext.testUser._id,
  };

  return await Subscription.create({ ...defaultData, ...data });
};

/**
 * Insert multiple Subscription documents at once.
 *
 * Each entry is merged with category and user from testContext, so callers
 * only need to supply fields that vary between subscriptions.
 *
 * @param {Array<Object>} subscriptionsData - Array of partial subscription objects
 * @returns {Promise<Array>} Inserted Subscription documents
 */
export const createTestSubscriptions = async (subscriptionsData) => {
  const subscriptionsWithDefaults = subscriptionsData.map((data) => ({
    category: testContext.testCategory._id,
    user: testContext.testUser._id,
    ...data,
  }));

  return await Subscription.insertMany(subscriptionsWithDefaults);
};
