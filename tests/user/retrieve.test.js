/**
 * Integration Tests for:
 *   GET /api/v1/user        – list all users (no authentication required)
 *   GET /api/v1/user/:id    – retrieve a single user (authentication required)
 *
 * Coverage:
 *   - Smoke testing  : happy-path retrieval, correct response shape
 *   - Schema checks  : expected fields present, password excluded
 *   - Error handling : non-existent ID, invalid ObjectId, missing/invalid token
 *   - Boundary tests : correct document returned when multiple users exist;
 *                      valid ObjectId that is absent from the database
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app.js';
import {
  setupTests,
  teardownTests,
  cleanupExtraUsers,
  createTestUser,
  testContext,
} from '../helpers/user.setup.js';
import {
  commonUsers,
  validateUserStructure,
  expectedUserResponseStructure,
} from '../fixtures/user.fixtures.js';

beforeAll(async () => {
  await setupTests();
});

afterEach(async () => {
  await cleanupExtraUsers();
});

afterAll(async () => {
  await teardownTests();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/user  –  list all users
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/user - Retrieve All Users', () => {

  it('should return 200 and an array of users', async () => {
    // Arrange: add two extra users so there are at least three total
    await createTestUser(commonUsers.alice);
    await createTestUser(commonUsers.bob);

    // Act
    const response = await request(app)
      .get('/api/v1/user')
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert: top-level structure
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    // testContext.testUser + alice + bob = at least 3
    expect(response.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('should return at least one user when the baseline test user exists', async () => {
    // Arrange: only testContext.testUser is present (afterEach cleans extras)
    const response = await request(app)
      .get('/api/v1/user')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should be accessible without an authorization token', async () => {
    // The route is intentionally public: no authorize middleware
    const response = await request(app)
      .get('/api/v1/user')
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should include core user fields in each returned document', async () => {
    // Arrange
    await createTestUser(commonUsers.charlie);

    // Act
    const response = await request(app)
      .get('/api/v1/user')
      .expect(200);

    // Assert: every object in the array has at least _id, name, email
    response.body.data.forEach((user) => {
      expect(user).toHaveProperty('_id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/user/:id  –  single user (auth required)
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/user/:id - Retrieve Single User', () => {

  // ── Smoke Tests ────────────────────────────────────────────────────────────

  it('should return 200 with the correct user and expected response shape', async () => {
    // Act: fetch the baseline test user
    const response = await request(app)
      .get(`/api/v1/user/${testContext.testUser._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert: structural match
    expect(response.body).toMatchObject(expectedUserResponseStructure);
    expect(response.body.success).toBe(true);

    // Assert: correct document returned
    const { data } = response.body;
    expect(data._id).toBe(testContext.testUser._id.toString());
    expect(data.name).toBe(testContext.testUser.name);
    expect(data.email).toBe(testContext.testUser.email);
  });

  it('should not expose the password field in the response', async () => {
    const response = await request(app)
      .get(`/api/v1/user/${testContext.testUser._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: the controller uses .select('-password') on this endpoint
    expect(response.body.data).not.toHaveProperty('password');
  });

  it('should include all expected schema fields in the response', async () => {
    const response = await request(app)
      .get(`/api/v1/user/${testContext.testUser._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Delegate field-level assertions to the shared validator
    validateUserStructure(response.body.data);
  });

  it('should include ISO timestamps (createdAt, updatedAt) in the response', async () => {
    const response = await request(app)
      .get(`/api/v1/user/${testContext.testUser._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    const { data } = response.body;
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('updatedAt');
    // Verify they parse as valid dates
    expect(new Date(data.createdAt).toString()).not.toBe('Invalid Date');
    expect(new Date(data.updatedAt).toString()).not.toBe('Invalid Date');
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('should return 404 when the user ID is a valid ObjectId but does not exist', async () => {
    // A freshly generated ObjectId is guaranteed not to be in the database
    const nonExistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .get(`/api/v1/user/${nonExistentId}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/not found/i);
  });

  it('should return 404 when the user ID is not a valid ObjectId format', async () => {
    // Mongoose throws a CastError for malformed IDs; the error middleware
    // maps CastError → 404 with message "Resource not found"
    const response = await request(app)
      .get('/api/v1/user/not-a-valid-object-id')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  it('should return 401 when no authorization token is provided', async () => {
    const response = await request(app)
      .get(`/api/v1/user/${testContext.testUser._id}`)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Unauthorized');
  });

  it('should return 401 when an invalid (malformed) token is provided', async () => {
    const response = await request(app)
      .get(`/api/v1/user/${testContext.testUser._id}`)
      .set('Authorization', 'Bearer this.is.not.a.real.jwt')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('jwt malformed');
  });

  // ── Boundary Tests ─────────────────────────────────────────────────────────

  it('should return only the queried user when multiple users exist (ID isolation)', async () => {
    // Arrange: create an extra user to populate the collection
    const extraUser = await createTestUser(commonUsers.alice);

    // Act: query specifically for the extra user
    const response = await request(app)
      .get(`/api/v1/user/${extraUser._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: response contains only the queried document, not testUser
    expect(response.body.data._id).toBe(extraUser._id.toString());
    expect(response.body.data.email).toBe(commonUsers.alice.email);
    expect(response.body.data._id).not.toBe(testContext.testUser._id.toString());
  });

  it('should still return 404 for a deleted user ID (no stale cache)', async () => {
    // Arrange: create and immediately delete a user
    const tempUser = await createTestUser(commonUsers.bob);
    const deletedId = tempUser._id;
    await tempUser.deleteOne();

    // Act: query the now-deleted ID
    const response = await request(app)
      .get(`/api/v1/user/${deletedId}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
  });
});
