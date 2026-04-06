/**
 * Integration Tests for PUT /api/v1/user/:id/edit
 * Tests for updating user profile fields
 *
 * Coverage:
 *   - Smoke testing  : update name, email, and password individually
 *   - DB integration : persistence verified via direct model query; password rehash
 *   - Error handling : empty body, same-password guard, non-existent ID, auth errors
 *   - Boundary tests : name at min / max length, invalid ObjectId
 *
 * Strategy: each test creates its own `targetUser` via `createTestUser` so that
 * `testContext.testUser` remains unchanged and the shared auth token stays valid
 * across the entire suite.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../../app.js';
import User from '../../models/user.model.js';
import {
  setupTests,
  teardownTests,
  cleanupExtraUsers,
  createTestUser,
  testContext,
} from '../helpers/user.setup.js';
import { createUserData } from '../fixtures/user.fixtures.js';

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
// PUT /api/v1/user/:id/edit
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/v1/user/:id/edit - Update User', () => {

  // ── Smoke Tests ────────────────────────────────────────────────────────────

  it('should update the user name and return the updated document', async () => {
    // Arrange: a dedicated user so testContext.testUser is not mutated
    const targetUser = await createTestUser(createUserData({ email: 'update.name@example.com' }));

    // Act
    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Updated Name' })
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Updated Name');
  });

  it('should update the user email and return the updated document', async () => {
    // Arrange
    const targetUser = await createTestUser(createUserData({ email: 'old.email@example.com' }));

    // Act
    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ email: 'new.email@example.com' })
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('new.email@example.com');
  });

  it('should rehash the password when a new password is provided', async () => {
    // Arrange: create a user with a known bcrypt hash so the "same password"
    // guard in the controller can compare properly
    const originalPassword = 'OriginalPass1';
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(originalPassword, salt);

    const targetUser = await User.create({
      name: 'Rehash User',
      email: 'rehash@example.com',
      password: hashed,
    });

    const newPassword = 'NewSecurePass2';

    // Act
    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ password: newPassword })
      .expect(200);

    // Assert: the DB now holds a valid bcrypt hash of the new password
    expect(response.body.success).toBe(true);
    const updatedRecord = await User.findById(targetUser._id);
    expect(updatedRecord.password).not.toBe(newPassword);
    const isMatch = await bcrypt.compare(newPassword, updatedRecord.password);
    expect(isMatch).toBe(true);
  });

  // ── DB Integration ─────────────────────────────────────────────────────────

  it('should persist updates to the database', async () => {
    // Arrange
    const targetUser = await createTestUser(createUserData({ email: 'persist.update@example.com' }));

    // Act
    await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Persisted Name' })
      .expect(200);

    // Assert: query the DB directly to confirm the write
    const dbUser = await User.findById(targetUser._id);
    expect(dbUser.name).toBe('Persisted Name');
  });

  it('should update only the supplied fields and leave others unchanged', async () => {
    // Arrange
    const targetUser = await createTestUser(
      createUserData({ email: 'partial.update@example.com', name: 'Original Name' })
    );
    const originalEmail = targetUser.email;

    // Act: only update name
    await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'New Name Only' })
      .expect(200);

    // Assert: email is unchanged
    const dbUser = await User.findById(targetUser._id);
    expect(dbUser.name).toBe('New Name Only');
    expect(dbUser.email).toBe(originalEmail);
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('should return 400 when the request body contains no update fields', async () => {
    // The controller explicitly checks for an empty updateFields object
    const targetUser = await createTestUser(createUserData({ email: 'nofields@example.com' }));

    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/no valid fields/i);
  });

  it('should return 401 when the new password is identical to the current password', async () => {
    // Arrange: create a user whose password is bcrypt-hashed so the controller
    // can use bcrypt.compare() correctly
    const plainPassword = 'SamePassword1';
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(plainPassword, salt);

    const targetUser = await User.create({
      name: 'Same Pass User',
      email: 'same.pass@example.com',
      password: hashed,
    });

    // Act: attempt to "change" the password to the same value
    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ password: plainPassword })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/not be the same/i);
  });

  it('should return 404 when the target user ID does not exist in the database', async () => {
    // Use a valid ObjectId that is guaranteed not to be present
    const nonExistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .put(`/api/v1/user/${nonExistentId}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Ghost User' })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/not found/i);
  });

  it('should return 401 when no authorization token is provided', async () => {
    const response = await request(app)
      .put(`/api/v1/user/${testContext.testUser._id}/edit`)
      .send({ name: 'Unauthorized' })
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('should return 401 when the authorization token is malformed', async () => {
    const response = await request(app)
      .put(`/api/v1/user/${testContext.testUser._id}/edit`)
      .set('Authorization', 'Bearer totally-wrong-token')
      .send({ name: 'Bad Token' })
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  // ── Boundary Tests ─────────────────────────────────────────────────────────

  it('should accept a name update at the minimum length boundary (2 chars)', async () => {
    const targetUser = await createTestUser(createUserData({ email: 'boundary.min@example.com' }));

    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'AB' }) // exactly 2 chars
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('AB');
  });

  it('should reject a name update that exceeds the maximum length (51 chars)', async () => {
    const targetUser = await createTestUser(createUserData({ email: 'boundary.max@example.com' }));

    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'A'.repeat(51) }) // one over maxLength: 50
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });

  it('should return 404 when the user ID is not a valid ObjectId format', async () => {
    // CastError from Mongoose → mapped to 404 by error middleware
    const response = await request(app)
      .put('/api/v1/user/not-an-object-id/edit')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Cast Error' })
      .expect(404);

    expect(response.body.success).toBe(false);
  });
});
