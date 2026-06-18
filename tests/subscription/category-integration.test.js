/**
 * Integration Tests for Subscription-Category Relationship
 * Tests specifically for category handling within subscriptions
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import Subscription from '../../models/subscription.model.js';
import Category from '../../models/category.model.js';
import {
  setupTests,
  teardownTests,
  cleanupTestData,
  testContext,
  createTestSubscription,
} from '../helpers/subscription.setup.js';
import {
  createSubscriptionData,
} from '../fixtures/subscription.fixtures.js';

/**
 * Setup: Before all tests run
 */
beforeAll(async () => {
  await setupTests();
});

/**
 * Teardown: After each test
 */
afterEach(async () => {
  await cleanupTestData();
});

/**
 * Teardown: After all tests complete
 */
afterAll(async () => {
  await teardownTests();
});

/**
 * Test Suite: Subscription-Category Integration
 * Tests for category handling within subscription context
 */
describe('Subscription-Category Integration', () => {
  it('should automatically create category when it does not exist', async () => {
    // Arrange: Use a new category name
    const newCategoryName = 'productivity';
    const subscriptionData = createSubscriptionData({
      category: newCategoryName,
    });

    // Verify category doesn't exist yet
    const categoryBefore = await Category.findOne({ name: newCategoryName });
    expect(categoryBefore).toBeNull();

    // Act: Create subscription with new category
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData)
      .expect(201);

    // Assert: Verify category was created
    expect(response.body.success).toBe(true);
    const categoryAfter = await Category.findOne({ name: newCategoryName });
    expect(categoryAfter).toBeTruthy();
    expect(categoryAfter.name).toBe(newCategoryName);
  });

  it('should reuse existing category when it already exists', async () => {
    // Arrange: Create a category first
    const existingCategory = await Category.create({
      name: 'streaming',
    });

    const subscriptionData = createSubscriptionData({
      category: 'streaming',
    });

    const initialCategoryCount = await Category.countDocuments();

    // Act: Create subscription with existing category
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData)
      .expect(201);

    // Assert: Verify no duplicate category was created
    const finalCategoryCount = await Category.countDocuments();
    expect(finalCategoryCount).toBe(initialCategoryCount);

    // Verify subscription references the existing category
    const subscription = await Subscription.findById(
      response.body.data.subscription._id
    ).populate('category');
    expect(subscription.category._id.toString()).toBe(existingCategory._id.toString());
    expect(subscription.category.name).toBe('streaming');
  });

  it('should handle category name normalization (case-insensitive)', async () => {
    // Arrange: Create category with lowercase
    await Category.create({ name: 'productivity' });

    const subscriptionData1 = createSubscriptionData({
      category: 'Productivity', // Uppercase
    });

    const subscriptionData2 = createSubscriptionData({
      name: 'Notion',
      category: 'PRODUCTIVITY', // All caps
    });

    // Act: Create subscriptions with different case variations
    await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData1)
      .expect(201);

    await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData2)
      .expect(201);

    // Assert: Verify only one category exists
    const categories = await Category.find({ name: 'entertainment' });
    expect(categories.length).toBe(1);
  });

  it('should populate category reference when querying subscription', async () => {
    // Arrange: Create subscription with category
    const subscription = await createTestSubscription({
      name: 'Spotify',
    });

    // Act: Query with populate
    const found = await Subscription.findById(subscription._id).populate('category');

    // Assert: Verify category is populated
    expect(found.category).toBeTruthy();
    expect(found.category.name).toBe('entertainment');
    expect(found.category._id).toEqual(testContext.testCategory._id);
  });

  it('should allow multiple subscriptions with the same category', async () => {
    // Arrange: Create multiple subscriptions with same category
    const category = await Category.create({ name: 'streaming' });

    const subscription1 = await Subscription.create({
      name: 'Netflix',
      price: '15.99',
      category: category._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      renewalDate: new Date('2026-03-01'),
      user: testContext.testUser._id,
    });

    const subscription2 = await Subscription.create({
      name: 'Disney+',
      price: '7.99',
      category: category._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      renewalDate: new Date('2026-03-01'),
      user: testContext.testUser._id,
    });

    // Act: Query subscriptions for this category
    const subscriptions = await Subscription.find({ category: category._id });

    // Assert: Verify multiple subscriptions share the same category
    expect(subscriptions.length).toBe(2);
    expect(subscriptions[0].category.toString()).toBe(category._id.toString());
    expect(subscriptions[1].category.toString()).toBe(category._id.toString());
  });

  it('should handle category field as string in API request', async () => {
    // Arrange: Subscription data with category as string (common API usage)
    const subscriptionData = createSubscriptionData({
      category: 'gaming',
    });

    // Act: Create subscription
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData)
      .expect(201);

    // Assert: Verify category was created and linked
    expect(response.body.success).toBe(true);
    const category = await Category.findOne({ name: 'gaming' });
    expect(category).toBeTruthy();

    const subscription = await Subscription.findById(
      response.body.data.subscription._id
    );
    expect(subscription.category.toString()).toBe(category._id.toString());
  });

  it('should trim whitespace from category names', async () => {
    // Arrange: Category with extra whitespace
    const subscriptionData = createSubscriptionData({
      category: '  utilities  ',
    });

    // Act: Create subscription
    await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData)
      .expect(201);

    // Assert: Verify category name was trimmed
    const category = await Category.findOne({ name: 'utilities' });
    expect(category).toBeTruthy();
    expect(category.name).toBe('utilities');
    expect(category.name).not.toBe('  utilities  ');
  });
});
