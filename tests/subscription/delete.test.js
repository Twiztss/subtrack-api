/**
 * Integration Tests for DELETE /api/v1/subscription/:id/remove
 * Tests for removing subscription documents through the HTTP endpoint
 *
 * Coverage:
 *   - Smoke testing  : successful deletion returns 200 with confirmation message
 *   - DB integration : document absent after deletion, other subscriptions unaffected,
 *                      immediate consistency (no stale reads)
 *   - Error handling : non-existent ID → 404, invalid ObjectId → 404,
 *                      missing auth token → 401, malformed token → 401
 *   - Boundary tests : delete then re-query same ID, count unchanged on failed delete
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app.js';
import Subscription from '../../models/subscription.model.js';
import {
  setupTests,
  teardownTests,
  cleanupTestData,
  testContext,
  createTestSubscription,
} from '../helpers/subscription.setup.js';
import { commonSubscriptions } from '../fixtures/subscription.fixtures.js';

beforeAll(async () => {
  await setupTests();
});

afterEach(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  await teardownTests();
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/subscription/:id/remove
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/v1/subscription/:id/remove - Remove Subscription', () => {

  // ── Smoke Tests ────────────────────────────────────────────────────────────

  it('should delete an existing subscription and return 200 with a confirmation message', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    // Act
    const response = await request(app)
      .delete(`/api/v1/subscription/${sub._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('The subscription has been deleted');
  });

  // ── DB Integration ─────────────────────────────────────────────────────────

  it('should remove the subscription document from the database after deletion', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.netflix);
    const subId = sub._id;

    // Act
    await request(app)
      .delete(`/api/v1/subscription/${subId}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: document no longer exists in the collection
    const found = await Subscription.findById(subId);
    expect(found).toBeNull();
  });

  it('should not affect other subscription documents when deleting one specific subscription', async () => {
    // Arrange: two subscriptions; only the first will be deleted
    const subToDelete = await createTestSubscription(commonSubscriptions.spotify);
    const subToKeep = await createTestSubscription(commonSubscriptions.netflix);

    // Act: delete only the first
    await request(app)
      .delete(`/api/v1/subscription/${subToDelete._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: the second subscription is still present and unmodified
    const keptDoc = await Subscription.findById(subToKeep._id);
    expect(keptDoc).toBeTruthy();
    expect(keptDoc.name).toBe(commonSubscriptions.netflix.name);
  });

  it('should reflect the deletion immediately in the database (no stale reads)', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.disneyPlus);

    // Confirm the document exists before the delete
    const before = await Subscription.findById(sub._id);
    expect(before).toBeTruthy();

    // Act
    await request(app)
      .delete(`/api/v1/subscription/${sub._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: an immediate subsequent query returns null
    const after = await Subscription.findById(sub._id);
    expect(after).toBeNull();
  });

  it('should decrement the subscription count by exactly one after deletion', async () => {
    // Arrange: three subscriptions
    const sub1 = await createTestSubscription(commonSubscriptions.spotify);
    await createTestSubscription(commonSubscriptions.netflix);
    await createTestSubscription(commonSubscriptions.disneyPlus);

    const countBefore = await Subscription.countDocuments();
    expect(countBefore).toBe(3);

    // Act
    await request(app)
      .delete(`/api/v1/subscription/${sub1._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert
    const countAfter = await Subscription.countDocuments();
    expect(countAfter).toBe(2);
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('should return 404 when the subscription ID does not exist in the database', async () => {
    // A valid ObjectId that is not present in the collection
    const nonExistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .delete(`/api/v1/subscription/${nonExistentId}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/subscription not found/i);
  });

  it('should return 404 when the subscription ID is not a valid ObjectId format', async () => {
    // Mongoose CastError → mapped to 404 by the error middleware
    const response = await request(app)
      .delete('/api/v1/subscription/not-an-object-id/remove')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  it('should not decrement the subscription count when the ID does not exist', async () => {
    // Arrange
    await createTestSubscription(commonSubscriptions.spotify);
    const countBefore = await Subscription.countDocuments();
    const nonExistentId = new mongoose.Types.ObjectId();

    // Act: attempt a no-op delete
    await request(app)
      .delete(`/api/v1/subscription/${nonExistentId}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(404);

    // Assert: collection size is unchanged
    const countAfter = await Subscription.countDocuments();
    expect(countAfter).toBe(countBefore);
  });

  it('should return 401 when no authorization token is provided', async () => {
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    const response = await request(app)
      .delete(`/api/v1/subscription/${sub._id}/remove`)
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('should return 401 when the authorization token is malformed', async () => {
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    const response = await request(app)
      .delete(`/api/v1/subscription/${sub._id}/remove`)
      .set('Authorization', 'Bearer totally-wrong-token')
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  // ── Boundary Tests ─────────────────────────────────────────────────────────

  it('should delete a just-created subscription without any issues (immediate delete)', async () => {
    // Arrange: create and then immediately delete
    const freshSub = await createTestSubscription(commonSubscriptions.spotify);

    // Act
    const response = await request(app)
      .delete(`/api/v1/subscription/${freshSub._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    const found = await Subscription.findById(freshSub._id);
    expect(found).toBeNull();
  });

  it('should return 404 on a second delete attempt of the same subscription', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.netflix);

    // First delete — should succeed
    await request(app)
      .delete(`/api/v1/subscription/${sub._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Second delete — subscription is gone; should return 404
    const response = await request(app)
      .delete(`/api/v1/subscription/${sub._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
  });
});
