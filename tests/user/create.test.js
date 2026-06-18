/**
 * Integration Tests for POST /api/v1/auth/sign-up
 * Tests for creating new user accounts through the registration endpoint
 *
 * Coverage:
 *   - Smoke testing  : happy-path registration flow
 *   - Error handling : duplicate email, missing/invalid fields, empty body
 *   - Boundary tests : name/password at min and max length constraints
 *   - DB integration : password hashing, document persistence, field exposure
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../app.js';
import User from '../../models/user.model.js';
import {
  setupTests,
  teardownTests,
  cleanupExtraUsers,
  testContext,
} from '../helpers/user.setup.js';
import {
  createUserData,
  invalidUserData,
  boundaryUserData,
} from '../fixtures/user.fixtures.js';

/**
 * Setup: spin up the in-memory replica set, create the base test user,
 * and generate its auth token.  Called once for the whole suite.
 */
beforeAll(async () => {
  await setupTests();
});

/**
 * Per-test cleanup: remove every User document except testContext.testUser.
 * Ensures no user created during a test leaks into the next one.
 */
afterEach(async () => {
  await cleanupExtraUsers();
});

/**
 * Teardown: close mongoose and stop the in-memory server.
 */
afterAll(async () => {
  await teardownTests();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/sign-up
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/sign-up - User Registration', () => {

  // ── Smoke Tests ────────────────────────────────────────────────────────────

  it('should register a new user and return 201 with correct response shape', async () => {
    // Arrange: unique email so it never conflicts with testContext.testUser
    const userData = createUserData({ email: 'newuser@example.com' });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(userData)
      .expect('Content-Type', /json/)
      .expect(201);

    // Assert: top-level response shape
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'User created successfully');
    expect(response.body).toHaveProperty('data');

    // Assert: payload contains a token and a user object
    const { token, user } = response.body.data;
    expect(token).toBeDefined();
    expect(user).toBeDefined();
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('newuser@example.com');
  });

  it('should return a non-empty JWT string upon successful registration', async () => {
    // Arrange
    const userData = createUserData({ email: 'jwt.test@example.com' });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(userData)
      .expect(201);

    // Assert: token must be a non-empty string (JWT format: three base64 segments)
    const { token } = response.body.data;
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('should store the password as a bcrypt hash, not as plain text', async () => {
    // Arrange
    const plainPassword = 'PlainTextPass1';
    const userData = createUserData({ email: 'hashcheck@example.com', password: plainPassword });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(userData)
      .expect(201);

    // Fetch the raw record with password explicitly selected (select:false by default)
    const savedUser = await User.findById(response.body.data.user._id).select('+password');

    // Assert: stored value is a bcrypt hash, not the original plain text
    expect(savedUser.password).not.toBe(plainPassword);
    expect(savedUser.password).toMatch(/^\$2[ab]\$/); // bcrypt hash prefix
    const isMatch = await bcrypt.compare(plainPassword, savedUser.password);
    expect(isMatch).toBe(true);
  });

  it('should not expose the password field in the response body', async () => {
    // Arrange
    const userData = createUserData({ email: 'nopwd@example.com' });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(userData)
      .expect(201);

    // Assert: password must be absent from the returned user object
    expect(response.body.data.user).not.toHaveProperty('password');
  });

  it('should persist the new user document in the database', async () => {
    // Arrange
    const userData = createUserData({ email: 'persist@example.com' });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(userData)
      .expect(201);

    // Assert: confirm the document was actually written
    const savedUser = await User.findById(response.body.data.user._id);
    expect(savedUser).toBeTruthy();
    expect(savedUser.email).toBe('persist@example.com');
  });

  // ── Duplicate / Conflict ───────────────────────────────────────────────────

  it('should return 409 when registering with an email that already exists', async () => {
    // Arrange: first successful registration
    await request(app)
      .post('/api/v1/auth/sign-up')
      .send(createUserData({ email: 'duplicate@example.com' }))
      .expect(201);

    // Act: second attempt with the same email
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(createUserData({ email: 'duplicate@example.com' }))
      .expect(409);

    // Assert
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/already exist/i);

    // Only one user with that email should exist
    const count = await User.countDocuments({ email: 'duplicate@example.com' });
    expect(count).toBe(1);
  });

  // ── Validation / Error Handling ────────────────────────────────────────────

  it('should return 400 when the name field is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(invalidUserData.missingName)
      .expect(400);

    expect(response.body.success).toBeFalsy();
    // No user should have been created
    const count = await User.countDocuments({ email: invalidUserData.missingName.email });
    expect(count).toBe(0);
  });

  it('should return 400 when the email field is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(invalidUserData.missingEmail)
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });

  it('should return 400 when the password field is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(invalidUserData.missingPassword)
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });

  it('should return 400 when the email format is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(invalidUserData.invalidEmail)
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });

  it('should return 400 when the request body is completely empty', async () => {
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(invalidUserData.emptyBody)
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });

  // ── Boundary Tests ─────────────────────────────────────────────────────────

  it('should accept a name exactly at the minimum length boundary (2 chars)', async () => {
    // boundaryUserData.minValidName has name = "AB"
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(boundaryUserData.minValidName)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.name).toBe('AB');
  });

  it('should accept a name exactly at the maximum length boundary (50 chars)', async () => {
    // boundaryUserData.maxValidName has name = 'A'.repeat(50)
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(boundaryUserData.maxValidName)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.name.length).toBe(50);
  });

  it('should reject a name exceeding the maximum length (51 chars)', async () => {
    // boundaryUserData.nameTooLong has name = 'A'.repeat(51)
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(boundaryUserData.nameTooLong)
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });

  it('should reject a name shorter than the minimum length (1 char)', async () => {
    // invalidUserData.shortName has name = 'A'
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(invalidUserData.shortName)
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });

  it('should accept a password exactly at the minimum length boundary (6 chars)', async () => {
    // boundaryUserData.minValidPassword has password = 'abc123'
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(boundaryUserData.minValidPassword)
      .expect(201);

    expect(response.body.success).toBe(true);
  });

  it('should reject a password shorter than the minimum length (5 chars)', async () => {
    // invalidUserData.shortPassword has password = '12345'
    const response = await request(app)
      .post('/api/v1/auth/sign-up')
      .send(invalidUserData.shortPassword)
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });
});
