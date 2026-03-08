/**
 * Integration Tests for GET /api/v1/subscription
 * Tests for retrieving subscriptions with pagination and filtering
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import {
  setupTests,
  teardownTests,
  cleanupTestData,
  testContext,
  createTestSubscription,
  createTestSubscriptions,
} from '../helpers/subscription.setup.js';
import {
  commonSubscriptions,
  createMultipleSubscriptions,
  expectedPaginatedResponseStructure,
  validateSubscriptionStructure,
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
 * Test Suite: GET /api/v1/subscription
 * Tests for retrieving all subscriptions
 */
describe('GET /api/v1/subscription - Retrieve Subscriptions', () => {
  it('should retrieve all subscriptions with correct schema', async () => {
    // Arrange: Create multiple test subscriptions
    await createTestSubscription(commonSubscriptions.spotify);
    await createTestSubscription(commonSubscriptions.netflix);

    // Act: Get all subscriptions
    const response = await request(app)
      .get('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert: Verify response structure
    expect(response.body).toMatchObject(expectedPaginatedResponseStructure);
    expect(response.body.success).toBe(true);

    // Verify data is an array
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(2);

    // Verify subscription schema
    const subscription = response.body.data[0];
    validateSubscriptionStructure(subscription);
  });

  it('should return empty array when no subscriptions exist', async () => {
    // Arrange: No subscriptions in database (cleaned by afterEach)

    // Act: Get all subscriptions
    const response = await request(app)
      .get('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: Verify empty response
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it('should support pagination with page and limit query params', async () => {
    // Arrange: Create 15 test subscriptions
    const subscriptions = createMultipleSubscriptions(15);
    await createTestSubscriptions(subscriptions);

    // Act: Get page 2 with limit of 5
    const response = await request(app)
      .get('/api/v1/subscription?page=2&limit=5')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: Verify pagination
    expect(response.body.meta.total).toBe(15);
    expect(response.body.meta.page).toBe(2);
    expect(response.body.meta.limit).toBe(5);
    expect(response.body.meta.totalPages).toBe(3);
    expect(response.body.data.length).toBe(5);
  });

  it('should handle default pagination when query params not provided', async () => {
    // Arrange: Create 3 subscriptions
    await createTestSubscriptions([
      commonSubscriptions.spotify,
      commonSubscriptions.netflix,
      commonSubscriptions.disneyPlus,
    ]);

    // Act: Get subscriptions without pagination params
    const response = await request(app)
      .get('/api/v1/subscription')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: Verify default pagination (page=1, limit=10)
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.limit).toBe(10);
    expect(response.body.data.length).toBe(3);
  });

  it('should return 401 error when authorization token is missing', async () => {
    // Act: Attempt to get subscriptions without authorization
    const response = await request(app)
      .get('/api/v1/subscription')
      .expect(401);

    // Assert: Verify unauthorized access
    expect(response.body.success).toBeFalsy();
  });

  it('should handle pagination edge cases correctly', async () => {
    // Arrange: Create 7 subscriptions
    const subscriptions = createMultipleSubscriptions(7);
    await createTestSubscriptions(subscriptions);

    // Act: Request page 3 with limit of 3 (should return 1 item)
    const response = await request(app)
      .get('/api/v1/subscription?page=3&limit=3')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: Verify edge case handling
    expect(response.body.meta.total).toBe(7);
    expect(response.body.meta.page).toBe(3);
    expect(response.body.meta.limit).toBe(3);
    expect(response.body.meta.totalPages).toBe(3);
    expect(response.body.data.length).toBe(1); // Only 1 item on last page
  });

  it('should return empty data when requesting page beyond total pages', async () => {
    // Arrange: Create 5 subscriptions
    const subscriptions = createMultipleSubscriptions(5);
    await createTestSubscriptions(subscriptions);

    // Act: Request page 10 (beyond available data)
    const response = await request(app)
      .get('/api/v1/subscription?page=10&limit=10')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .expect(200);

    // Assert: Verify empty data for out-of-range page
    expect(response.body.meta.total).toBe(5);
    expect(response.body.meta.page).toBe(10);
    expect(response.body.data.length).toBe(0);
  });
});
