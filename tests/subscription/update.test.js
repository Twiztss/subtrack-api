/**
 * Integration Tests for PUT /api/v1/subscription/:id
 *                     PUT /api/v1/subscription/:id/cancel
 *
 * Coverage:
 *   - Smoke testing  : update individual fields (name, price, frequency, currency, payment)
 *   - DB integration : changes persisted; direct model query confirms the write
 *   - Partial update : only supplied fields mutated, others left intact
 *   - Cancel         : PUT /:id/cancel flips payment → 'expired'
 *   - Error handling : empty body → 400, non-existent ID → 404, invalid ObjectId → 404,
 *                      missing auth token → 401, malformed token → 401
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
// PUT /api/v1/subscription/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/v1/subscription/:id - Edit Subscription', () => {

  // ── Smoke Tests ────────────────────────────────────────────────────────────

  it('should update the subscription name and return the updated document', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    // Act
    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Spotify Premium' })
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Spotify Premium');
  });

  it('should update the price and return the updated document', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.netflix);

    // Act
    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ price: '19.99' })
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.price).toBe('19.99');
  });

  it('should update the frequency and return the updated document', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    // Act
    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ frequency: 'yearly' })
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.frequency).toBe('yearly');
  });

  it('should update the currency and return the updated document', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    // Act
    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ currency: 'EUR' })
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.currency).toBe('EUR');
  });

  it('should update the payment status and return the updated document', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    // Act
    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ payment: 'cancelled' })
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.payment).toBe('cancelled');
  });

  // ── DB Integration ─────────────────────────────────────────────────────────

  it('should persist the update to the database', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.netflix);

    // Act
    await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Netflix 4K' })
      .expect(200);

    // Assert: verify write was committed
    const dbDoc = await Subscription.findById(sub._id);
    expect(dbDoc.name).toBe('Netflix 4K');
  });

  it('should update multiple fields in a single request', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    // Act
    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Spotify Duo', price: '12.99', currency: 'GBP' })
      .expect(200);

    // Assert: all three fields updated in one round-trip
    expect(response.body.data.name).toBe('Spotify Duo');
    expect(response.body.data.price).toBe('12.99');
    expect(response.body.data.currency).toBe('GBP');
  });

  it('should leave unspecified fields unchanged after a partial update', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.netflix);
    const originalPrice = sub.price;
    const originalFrequency = sub.frequency;

    // Act: only update the name
    await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Netflix Updated' })
      .expect(200);

    // Assert: price and frequency must be untouched
    const dbDoc = await Subscription.findById(sub._id);
    expect(dbDoc.name).toBe('Netflix Updated');
    expect(dbDoc.price).toBe(originalPrice);
    expect(dbDoc.frequency).toBe(originalFrequency);
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('should return 400 when the request body is empty', async () => {
    // The controller explicitly rejects an empty updateFields object
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/no valid fields/i);
  });

  it('should return 404 when the subscription ID does not exist', async () => {
    // A valid ObjectId that is not in the collection
    const nonExistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .put(`/api/v1/subscription/${nonExistentId}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Ghost Subscription' })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/no subscription with that id/i);
  });

  it('should return 404 when the subscription ID is not a valid ObjectId format', async () => {
    // Mongoose CastError → mapped to 404 by the error middleware
    const response = await request(app)
      .put('/api/v1/subscription/not-an-object-id')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Cast Error' })
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  it('should return 401 when no authorization token is provided', async () => {
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .send({ name: 'Unauthorized' })
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('should return 401 when the authorization token is malformed', async () => {
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', 'Bearer totally-wrong-token')
      .send({ name: 'Bad Token' })
      .expect(401);

    expect(response.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/subscription/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/v1/subscription/:id/cancel - Cancel Subscription', () => {

  // ── Smoke Tests ────────────────────────────────────────────────────────────

  it('should cancel an active subscription and set payment to expired', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.spotify);
    expect(sub.payment).toBe('active');

    // Act
    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/cancel`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert
    expect(response.body.success).toBe(true);
    expect(response.body.data.payment).toBe('expired');
  });

  it('should return the full subscription document in the response', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.netflix);

    // Act
    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/cancel`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: full document is present, not just a confirmation message
    expect(response.body.data).toHaveProperty('_id');
    expect(response.body.data).toHaveProperty('name');
    expect(response.body.data).toHaveProperty('payment', 'expired');
  });

  // ── DB Integration ─────────────────────────────────────────────────────────

  it('should persist the cancelled status to the database', async () => {
    // Arrange
    const sub = await createTestSubscription(commonSubscriptions.disneyPlus);

    // Act
    await request(app)
      .put(`/api/v1/subscription/${sub._id}/cancel`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: DB document reflects the cancellation
    const dbDoc = await Subscription.findById(sub._id);
    expect(dbDoc.payment).toBe('expired');
  });

  it('should not affect other subscriptions when cancelling one', async () => {
    // Arrange: two separate subscriptions
    const subToCancel = await createTestSubscription(commonSubscriptions.spotify);
    const subToKeep = await createTestSubscription(commonSubscriptions.netflix);

    // Act: cancel only the first
    await request(app)
      .put(`/api/v1/subscription/${subToCancel._id}/cancel`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: the second subscription is still active
    const keptDoc = await Subscription.findById(subToKeep._id);
    expect(keptDoc.payment).toBe('active');
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  it('should return 404 when the subscription ID does not exist', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .put(`/api/v1/subscription/${nonExistentId}/cancel`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/no subscription with that id/i);
  });

  it('should return 404 when the subscription ID is not a valid ObjectId format', async () => {
    const response = await request(app)
      .put('/api/v1/subscription/not-an-object-id/cancel')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  it('should return 401 when no authorization token is provided', async () => {
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/cancel`)
      .expect(401);

    expect(response.body.success).toBe(false);
  });
});
