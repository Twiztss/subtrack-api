/**
 * Integration Tests for DELETE /api/v1/user/:id/remove
 * Tests for removing user documents through the HTTP endpoint
 *
 * Coverage:
 *   - Smoke testing  : successful deletion, confirmation message
 *   - DB integration : document absent after deletion, other documents unaffected
 *   - Error handling : non-existent ID, invalid ObjectId format
 *   - Boundary tests : deleting the only extra user, testUser isolation
 *
 * Note: this endpoint does NOT require an authorization token (no `authorize`
 * middleware in routes/user.js), so auth-error scenarios are not tested here.
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

  it('should delete an existing user and return 200 with a confirmation message', async () => {
    // Arrange: a dedicated user to delete; testContext.testUser is left intact
    const targetUser = await createTestUser(createUserData({ email: 'deleteme@example.com' }));

    // Act
    const response = await request(app)
      .delete(`/api/v1/user/${targetUser._id}/remove`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('The user has been deleted');
  });

  // ── DB Integration ─────────────────────────────────────────────────────────

  it('should remove the user document from the database after deletion', async () => {
    // Arrange
    const targetUser = await createTestUser(createUserData({ email: 'gone@example.com' }));
    const userId = targetUser._id;

    // Act
    await request(app)
      .delete(`/api/v1/user/${userId}/remove`)
      .expect(200);

    // Assert: the document no longer exists in the collection
    const found = await User.findById(userId);
    expect(found).toBeNull();
  });

  it('should not affect other user documents when deleting one specific user', async () => {
    // Arrange: two extra users; only the first will be deleted
    const userToDelete = await createTestUser(createUserData({ email: 'delete.only@example.com' }));
    const userToKeep = await createTestUser(createUserData({ email: 'keep.me@example.com' }));

    // Act: delete only the first user
    await request(app)
      .delete(`/api/v1/user/${userToDelete._id}/remove`)
      .expect(200);

    // Assert: the second user is still present and unmodified
    const keptUser = await User.findById(userToKeep._id);
    expect(keptUser).toBeTruthy();
    expect(keptUser.email).toBe('keep.me@example.com');
  });

  it('should reflect the deletion immediately in the database (no stale reads)', async () => {
    // Arrange
    const targetUser = await createTestUser(createUserData({ email: 'immediate@example.com' }));

    // Confirm user exists before delete
    const before = await User.findById(targetUser._id);
    expect(before).toBeTruthy();

    // Act
    await request(app)
      .delete(`/api/v1/user/${targetUser._id}/remove`)
      .expect(200);

    // Assert: immediate subsequent query returns null
    const after = await User.findById(targetUser._id);
    expect(after).toBeNull();
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('should return 404 when the user ID does not exist in the database', async () => {
    // A valid ObjectId that is not present in the collection
    const nonExistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .delete(`/api/v1/user/${nonExistentId}/remove`)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body.success).toBe(false);
    // The controller throws 'User Not Found' (capitalised) for this case
    expect(response.body.message).toMatch(/not found/i);
  });

  it('should return 404 when the user ID is not a valid ObjectId format', async () => {
    // Mongoose throws a CastError for malformed IDs;
    // the error middleware maps CastError → 404
    const response = await request(app)
      .delete('/api/v1/user/not-an-object-id/remove')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  it('should not decrement the user count when the ID does not exist', async () => {
    // Arrange: note the current user count
    const countBefore = await User.countDocuments();
    const nonExistentId = new mongoose.Types.ObjectId();

    // Act: attempt a no-op delete
    await request(app)
      .delete(`/api/v1/user/${nonExistentId}/remove`)
      .expect(404);

    // Assert: collection size is unchanged
    const countAfter = await User.countDocuments();
    expect(countAfter).toBe(countBefore);
  });

  // ── Boundary Tests ─────────────────────────────────────────────────────────

  it('should leave testContext.testUser untouched after deleting all extra users', async () => {
    // Arrange: three extra users
    await createTestUser(commonUsers.alice);
    await createTestUser(commonUsers.bob);
    const lastExtra = await createTestUser(commonUsers.charlie);

    // Act: delete the last extra user via the API
    await request(app)
      .delete(`/api/v1/user/${lastExtra._id}/remove`)
      .expect(200);

    // Assert: baseline test user is still present and unchanged
    const baseline = await User.findById(testContext.testUser._id);
    expect(baseline).toBeTruthy();
    expect(baseline.email).toBe(testContext.testUser.email);
  });

  it('should delete a just-created user without any issues (immediate delete)', async () => {
    // Arrange: create and then immediately attempt deletion
    const freshUser = await createTestUser(createUserData({ email: 'instant.delete@example.com' }));

    // Act
    const response = await request(app)
      .delete(`/api/v1/user/${freshUser._id}/remove`)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    const found = await User.findById(freshUser._id);
    expect(found).toBeNull();
  });
});
