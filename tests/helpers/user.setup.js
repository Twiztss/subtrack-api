/**
 * Test Setup for User Test Suites
 *
 * Provides everything that tests/user/*.test.js need:
 *   - A mutable testContext carrying the shared test user and auth token
 *   - setupTests()        → beforeAll: database + auth user (no category needed)
 *   - teardownTests()     → afterAll:  disconnect + stop server
 *   - cleanupExtraUsers() → afterEach: remove every user except testContext.testUser
 *   - createTestUser()    → direct DB insertion of a secondary user
 *   - createTestUsers()   → bulk DB insertion of users
 *   - getAuthHeaders()    → convenience helper for Authorization header
 *
 * Import this file in user tests.
 * Do NOT import subscription-setup.js or test-setup.js directly from test files.
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/env.js';
import User from '../../models/user.model.js';
import { setupDatabase, teardownDatabase } from './test.setup.js';

// ─── Shared context ───────────────────────────────────────────────────────────

/**
 * Mutable context object shared across all tests in a user suite.
 *
 * Fields:
 *   authToken – JWT signed for testUser; used in Authorization headers
 *   testUser  – The persistent User document created in setupTests()
 *
 * NOTE: testCategory is intentionally absent.  User tests have no dependency
 * on Category documents; keeping it out prevents accidental misuse.
 */
export const testContext = {
  authToken: null,
  testUser: null,
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Full beforeAll setup for user suites:
 *   1. Start MongoMemoryReplSet → connect Mongoose
 *   2. Create the persistent test user and mint a 1-hour JWT
 *
 * Category setup is intentionally omitted – user tests never reference
 * Category documents, and including one would widen the blast radius of bugs.
 */
export const setupTests = async () => {
  await setupDatabase();

  testContext.testUser = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    // Plain-text password is intentional: the persistent user is only used
    // to generate a valid auth token, not to test bcrypt behaviour.
    password: 'hashedPassword123',
  });

  testContext.authToken = jwt.sign(
    { userId: testContext.testUser._id, email: testContext.testUser.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

/**
 * Full afterAll teardown: disconnect Mongoose and stop the in-memory server.
 */
export const teardownTests = async () => {
  await teardownDatabase();
};

// ─── Per-test cleanup ─────────────────────────────────────────────────────────

/**
 * afterEach cleanup for user suites.
 *
 * Removes every User document EXCEPT testContext.testUser so that users
 * created during a test (directly or via the sign-up endpoint) are gone
 * before the next test runs.
 *
 * The filter uses `_id: { $ne: ... }` rather than email so this helper
 * stays correct even if a test changes the test user's email or name.
 */
export const cleanupExtraUsers = async () => {
  if (testContext.testUser) {
    await User.deleteMany({ _id: { $ne: testContext.testUser._id } });
  }
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a pre-filled Authorization header object.
 * @returns {{ Authorization: string }}
 */
export const getAuthHeaders = () => ({
  Authorization: `Bearer ${testContext.authToken}`,
});

// ─── User factory helpers ─────────────────────────────────────────────────────

/**
 * Insert a secondary User document directly into the database,
 * bypassing the HTTP layer and the sign-up transaction flow.
 *
 * These users exist only to exercise retrieve / update / delete endpoints.
 * Passwords are stored as plain text on purpose – tests that need a real
 * bcrypt hash create their own user inline (see update.test.js password tests).
 *
 * @param {Object} data - Fields to merge over the defaults
 * @returns {Promise<import('mongoose').Document>} Saved User document
 */
export const createTestUser = async (data = {}) => {
  const defaultData = {
    name: 'Secondary Test User',
    email: 'secondary@example.com',
    password: 'TestPassword123',
  };

  return await User.create({ ...defaultData, ...data });
};

/**
 * Insert multiple User documents at once.
 *
 * @param {Array<Object>} usersData - Array of user data objects
 * @returns {Promise<Array>} Inserted User documents
 */
export const createTestUsers = async (usersData) => {
  return await User.insertMany(usersData);
};
