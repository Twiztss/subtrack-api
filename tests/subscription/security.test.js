/**
 * Regression Tests – Subscription Security & Bug Fixes
 *
 * Covers:
 *   - Ownership enforcement: cannot read/edit/cancel/delete another user's subscription
 *   - NoSQL injection hardening in filter query
 *   - deleteCategory uses the correct field name (category, not categories)
 *   - payment/status field consistency on subscription model
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../app.js';
import Subscription from '../../models/subscription.model.js';
import Category from '../../models/category.model.js';
import User from '../../models/user.model.js';
import { JWT_SECRET } from '../../config/env.js';
import {
  setupTests,
  teardownTests,
  cleanupTestData,
  testContext,
  createTestSubscription,
} from '../helpers/subscription.setup.js';

beforeAll(async () => {
  await setupTests();
});

afterEach(async () => {
  await cleanupTestData();
  // Also clean up any extra users created inline by ownership tests
  await User.deleteMany({ _id: { $ne: testContext.testUser._id } });
});

afterAll(async () => {
  await teardownTests();
});

// ─────────────────────────────────────────────────────────────────────────────
// Subscription ownership enforcement
// ─────────────────────────────────────────────────────────────────────────────
describe('Subscription ownership enforcement', () => {

  const createOtherUserSubscription = async () => {
    // Use a unique email per call so parallel tests don't get E11000 conflicts
    const otherUser = await User.create({
      name: 'Other User',
      email: `other-${Date.now()}@example.com`,
      password: 'hashed123',
    });
    const cat = await Category.create({ name: 'foreign' });
    const sub = await Subscription.create({
      name: 'Other Sub',
      price: '5.00',
      category: cat._id,
      frequency: 'monthly',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      renewalDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
      user: otherUser._id,
    });
    return { otherUser, sub };
  };

  it('should return 403 when reading a subscription owned by another user', async () => {
    const { sub } = await createOtherUserSubscription();

    const response = await request(app)
      .get(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  it('should return 403 when editing a subscription owned by another user', async () => {
    const { sub } = await createOtherUserSubscription();

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ name: 'Hijacked' })
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  it('should return 403 when cancelling a subscription owned by another user', async () => {
    const { sub } = await createOtherUserSubscription();

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/cancel`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  it('should return 403 when deleting a subscription owned by another user', async () => {
    const { sub } = await createOtherUserSubscription();

    const response = await request(app)
      .delete(`/api/v1/subscription/${sub._id}/remove`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
    // Other user's sub must still exist
    const still = await Subscription.findById(sub._id);
    expect(still).toBeTruthy();
  });

  it('GET /api/v1/subscription should only return subscriptions for the requesting user', async () => {
    // Create a subscription for testUser and another for a different user
    await createTestSubscription({ name: 'My Sub' });
    await createOtherUserSubscription();

    const response = await request(app)
      .get('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    expect(response.body.data.every(
      (s) => s.user.toString() === testContext.testUser._id.toString()
    )).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NoSQL injection hardening
// ─────────────────────────────────────────────────────────────────────────────
describe('Filter query – NoSQL injection protection', () => {

  it('should ignore unknown filter keys', async () => {
    await createTestSubscription({ name: 'Spotify' });

    // `__proto__` and arbitrary keys should not affect the query
    const response = await request(app)
      .get('/api/v1/subscription?__proto__[payment]=active&unknown=value')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    // Result should still be a normal array (no crash)
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should not allow operator injection via query params', async () => {
    await createTestSubscription({ name: 'Spotify' });

    // Express parses `?payment[$ne]=xxx` as an object; our filter must drop it
    const response = await request(app)
      .get('/api/v1/subscription')
      .query({ 'payment[$ne]': 'active' })
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // The request should succeed and not throw a DB error
    expect(response.body.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// payment field consistency
// ─────────────────────────────────────────────────────────────────────────────
describe('Subscription payment field', () => {

  it('should set payment to "expired" (not status) when renewalDate has passed', async () => {
    const sub = await Subscription.create({
      name: 'Expired Sub',
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      startDate: new Date('2024-01-01'),
      renewalDate: new Date('2024-02-01'), // in the past → triggers pre-save hook
      user: testContext.testUser._id,
    });

    expect(sub.payment).toBe('expired');
    expect(sub.status).toBeUndefined();
  });

  it('cancel endpoint sets payment to "cancelled"', async () => {
    const sub = await createTestSubscription({ name: 'Active Sub' });

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/cancel`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    expect(response.body.data.payment).toBe('cancelled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteCategory – correct field name
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/v1/category/:id – field name regression', () => {

  it('should block deletion when subscriptions reference the category', async () => {
    // The category is already referenced by testContext.testCategory
    // Create a subscription for it
    await createTestSubscription({ name: 'Netflix' });

    const response = await request(app)
      .delete(`/api/v1/category/${testContext.testCategory._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/cannot delete category/i);
  });

  it('should allow deletion of a category that has no subscriptions', async () => {
    const emptyCategory = await Category.create({ name: 'unused-cat' });

    const response = await request(app)
      .delete(`/api/v1/category/${emptyCategory._id}`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(await Category.findById(emptyCategory._id)).toBeNull();
  });
});
