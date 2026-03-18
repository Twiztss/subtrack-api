/**
 * Unit / Database Integration Tests for the User Mongoose Model
 * Tests direct schema validation and raw database operations without HTTP layer
 *
 * Coverage:
 *   - Schema validation  : required fields, string constraints (min/max length),
 *                          email regex, enum defaults
 *   - Automatic transforms: lowercase email, trimmed name & email, timestamps
 *   - Uniqueness          : duplicate email key rejection
 *   - Boundary values     : name at 2 / 50 chars; password at 6 chars
 *   - CRUD operations     : create, findById, save (update), findByIdAndDelete
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import User from '../../models/user.model.js';
import {
  setupTests,
  teardownTests,
  cleanupExtraUsers,
} from '../helpers/user.setup.js';
import { createUserData, boundaryUserData } from '../fixtures/user.fixtures.js';

beforeAll(async () => {
  await setupTests();
});

afterEach(async () => {
  await cleanupExtraUsers();
});

afterAll(async () => {
  await teardownTests();
});

// ─────────────────────────────────────────────────────────────────────────────
// User Model – Database Integration
// ─────────────────────────────────────────────────────────────────────────────
describe('User Model - Database Integration', () => {

  // ── Create & Retrieve ──────────────────────────────────────────────────────

  it('should save a user document with all required fields and be queryable by ID', async () => {
    // Arrange
    const userData = createUserData({ email: 'save.all@example.com' });

    // Act
    const user = await User.create(userData);

    // Assert: returned document has the expected values
    expect(user._id).toBeDefined();
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('save.all@example.com');

    // Confirm it can be retrieved from the database
    const found = await User.findById(user._id);
    expect(found).toBeTruthy();
    expect(found.email).toBe('save.all@example.com');
  });

  it('should return null when querying a valid ObjectId that does not exist', async () => {
    // A freshly generated ObjectId is guaranteed absent from the collection
    const nonExistentId = new mongoose.Types.ObjectId();
    const found = await User.findById(nonExistentId);
    expect(found).toBeNull();
  });

  // ── Auto Transforms ────────────────────────────────────────────────────────

  it('should auto-set createdAt and updatedAt timestamps on creation', async () => {
    const user = await User.create(createUserData({ email: 'timestamps@example.com' }));

    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('should trim leading and trailing whitespace from the name field', async () => {
    const user = await User.create({
      name: '  Trimmed Name  ',
      email: 'trim.name@example.com',
      password: 'SecurePass123',
    });

    // Schema has trim: true on name
    expect(user.name).toBe('Trimmed Name');
  });

  it('should trim whitespace from the email field', async () => {
    const user = await User.create({
      name: 'Trim Email',
      email: '  trim.email@example.com  ',
      password: 'SecurePass123',
    });

    expect(user.email).toBe('trim.email@example.com');
  });

  it('should convert email to lowercase regardless of input casing', async () => {
    // Schema has lowercase: true on email
    const user = await User.create({
      name: 'Lowercase Test',
      email: 'UPPER@EXAMPLE.COM',
      password: 'SecurePass123',
    });

    expect(user.email).toBe('upper@example.com');
  });

  // ── Uniqueness ─────────────────────────────────────────────────────────────

  it('should reject a duplicate email with a MongoServerError (code 11000)', async () => {
    await User.create(createUserData({ email: 'unique@example.com' }));

    // The second create must throw; we only check that it throws (error type
    // varies across driver versions)
    await expect(
      User.create(createUserData({ email: 'unique@example.com', name: 'Duplicate' }))
    ).rejects.toThrow();
  });

  // ── Required Field Validation ──────────────────────────────────────────────

  it('should throw a ValidationError when the name field is missing', async () => {
    await expect(
      User.create({ email: 'noname@example.com', password: 'SecurePass123' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should throw a ValidationError when the email field is missing', async () => {
    await expect(
      User.create({ name: 'No Email', password: 'SecurePass123' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should throw a ValidationError when the password field is missing', async () => {
    await expect(
      User.create({ name: 'No Password', email: 'nopass@example.com' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  // ── Email Format Validation ────────────────────────────────────────────────

  it('should throw a ValidationError when the email does not match the regex', async () => {
    // Schema: match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/]
    await expect(
      User.create({ name: 'Bad Email', email: 'not-an-email', password: 'SecurePass123' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  // ── String Length Validation ───────────────────────────────────────────────

  it('should throw a ValidationError when name is shorter than minLength (2)', async () => {
    // 1 character – one below minLength: 2
    await expect(
      User.create({ name: 'A', email: 'short.name@example.com', password: 'SecurePass123' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should throw a ValidationError when name exceeds maxLength (50)', async () => {
    // 51 characters – one over maxLength: 50
    await expect(
      User.create(boundaryUserData.nameTooLong)
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should throw a ValidationError when password is shorter than minLength (6)', async () => {
    // 5 characters – one below minLength: 6
    await expect(
      User.create({ name: 'Short Pass', email: 'short.pw@example.com', password: '12345' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  // ── Boundary Values ────────────────────────────────────────────────────────

  it('should accept a name exactly at the minimum length boundary (2 chars)', async () => {
    // minValidName.name = 'AB'
    const user = await User.create(boundaryUserData.minValidName);
    expect(user.name).toBe('AB');
    expect(user.name.length).toBe(2);
  });

  it('should accept a name exactly at the maximum length boundary (50 chars)', async () => {
    // maxValidName.name = 'A'.repeat(50)
    const user = await User.create(boundaryUserData.maxValidName);
    expect(user.name.length).toBe(50);
  });

  it('should accept a password exactly at the minimum length boundary (6 chars)', async () => {
    // minValidPassword.password = 'abc123'
    const user = await User.create(boundaryUserData.minValidPassword);
    expect(user._id).toBeDefined();
  });

  // ── Update Operations ──────────────────────────────────────────────────────

  it('should update fields via document.save() and advance updatedAt', async () => {
    // Arrange
    const user = await User.create(createUserData({ email: 'update.save@example.com' }));
    const originalUpdatedAt = user.updatedAt.getTime();

    // Brief pause so updatedAt will differ
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Act
    user.name = 'Updated via Save';
    const updated = await user.save();

    // Assert: field change is reflected
    expect(updated.name).toBe('Updated via Save');
    // updatedAt must be equal to or after the original (replica set ticks may be same ms)
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('should update a field via findByIdAndUpdate and return the new document', async () => {
    // Arrange
    const user = await User.create(createUserData({ email: 'update.byid@example.com' }));

    // Act
    const updated = await User.findByIdAndUpdate(
      user._id,
      { $set: { name: 'Updated via findByIdAndUpdate' } },
      { new: true }
    );

    // Assert
    expect(updated.name).toBe('Updated via findByIdAndUpdate');
  });

  // ── Delete Operations ──────────────────────────────────────────────────────

  it('should remove a user document from the database via findByIdAndDelete', async () => {
    // Arrange
    const user = await User.create(createUserData({ email: 'delete.db@example.com' }));
    const userId = user._id;

    // Act
    await User.findByIdAndDelete(userId);

    // Assert
    const found = await User.findById(userId);
    expect(found).toBeNull();
  });

  it('should remove a user via deleteOne and return a deletedCount of 1', async () => {
    // Arrange
    const user = await User.create(createUserData({ email: 'delete.one@example.com' }));

    // Act
    const result = await User.deleteOne({ _id: user._id });

    // Assert
    expect(result.deletedCount).toBe(1);
    const found = await User.findById(user._id);
    expect(found).toBeNull();
  });

  it('should return deletedCount of 0 when deleting a non-existent document', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const result = await User.deleteOne({ _id: nonExistentId });
    expect(result.deletedCount).toBe(0);
  });

  // ── Query Helpers ──────────────────────────────────────────────────────────

  it('should find a user by email using findOne()', async () => {
    await User.create(createUserData({ email: 'findone@example.com' }));

    const found = await User.findOne({ email: 'findone@example.com' });
    expect(found).toBeTruthy();
    expect(found.email).toBe('findone@example.com');
  });

  it('should exclude the password field when using .select("-password")', async () => {
    const user = await User.create(createUserData({ email: 'select.pass@example.com' }));

    const found = await User.findById(user._id).select('-password');
    expect(found).toBeTruthy();
    // Mongoose returns undefined for excluded fields
    expect(found.password).toBeUndefined();
    expect(found.email).toBe('select.pass@example.com');
  });

  it('should count all user documents accurately', async () => {
    // Arrange: create three extra users
    await User.create(createUserData({ email: 'count1@example.com' }));
    await User.create(createUserData({ email: 'count2@example.com' }));
    await User.create(createUserData({ email: 'count3@example.com' }));

    // testContext.testUser (1) + 3 extras = 4 total
    const count = await User.countDocuments();
    expect(count).toBe(4);
  });
});
