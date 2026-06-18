/**
 * Integration Tests for PUT /api/v1/user/:id/edit
 * Tests for updating user profile fields
 *
 * Coverage:
 *   - Smoke testing  : update name, email, and password individually
 *   - DB integration : persistence verified via direct model query; password rehash
 *   - Error handling : empty body, same-password guard, non-existent ID, auth errors,
 *                      attempt to edit another user (403)
 *   - Boundary tests : name at min / max length, invalid ObjectId
 *
 * Security model: users may only edit their own account.
 * Each test that performs a successful edit creates a dedicated user + token.
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
  createAuthenticatedUser,
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
    // Arrange: a dedicated user that can edit itself
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'update.name@example.com' })
    );

    // Act
    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ name: 'Updated Name' })
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Updated Name');
  });

  it('should update the user email and return the updated document', async () => {
    // Arrange
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'old.email@example.com' })
    );

    // Act
    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ email: 'new.email@example.com' })
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('new.email@example.com');
  });

  it('should rehash the password when a new password is provided', async () => {
    // Arrange: create a user with a known bcrypt hash so the same-password
    // guard in the controller can compare properly
    const originalPassword = 'OriginalPass1';
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(originalPassword, salt);

    const { user: targetUser, token: targetToken } = await createAuthenticatedUser({
      name: 'Rehash User',
      email: 'rehash@example.com',
      password: hashed,
    });

    const newPassword = 'NewSecurePass2';

    // Act
    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ password: newPassword })
      .expect(200);

    // Assert: the DB now holds a valid bcrypt hash of the new password
    expect(response.body.success).toBe(true);
    const updatedRecord = await User.findById(targetUser._id).select('+password');
    expect(updatedRecord.password).not.toBe(newPassword);
    const isMatch = await bcrypt.compare(newPassword, updatedRecord.password);
    expect(isMatch).toBe(true);
  });

  // ── DB Integration ─────────────────────────────────────────────────────────

  it('should persist updates to the database', async () => {
    // Arrange
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'persist.update@example.com' })
    );

    // Act
    await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ name: 'Persisted Name' })
      .expect(200);

    // Assert: query the DB directly to confirm the write
    const dbUser = await User.findById(targetUser._id);
    expect(dbUser.name).toBe('Persisted Name');
  });

  it('should update only the supplied fields and leave others unchanged', async () => {
    // Arrange
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'partial.update@example.com', name: 'Original Name' })
    );
    const originalEmail = targetUser.email;

    // Act: only update name
    await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ name: 'New Name Only' })
      .expect(200);

    // Assert: email is unchanged
    const dbUser = await User.findById(targetUser._id);
    expect(dbUser.name).toBe('New Name Only');
    expect(dbUser.email).toBe(originalEmail);
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('should return 400 when the request body contains no update fields', async () => {
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'nofields@example.com' })
    );

    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/no valid fields/i);
  });

  it('should return 400 when the new password is identical to the current password', async () => {
    // Arrange: user with a known bcrypt hash so bcrypt.compare() works
    const plainPassword = 'SamePassword1';
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(plainPassword, salt);

    const { user: targetUser, token: targetToken } = await createAuthenticatedUser({
      name: 'Same Pass User',
      email: 'same.pass@example.com',
      password: hashed,
    });

    // Act: attempt to "change" the password to the same value
    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ password: plainPassword })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/not be the same/i);
  });

  it('should return 403 when a user attempts to edit a different user', async () => {
    // Arrange: create a second user
    const { user: otherUser } = await createAuthenticatedUser(
      createUserData({ email: 'other.user@example.com' })
    );

    // Act: testContext.testUser tries to edit otherUser
    const response = await request(app)
      .put(`/api/v1/user/${otherUser._id}/edit`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Hijacked Name' })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/unauthorized/i);
  });

  it('should return 404 when the target user ID does not exist in the database', async () => {
    // A valid ObjectId that is guaranteed not to be in the database.
    // We sign a JWT for this fictional ID so the ownership check passes.
    const jwt = await import('jsonwebtoken');
    const { JWT_SECRET } = await import('../../config/env.js');
    const nonExistentId = new mongoose.Types.ObjectId();
    const ghostToken = jwt.default.sign({ userId: nonExistentId }, JWT_SECRET, { expiresIn: '1h' });

    const response = await request(app)
      .put(`/api/v1/user/${nonExistentId}/edit`)
      .set('Authorization', `Bearer ${ghostToken}`)
      .send({ name: 'Ghost User' })
      .expect(404);

    // Auth middleware returns 404 because User.findById returns null for an unknown ID
    expect(response.body.success).toBe(false);
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
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'boundary.min@example.com' })
    );

    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ name: 'AB' }) // exactly 2 chars
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('AB');
  });

  it('should reject a name update that exceeds the maximum length (51 chars)', async () => {
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'boundary.max@example.com' })
    );

    const response = await request(app)
      .put(`/api/v1/user/${targetUser._id}/edit`)
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ name: 'A'.repeat(51) }) // one over maxLength: 50
      .expect(400);

    expect(response.body.success).toBeFalsy();
  });

  it('should return 403 when the user ID is not a valid ObjectId format', async () => {
    // The ownership check (req.user.id !== req.params.id) fires before Mongoose
    // processes the malformed ID, so the response is 403 Forbidden, not 404.
    const response = await request(app)
      .put('/api/v1/user/not-an-object-id/edit')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Cast Error' })
      .expect(403);

    expect(response.body.success).toBe(false);
  });
});
