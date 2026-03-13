/**
 * Test Fixtures for User Tests
 * Contains reusable test data, mock objects, and helper functions for user-related tests
 */

import { expect } from 'vitest';

/**
 * Factory function to create valid user registration data.
 * Use `overrides` to produce unique variants without duplicating the entire object
 * (e.g. supply a different `email` to avoid unique-key conflicts across tests).
 *
 * @param {Object} overrides - Properties to merge over the default values
 * @returns {Object} User data ready for API or model use
 */
export const createUserData = (overrides = {}) => ({
  name: 'John Doe',
  email: 'john.doe@example.com',
  password: 'SecurePass123',
  ...overrides,
});

/**
 * Factory that generates an array of user data objects, each with a
 * unique index-based name and email to prevent duplicate-key errors
 * when all items are inserted into the same collection.
 *
 * @param {number} count - Number of objects to generate
 * @param {Object} baseData - Extra fields merged into every generated object
 * @returns {Array<Object>}
 */
export const createMultipleUsers = (count, baseData = {}) => {
  const users = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      name: `Test User ${i}`,
      email: `testuser${i}@example.com`,
      password: 'Password123',
      ...baseData,
    });
  }
  return users;
};

/**
 * Invalid user data scenarios for validation and error-handling tests.
 * Each key represents a single broken-input case; import only the cases
 * relevant to the test being written.
 */
export const invalidUserData = {
  missingName: {
    email: 'noname@example.com',
    password: 'SecurePass123',
  },
  missingEmail: {
    name: 'No Email',
    password: 'SecurePass123',
  },
  missingPassword: {
    name: 'No Password',
    email: 'nopassword@example.com',
  },
  /** Fails the email regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ */
  invalidEmail: {
    name: 'Bad Email',
    email: 'this-is-not-an-email',
    password: 'SecurePass123',
  },
  /** 5 characters – one below the minLength: 6 password threshold */
  shortPassword: {
    name: 'Short Pass',
    email: 'shortpass@example.com',
    password: '12345',
  },
  /** 1 character – one below the minLength: 2 name threshold */
  shortName: {
    name: 'A',
    email: 'shortname@example.com',
    password: 'SecurePass123',
  },
  emptyBody: {},
};

/**
 * Boundary test data targeting the exact min/max constraints defined in the
 * User model schema.  Used to confirm that values AT the boundary are accepted
 * and values just OUTSIDE are rejected.
 *
 * Schema constraints (user.model.js):
 *   name     – minLength: 2, maxLength: 50
 *   email    – minLength: 5, maxLength: 255, match: email regex
 *   password – minLength: 6
 */
export const boundaryUserData = {
  /** name is exactly 2 chars – the lowest allowed value */
  minValidName: {
    name: 'AB',
    email: 'min.name@example.com',
    password: 'SecurePass123',
  },
  /** name is exactly 50 chars – the highest allowed value */
  maxValidName: {
    name: 'A'.repeat(50),
    email: 'max.name@example.com',
    password: 'SecurePass123',
  },
  /** name is 51 chars – one over maxLength, must be rejected */
  nameTooLong: {
    name: 'A'.repeat(51),
    email: 'toolong.name@example.com',
    password: 'SecurePass123',
  },
  /** password is exactly 6 chars – the lowest allowed value */
  minValidPassword: {
    name: 'Min Pass',
    email: 'min.pass@example.com',
    password: 'abc123',
  },
  /** password is 5 chars – one below minLength, must be rejected */
  passwordTooShort: {
    name: 'Too Short Pass',
    email: 'short.pass@example.com',
    password: 'abc12',
  },
};

/**
 * Pre-built common users for reuse across multiple test suites.
 * Each entry has a distinct email to avoid duplicate-key errors when
 * inserted together in the same test run.
 */
export const commonUsers = {
  alice: {
    name: 'Alice Smith',
    email: 'alice.smith@example.com',
    password: 'AlicePass123',
  },
  bob: {
    name: 'Bob Jones',
    email: 'bob.jones@example.com',
    password: 'BobPass123',
  },
  charlie: {
    name: 'Charlie Brown',
    email: 'charlie.brown@example.com',
    password: 'CharliePass123',
  },
};

/**
 * Fields that MUST appear on a user object returned by the API.
 * `password` is intentionally absent – it must never be exposed.
 */
export const expectedUserFields = ['_id', 'name', 'email', 'createdAt', 'updatedAt'];

/**
 * Asserts that a user object from an API response:
 *  - contains every required field listed in `expectedUserFields`
 *  - does NOT contain the `password` field
 *
 * @param {Object} user - User object received from an API response body
 */
export const validateUserStructure = (user) => {
  expectedUserFields.forEach((field) => {
    expect(user).toHaveProperty(field);
  });
  expect(user).not.toHaveProperty('password');
};

/**
 * Matcher shape for a successful single-user API response body.
 * Pass to `expect(response.body).toMatchObject(...)`.
 */
export const expectedUserResponseStructure = {
  success: expect.any(Boolean),
  data: expect.any(Object),
};
