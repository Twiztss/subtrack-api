/**
 * Integration Tests for POST /api/v1/subscription
 * Tests for creating new subscriptions
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
} from '../helpers/subscription.setup.js';
import {
  createSubscriptionData,
  invalidSubscriptionData,
} from '../fixtures/subscription.fixtures.js';

/**
 * Setup: Before all tests run
 * - Spin up in-memory MongoDB instance
 * - Connect mongoose to the test database
 * - Create a test user and generate auth token for protected routes
 */
beforeAll(async () => {
  await setupTests();
});

/**
 * Teardown: After each test
 * - Clear all data from collections to ensure test isolation
 */
afterEach(async () => {
  await cleanupTestData();
});

/**
 * Teardown: After all tests complete
 * - Close mongoose connection
 * - Stop the in-memory MongoDB server
 */
afterAll(async () => {
  await teardownTests();
});

/**
 * Test Suite: POST /api/v1/subscription
 * Tests for creating new subscriptions
 */
describe('POST /api/v1/subscription - Create Subscription', () => {
  it('should create a new subscription successfully with valid data', async () => {
    // Arrange: Prepare valid subscription data
    const subscriptionData = createSubscriptionData();

    // Act: Make POST request to create subscription
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData)
      .expect('Content-Type', /json/)
      .expect(201);

    // Assert: Verify response structure and data
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('subscription');

    const { subscription } = response.body.data;
    expect(subscription).toHaveProperty('_id');
    expect(subscription.name).toBe('Spotify');
    expect(subscription.price).toBe('9.99');
    expect(subscription.currency).toBe('USD');
    expect(subscription.frequency).toBe('monthly');
    expect(subscription.payment).toBe('active');
    expect(subscription.category).toBeDefined();
    expect(subscription.user).toBe(testContext.testUser._id.toString());

    // Verify the subscription was actually saved in the database
    const savedSubscription = await Subscription.findById(subscription._id);
    expect(savedSubscription).toBeTruthy();
    expect(savedSubscription.name).toBe('Spotify');
  });

  it('should create subscription with auto-generated category if not exists', async () => {
    // Arrange: Use a new category that doesn't exist
    const subscriptionData = createSubscriptionData({
      category: 'streaming', // New category
    });

    // Act: Create subscription
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData)
      .expect(201);

    // Assert: Verify category was created
    expect(response.body.success).toBe(true);
    const createdCategory = await Category.findOne({ name: 'streaming' });
    expect(createdCategory).toBeTruthy();
    expect(createdCategory.name).toBe('streaming');
  });

  it('should auto-calculate renewalDate when not provided', async () => {
    // Arrange: Data without renewalDate
    const subscriptionData = createSubscriptionData();
    delete subscriptionData.renewalDate; // Remove renewalDate

    // Act: Create subscription
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(subscriptionData)
      .expect(201);

    // Assert: Verify renewalDate was auto-generated
    const { subscription } = response.body.data;
    expect(subscription.renewalDate).toBeDefined();

    // Verify it's after startDate
    const startDate = new Date(subscriptionData.startDate);
    const actualRenewalDate = new Date(subscription.renewalDate);
    expect(actualRenewalDate.getTime()).toBeGreaterThan(startDate.getTime());
  });

  it('should return 400 error when name is missing', async () => {
    // Arrange: Invalid data - missing required 'name' field
    const invalidData = invalidSubscriptionData.missingName;

    // Act: Attempt to create subscription without name
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(invalidData)
      .expect(400); // Bad request due to validation error

    // Assert: Verify error response
    expect(response.body.success).toBeFalsy();

    // Verify no subscription was created in the database
    const count = await Subscription.countDocuments();
    expect(count).toBe(0);
  });

  it('should return 400 error when price is missing', async () => {
    // Arrange: Invalid data - missing required 'price' field
    const invalidData = invalidSubscriptionData.missingPrice;

    // Act: Attempt to create subscription without price
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(invalidData)
      .expect(400);

    // Assert: Verify error response
    expect(response.body.success).toBeFalsy();

    // Verify no subscription was created in the database
    const count = await Subscription.countDocuments();
    expect(count).toBe(0);
  });

  it('should return 400 error when startDate is missing', async () => {
    // Arrange: Invalid data - missing required 'startDate' field
    const invalidData = invalidSubscriptionData.missingStartDate;

    // Act: Attempt to create subscription without startDate
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(invalidData)
      .expect(400);

    // Assert: Verify error response
    expect(response.body.success).toBeFalsy();
  });

  it('should validate currency enum values', async () => {
    // Arrange: Data with invalid currency
    const invalidData = invalidSubscriptionData.invalidCurrency;

    // Act: Attempt to create subscription with invalid currency
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(invalidData)
      .expect(400);

    // Assert: Verify validation error
    expect(response.body.success).toBeFalsy();
  });

  it('should validate frequency enum values', async () => {
    // Arrange: Data with invalid frequency
    const invalidData = invalidSubscriptionData.invalidFrequency;

    // Act: Attempt to create subscription with invalid frequency
    const response = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send(invalidData)
      .expect(400);

    // Assert: Verify validation error
    expect(response.body.success).toBeFalsy();
  });

  it('should return 401 error when authorization token is missing', async () => {
    // Arrange: Valid subscription data but no auth token
    const subscriptionData = createSubscriptionData();

    // Act: Attempt to create subscription without authorization
    const response = await request(app)
      .post('/api/v1/subscription')
      .send(subscriptionData)
      .expect(401);

    // Assert: Verify unauthorized access
    expect(response.body.success).toBeFalsy();
  });
});
