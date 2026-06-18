/**
 * Integration Tests for DELETE /api/v1/user/:id/remove
 * Tests for removing user documents through the HTTP endpoint
 *
 * Coverage:
 *   - Smoke testing  : successful self-deletion, confirmation message
 *   - DB integration : document absent after deletion, other documents unaffected
 *   - Error handling : non-existent ID (403 – ownership mismatch), invalid ObjectId,
 *                      missing/invalid token, attempt to delete another user (403)
 *   - Boundary tests : deleting the only extra user, testUser isolation
 *
 * Security model: users may only delete their own account (self-delete only).
 * Each test that performs a successful delete creates a dedicated user + token.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app.js';
import User from '../../models/user.model.js';
import {
  setupTests,
  teardownTests,
  cleanupExtraUsers,
  createTestUser,
  createAuthenticatedUser,
  testContext,
} from '../helpers/user.setup.js';
import { createUserData, commonUsers } from '../fixtures/user.fixtures.js';

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
// DELETE /api/v1/user/:id/remove
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/v1/user/:id/remove - Remove User', () => {

  // ── Smoke Tests ────────────────────────────────────────────────────────────

  it('should allow a user to delete their own account and return 200', async () => {
    // Arrange: create a dedicated user with its own auth token
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'deleteme@example.com' })
    );

    // Act
    const response = await request(app)
      .delete(`/api/v1/user/${targetUser._id}/remove`)
      .set('Authorization', `Bearer ${targetToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('The user has been deleted');
  });

  // ── DB Integration ─────────────────────────────────────────────────────────

  it('should remove the user document from the database after deletion', async () => {
    // Arrange
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'gone@example.com' })
    );
    const userId = targetUser._id;

    // Act
    await request(app)
      .delete(`/api/v1/user/${userId}/remove`)
      .set('Authorization', `Bearer ${targetToken}`)
      .expect(200);

    // Assert: the document no longer exists in the collection
    const found = await User.findById(userId);
    expect(found).toBeNull();
  });

  it('should not affect other user documents when deleting one specific user', async () => {
    // Arrange: two extra users; only the first deletes itself
    const { user: userToDelete, token: deleteToken } = await createAuthenticatedUser(
      createUserData({ email: 'delete.only@example.com' })
    );
    const userToKeep = await createTestUser(createUserData({ email: 'keep.me@example.com' }));

    // Act: self-delete the first user
    await request(app)
      .delete(`/api/v1/user/${userToDelete._id}/remove`)
      .set('Authorization', `Bearer ${deleteToken}`)
      .expect(200);

    // Assert: the second user is still present and unmodified
    const keptUser = await User.findById(userToKeep._id);
    expect(keptUser).toBeTruthy();
    expect(keptUser.email).toBe('keep.me@example.com');
  });

  it('should reflect the deletion immediately in the database (no stale reads)', async () => {
    // Arrange
    const { user: targetUser, token: targetToken } = await createAuthenticatedUser(
      createUserData({ email: 'immediate@example.com' })
    );

    // Confirm user exists before delete
    const before = await User.findById(targetUser._id);
    expect(before).toBeTruthy();

    // Act
    await request(app)
      .delete(`/api/v1/user/${targetUser._id}/remove`)
      .set('Authorization', `Bearer ${targetToken}`)
      .expect(200);

    // Assert: immediate subsequent query returns null
    const after = await User.findById(targetUser._id);
    expect(after).toBeNull();
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('should return 403 when a user attempts to delete a different user', async () => {
    // Arrange: create a second user as the target
    const otherUser = await createTestUser(commonUsers.alice);

    // Act: testContext.testUser tries to delete otherUser
    const response = await request(app)
      .delete(`/api/v1/user/${otherUser._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/unauthorized/i);
  });

  it('should return 401 when no authorization token is provided', async () => {
    const response = await request(app)
      .delete(`/api/v1/user/${testContext.testUser._id}/remove`)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('should return 401 when an invalid token is provided', async () => {
    const response = await request(app)
      .delete(`/api/v1/user/${testContext.testUser._id}/remove`)
      .set('Authorization', 'Bearer totally-wrong-token')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('should return 403 when the user ID is not a valid ObjectId format', async () => {
    // The ownership check (req.user.id !== req.params.id) fires before Mongoose
    // ever processes the malformed ID, so the response is 403 Forbidden, not 404.
    const response = await request(app)
      .delete('/api/v1/user/not-an-object-id/remove')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  // ── Boundary Tests ─────────────────────────────────────────────────────────

  it('should leave testContext.testUser untouched after deleting an extra user', async () => {
    // Arrange
    const { user: extra, token: extraToken } = await createAuthenticatedUser(commonUsers.alice);

    // Act: extra user deletes itself
    await request(app)
      .delete(`/api/v1/user/${extra._id}/remove`)
      .set('Authorization', `Bearer ${extraToken}`)
      .expect(200);

    // Assert: baseline test user is still present and unchanged
    const baseline = await User.findById(testContext.testUser._id);
    expect(baseline).toBeTruthy();
    expect(baseline.email).toBe(testContext.testUser.email);
  });

  it('should delete a just-created user without any issues (immediate delete)', async () => {
    // Arrange: create and immediately attempt deletion
    const { user: freshUser, token: freshToken } = await createAuthenticatedUser(
      createUserData({ email: 'instant.delete@example.com' })
    );

    // Act
    const response = await request(app)
      .delete(`/api/v1/user/${freshUser._id}/remove`)
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    const found = await User.findById(freshUser._id);
    expect(found).toBeNull();
  });
});
