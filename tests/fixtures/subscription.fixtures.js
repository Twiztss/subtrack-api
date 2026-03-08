/**
 * Test Fixtures for Subscription Tests
 * Contains reusable test data, mock objects, and helper functions
 */

/**
 * Factory function to create valid subscription data
 * @param {Object} overrides - Properties to override default values
 * @returns {Object} Subscription data object
 */
export const createSubscriptionData = (overrides = {}) => ({
  name: 'Spotify',
  price: '9.99',
  category: 'entertainment',
  frequency: 'monthly',
  startDate: new Date('2026-02-01'),
  renewalDate: new Date('2026-03-15'),
  currency: 'USD',
  ...overrides,
});

/**
 * Factory function to create multiple subscription test data
 * @param {number} count - Number of subscriptions to create
 * @param {Object} baseData - Base data to use for all subscriptions
 * @returns {Array<Object>} Array of subscription data objects
 */
export const createMultipleSubscriptions = (count, baseData = {}) => {
  const subscriptions = [];
  for (let i = 1; i <= count; i++) {
    subscriptions.push({
      name: `Subscription ${i}`,
      price: `${i}.99`,
      frequency: 'monthly',
      startDate: new Date('2026-02-01'),
      renewalDate: new Date('2026-03-01'),
      ...baseData,
    });
  }
  return subscriptions;
};

/**
 * Invalid subscription data scenarios for validation testing
 */
export const invalidSubscriptionData = {
  missingName: {
    price: '9.99',
    category: 'entertainment',
    frequency: 'monthly',
    startDate: new Date('2026-02-01'),
  },
  missingPrice: {
    name: 'Spotify',
    category: 'entertainment',
    frequency: 'monthly',
    startDate: new Date('2026-02-01'),
  },
  missingStartDate: {
    name: 'Spotify',
    price: '9.99',
    category: 'entertainment',
    frequency: 'monthly',
  },
  invalidCurrency: {
    name: 'Spotify',
    price: '9.99',
    category: 'entertainment',
    frequency: 'monthly',
    startDate: new Date('2026-02-01'),
    currency: 'INVALID_CURRENCY',
  },
  invalidFrequency: {
    name: 'Spotify',
    price: '9.99',
    category: 'entertainment',
    frequency: 'biweekly',
    startDate: new Date('2026-02-01'),
  },
};

/**
 * Common test subscriptions for reuse across test suites
 */
export const commonSubscriptions = {
  spotify: {
    name: 'Spotify',
    price: '9.99',
    frequency: 'monthly',
    startDate: new Date('2026-02-01'),
    renewalDate: new Date('2026-03-15'),
  },
  netflix: {
    name: 'Netflix',
    price: '15.99',
    frequency: 'monthly',
    startDate: new Date('2026-02-01'),
    renewalDate: new Date('2026-03-01'),
  },
  disneyPlus: {
    name: 'Disney+',
    price: '7.99',
    frequency: 'monthly',
    startDate: new Date('2026-02-01'),
    renewalDate: new Date('2026-03-01'),
  },
};

/**
 * Expected response structure for assertions
 */
export const expectedResponseStructure = {
  success: expect.any(Boolean),
  data: expect.any(Object),
};

export const expectedPaginatedResponseStructure = {
  success: expect.any(Boolean),
  data: expect.any(Array),
  meta: {
    total: expect.any(Number),
    page: expect.any(Number),
    limit: expect.any(Number),
    totalPages: expect.any(Number),
  },
};

/**
 * Expected subscription schema fields
 */
export const expectedSubscriptionFields = [
  '_id',
  'name',
  'price',
  'category',
  'frequency',
  'startDate',
  'renewalDate',
  'user',
  'payment',
  'currency',
];

/**
 * Helper function to validate subscription object structure
 * @param {Object} subscription - Subscription object to validate
 */
export const validateSubscriptionStructure = (subscription) => {
  expectedSubscriptionFields.forEach((field) => {
    expect(subscription).toHaveProperty(field);
  });
};

/**
 * Date calculation helpers
 */
export const dateHelpers = {
  addDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },
  addMonths: (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  },
};
