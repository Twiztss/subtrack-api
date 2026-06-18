/**
 * Integration Tests for GET /api/v1/subscription/user/:id/analytics
 * Tests for the subscription analytics endpoint — burn rates and category breakdown
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app.js';
import Category from '../../models/category.model.js';
import Subscription from '../../models/subscription.model.js';
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
});

afterAll(async () => {
  await teardownTests();
});

describe('GET /api/v1/subscription/user/:id/analytics', () => {
  it('should return correct monthly and yearly burn rates for active subscriptions', async () => {
    // Arrange: one monthly ($9.99) + one yearly ($120.00)
    // Expected monthly = 9.99 + 120/12 = 9.99 + 10.00 = 19.99
    // Expected yearly  = 19.99 * 12 = 239.88
    await createTestSubscription({ price: '9.99', frequency: 'monthly' });
    await createTestSubscription({ price: '120.00', frequency: 'yearly' });

    const userId = testContext.testUser._id.toString();

    const response = await request(app)
      .get(`/api/v1/subscription/user/${userId}/analytics`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.monthlyBurnRate).toBe(19.99);
    expect(response.body.data.yearlyBurnRate).toBe(239.88);
    expect(response.body.data.activeSubscriptionCount).toBe(2);
  });

  it('should normalise weekly and daily frequencies to a monthly equivalent', async () => {
    // weekly $10.00 → 10 * (52/12) ≈ 43.33  (rounded to 2dp)
    // daily  $1.00  → 1  * 30      = 30.00
    // total monthly ≈ 73.33
    await createTestSubscription({ price: '10.00', frequency: 'weekly' });
    await createTestSubscription({ price: '1.00', frequency: 'daily' });

    const userId = testContext.testUser._id.toString();
    const weeklyMonthly = parseFloat((10.00 * (52 / 12)).toFixed(2));
    const dailyMonthly = parseFloat((1.00 * 30).toFixed(2));
    const expectedMonthly = parseFloat((weeklyMonthly + dailyMonthly).toFixed(2));
    const expectedYearly = parseFloat((expectedMonthly * 12).toFixed(2));

    const response = await request(app)
      .get(`/api/v1/subscription/user/${userId}/analytics`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    expect(response.body.data.monthlyBurnRate).toBeCloseTo(expectedMonthly, 1);
    expect(response.body.data.yearlyBurnRate).toBeCloseTo(expectedYearly, 1);
    expect(response.body.data.activeSubscriptionCount).toBe(2);
  });

  it('should group spending correctly by category', async () => {
    // entertainment: $9.99/month
    // saas:          $120/year → $10.00/month
    const saasCategory = await Category.create({ name: 'saas' });

    await createTestSubscription({ price: '9.99', frequency: 'monthly' });
    await Subscription.create({
      name: 'GitHub Pro',
      price: '120.00',
      frequency: 'yearly',
      category: saasCategory._id,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      renewalDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
      user: testContext.testUser._id,
    });

    const userId = testContext.testUser._id.toString();

    const response = await request(app)
      .get(`/api/v1/subscription/user/${userId}/analytics`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    const { categoryBreakdown } = response.body.data;
    expect(categoryBreakdown).toHaveLength(2);

    // Sorted by monthlyBurnRate descending — saas (10.00) first, entertainment (9.99) second
    const topCategory = categoryBreakdown[0];
    const bottomCategory = categoryBreakdown[1];

    expect(topCategory.category).toBe('saas');
    expect(topCategory.monthlyBurnRate).toBe(10.00);
    expect(topCategory.yearlyBurnRate).toBe(120.00);
    expect(topCategory.subscriptionCount).toBe(1);

    expect(bottomCategory.category).toBe('entertainment');
    expect(bottomCategory.monthlyBurnRate).toBe(9.99);
    expect(bottomCategory.yearlyBurnRate).toBe(119.88);
    expect(bottomCategory.subscriptionCount).toBe(1);
  });

  it('should compute accurate percentages per category', async () => {
    // entertainment: $10.00/month → 50%
    // saas:          $10.00/month → 50%
    const saasCategory = await Category.create({ name: 'saas' });

    await createTestSubscription({ price: '10.00', frequency: 'monthly' });
    await Subscription.create({
      name: 'Linear',
      price: '10.00',
      frequency: 'monthly',
      category: saasCategory._id,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      renewalDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
      user: testContext.testUser._id,
    });

    const userId = testContext.testUser._id.toString();

    const response = await request(app)
      .get(`/api/v1/subscription/user/${userId}/analytics`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    const { categoryBreakdown } = response.body.data;
    expect(categoryBreakdown).toHaveLength(2);
    categoryBreakdown.forEach((cat) => {
      expect(cat.percentage).toBeCloseTo(50, 1);
    });
    const totalPercentage = categoryBreakdown.reduce((sum, cat) => sum + cat.percentage, 0);
    expect(totalPercentage).toBeCloseTo(100, 1);
  });

  it('should exclude cancelled and expired subscriptions from burn rate', async () => {
    // Only the active subscription should count
    await createTestSubscription({ price: '10.00', frequency: 'monthly', payment: 'active' });
    await createTestSubscription({ price: '20.00', frequency: 'monthly', payment: 'cancelled' });
    await createTestSubscription({ price: '30.00', frequency: 'monthly', payment: 'expired' });

    const userId = testContext.testUser._id.toString();

    const response = await request(app)
      .get(`/api/v1/subscription/user/${userId}/analytics`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    const { data } = response.body;
    expect(data.monthlyBurnRate).toBe(10.00);
    expect(data.yearlyBurnRate).toBe(120.00);
    expect(data.activeSubscriptionCount).toBe(1);
  });

  it('should return zero burn rates and empty breakdown when user has no active subscriptions', async () => {
    const userId = testContext.testUser._id.toString();

    const response = await request(app)
      .get(`/api/v1/subscription/user/${userId}/analytics`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    const { data } = response.body;
    expect(data.monthlyBurnRate).toBe(0);
    expect(data.yearlyBurnRate).toBe(0);
    expect(data.activeSubscriptionCount).toBe(0);
    expect(data.categoryBreakdown).toEqual([]);
  });

  it('should return 401 when authorization token is missing', async () => {
    const userId = testContext.testUser._id.toString();

    const response = await request(app)
      .get(`/api/v1/subscription/user/${userId}/analytics`)
      .expect(401);

    expect(response.body.success).toBeFalsy();
  });

  it('should return 401 when requesting analytics for a different user', async () => {
    const differentUserId = new mongoose.Types.ObjectId().toString();

    const response = await request(app)
      .get(`/api/v1/subscription/user/${differentUserId}/analytics`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(401);

    expect(response.body.success).toBeFalsy();
  });

  it('should only include subscriptions belonging to the requesting user', async () => {
    // Arrange: Create a second user and their subscriptions
    const { default: User } = await import('../../models/user.model.js');
    const otherUser = await User.create({
      name: 'Other User',
      email: 'other@example.com',
      password: 'hashedPassword456',
    });

    await Subscription.create({
      name: 'Other Netflix',
      price: '50.00',
      frequency: 'monthly',
      category: testContext.testCategory._id,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      renewalDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
      user: otherUser._id,
    });

    // The test user has one active subscription
    await createTestSubscription({ price: '9.99', frequency: 'monthly' });

    const userId = testContext.testUser._id.toString();

    const response = await request(app)
      .get(`/api/v1/subscription/user/${userId}/analytics`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Should only count the test user's subscription, not the other user's
    expect(response.body.data.monthlyBurnRate).toBe(9.99);
    expect(response.body.data.activeSubscriptionCount).toBe(1);

    await User.deleteOne({ _id: otherUser._id });
  });
});
