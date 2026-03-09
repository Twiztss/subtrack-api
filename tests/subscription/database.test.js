/**
 * Database Integration Tests for Subscription Model
 * Tests to verify Mongoose model behavior and database operations
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import Subscription from '../../models/subscription.model.js';
import {
  setupTests,
  teardownTests,
  cleanupTestData,
  testContext,
} from '../helpers/subscription.setup.js';

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
 * Test Suite: Subscription Model Database Integration
 * Tests for direct database operations with Mongoose
 */
describe('Subscription Model - Database Integration', () => {
  it('should save subscription with all fields to MongoDB', async () => {
    // Arrange: Complete subscription data
    const subscriptionData = {
      name: 'Spotify',
      price: '9.99',
      currency: 'USD',
      frequency: 'monthly',
      category: testContext.testCategory._id,
      payment: 'active',
      startDate: new Date('2026-02-01'),
      renewalDate: new Date('2026-03-15'),
      user: testContext.testUser._id,
    };

    // Act: Create subscription directly with Mongoose
    const subscription = await Subscription.create(subscriptionData);

    // Assert: Verify saved data
    expect(subscription._id).toBeDefined();
    expect(subscription.name).toBe('Spotify');
    expect(subscription.price).toBe('9.99');
    expect(subscription.currency).toBe('USD');
    expect(subscription.frequency).toBe('monthly');
    expect(subscription.payment).toBe('active');

    // Verify it can be queried from database
    const found = await Subscription.findById(subscription._id);
    expect(found).toBeTruthy();
    expect(found.name).toBe('Spotify');
  });

  it('should populate category reference when queried', async () => {
    // Arrange: Create subscription with category reference
    const subscription = await Subscription.create({
      name: 'Spotify',
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      renewalDate: new Date('2026-03-15'),
      user: testContext.testUser._id,
    });

    // Act: Query with populate
    const found = await Subscription.findById(subscription._id).populate('category');

    // Assert: Verify category is populated
    expect(found.category).toBeTruthy();
    expect(found.category.name).toBe('entertainment');
  });

  it('should enforce required field validation at model level', async () => {
    // Arrange: Data missing required 'name' field
    const invalidData = {
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      user: testContext.testUser._id,
      // name is missing
    };

    // Act & Assert: Expect validation error
    await expect(Subscription.create(invalidData)).rejects.toThrow();
  });

  it('should trim and validate string fields', async () => {
    // Arrange: Data with extra whitespace
    const subscriptionData = {
      name: '  Spotify  ',
      price: '  9.99  ',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      renewalDate: new Date('2026-03-15'),
      user: testContext.testUser._id,
    };

    // Act: Create subscription
    const subscription = await Subscription.create(subscriptionData);

    // Assert: Verify trimming
    expect(subscription.name).toBe('Spotify');
    expect(subscription.price).toBe('9.99');
  });

  it('should auto-set timestamps (createdAt, updatedAt)', async () => {
    // Arrange & Act: Create subscription
    const subscription = await Subscription.create({
      name: 'Spotify',
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      renewalDate: new Date('2026-03-15'),
      user: testContext.testUser._id,
    });

    // Assert: Verify timestamps exist
    expect(subscription.createdAt).toBeDefined();
    expect(subscription.updatedAt).toBeDefined();
    expect(subscription.createdAt).toBeInstanceOf(Date);
    expect(subscription.updatedAt).toBeInstanceOf(Date);
  });

  it('should validate enum values for frequency field', async () => {
    // Arrange: Invalid frequency value
    const invalidData = {
      name: 'Spotify',
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'invalid_frequency',
      startDate: new Date('2026-02-01'),
      user: testContext.testUser._id,
    };

    // Act & Assert: Expect validation error
    await expect(Subscription.create(invalidData)).rejects.toThrow();
  });

  it('should validate enum values for currency field', async () => {
    // Arrange: Invalid currency value
    const invalidData = {
      name: 'Spotify',
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      currency: 'INVALID_CURRENCY',
      startDate: new Date('2026-02-01'),
      user: testContext.testUser._id,
    };

    // Act & Assert: Expect validation error
    await expect(Subscription.create(invalidData)).rejects.toThrow();
  });

  it('should set default values for optional fields', async () => {
    // Arrange: Minimal subscription data (only required fields)
    const minimalData = {
      name: 'Spotify',
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      user: testContext.testUser._id,
    };

    // Act: Create subscription
    const subscription = await Subscription.create(minimalData);

    // Assert: Verify default values are set
    expect(subscription.currency).toBe('USD'); // Default currency
    expect(subscription.payment).toBe('active'); // Default payment status
  });

  it('should allow updating subscription fields', async () => {
    // Arrange: Create initial subscription
    const subscription = await Subscription.create({
      name: 'Spotify',
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      renewalDate: new Date('2026-03-15'),
      user: testContext.testUser._id,
    });

    // Act: Update subscription
    subscription.price = '12.99';
    subscription.name = 'Spotify Premium';
    const updated = await subscription.save();

    // Assert: Verify updates
    expect(updated.price).toBe('12.99');
    expect(updated.name).toBe('Spotify Premium');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.createdAt.getTime());
  });

  it('should delete subscription from database', async () => {
    // Arrange: Create subscription
    const subscription = await Subscription.create({
      name: 'Spotify',
      price: '9.99',
      category: testContext.testCategory._id,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      user: testContext.testUser._id,
    });

    const subscriptionId = subscription._id;

    // Act: Delete subscription
    await Subscription.findByIdAndDelete(subscriptionId);

    // Assert: Verify deletion
    const found = await Subscription.findById(subscriptionId);
    expect(found).toBeNull();
  });
});
