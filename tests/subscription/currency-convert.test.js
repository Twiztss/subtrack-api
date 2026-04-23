/**
 * Integration tests for PUT /api/v1/subscription/:id/convert
 * Converts stored price from the subscription’s current currency to a target
 * currency (exercise rates via mocked convertCurrency; no real HTTP).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app.js';
import Subscription from '../../models/subscription.model.js';
import User from '../../models/user.model.js';
import { convertCurrency, SUBSCRIPTION_CURRENCIES } from '../../utils/currency.js';
import {
  setupTests,
  teardownTests,
  cleanupTestData,
  testContext,
  createTestSubscription,
} from '../helpers/subscription.setup.js';
import { commonSubscriptions } from '../fixtures/subscription.fixtures.js';

vi.mock('../../utils/currency.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    convertCurrency: vi.fn(),
  };
});

beforeAll(async () => {
  await setupTests();
});

afterEach(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  await teardownTests();
});

describe('PUT /api/v1/subscription/:id/convert - Currency exchange', () => {
  beforeEach(() => {
    vi.mocked(convertCurrency).mockReset();
    vi.mocked(convertCurrency).mockImplementation(async (amount, from, to) => {
      if (from === to) return amount;
      return amount * 1.1;
    });
  });

  it('should convert price and set currency to the target', async () => {
    const sub = await createTestSubscription({
      ...commonSubscriptions.spotify,
      price: '10.00',
      currency: 'USD',
    });

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/convert`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ currency: 'EUR' })
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body.success).toBe(true);
    expect(response.body.data.currency).toBe('EUR');
    expect(response.body.data.price).toBe('11.00');
    expect(vi.mocked(convertCurrency)).toHaveBeenCalledWith(10, 'USD', 'EUR');

    const db = await Subscription.findById(sub._id);
    expect(db.currency).toBe('EUR');
    expect(db.price).toBe('11.00');
  });

  it('should use USD when stored currency is missing and still convert', async () => {
    const sub = await createTestSubscription({
      ...commonSubscriptions.netflix,
      price: '20.00',
    });
    await Subscription.findByIdAndUpdate(sub._id, { $unset: { currency: 1 } });

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/convert`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ currency: 'THB' })
      .expect(200);

    expect(vi.mocked(convertCurrency)).toHaveBeenCalledWith(20, 'USD', 'THB');
    expect(response.body.data.currency).toBe('THB');
    expect(response.body.data.price).toBe('22.00');
  });

  it('should support converting to the same currency (no rate change in mock identity branch)', async () => {
    vi.mocked(convertCurrency).mockImplementation(async (amount, from, to) => {
      if (from === to) return amount;
      return amount * 99;
    });

    const sub = await createTestSubscription({
      ...commonSubscriptions.spotify,
      price: '9.99',
      currency: 'GBP',
    });

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/convert`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ currency: 'GBP' })
      .expect(200);

    expect(response.body.data.currency).toBe('GBP');
    expect(response.body.data.price).toBe('9.99');
    expect(vi.mocked(convertCurrency)).toHaveBeenCalledWith(9.99, 'GBP', 'GBP');
  });

  it('should return 400 when target currency is missing', async () => {
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/convert`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/target currency is required/i);
    expect(vi.mocked(convertCurrency)).not.toHaveBeenCalled();
  });

  it('should return 400 when target currency is not allowed', async () => {
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/convert`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ currency: 'JPY' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/currency must be one of/i);
    expect(SUBSCRIPTION_CURRENCIES.length).toBe(4);
  });

  it('should return 404 when the subscription id does not exist', async () => {
    const id = new mongoose.Types.ObjectId();

    const response = await request(app)
      .put(`/api/v1/subscription/${id}/convert`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ currency: 'EUR' })
      .expect(404);

    expect(response.body.message).toMatch(/no subscription with that id/i);
  });

  it('should return 404 when the subscription id is not a valid ObjectId', async () => {
    const response = await request(app)
      .put('/api/v1/subscription/not-a-valid-id/convert')
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ currency: 'EUR' })
      .expect(404);
    expect(response.body.success).toBe(false);
  });

  it('should return 401 when the subscription belongs to another user', async () => {
    const other = await User.create({
      name: 'Other',
      email: 'other-currency@example.com',
      password: 'hashedPassword456',
    });

    try {
      const sub = await createTestSubscription(commonSubscriptions.spotify);
      await Subscription.findByIdAndUpdate(sub._id, { user: other._id });

      const response = await request(app)
        .put(`/api/v1/subscription/${sub._id}/convert`)
        .set('Authorization', `Bearer ${testContext.authToken}`)
        .send({ currency: 'EUR' })
        .expect(401);

      expect(response.body.message).toMatch(/incorrect user credential/i);
    } finally {
      await User.deleteOne({ _id: other._id });
    }
  });

  it('should return 401 when no authorization token is provided', async () => {
    const sub = await createTestSubscription(commonSubscriptions.spotify);

    await request(app)
      .put(`/api/v1/subscription/${sub._id}/convert`)
      .send({ currency: 'EUR' })
      .expect(401);
  });

  it('should surface conversion failures (e.g. 502) from the rate provider', async () => {
    const err = new Error('Failed to fetch exchange rates');
    err.statusCode = 502;
    vi.mocked(convertCurrency).mockRejectedValueOnce(err);

    const sub = await createTestSubscription({
      ...commonSubscriptions.spotify,
      currency: 'USD',
    });

    const response = await request(app)
      .put(`/api/v1/subscription/${sub._id}/convert`)
      .set('Authorization', `Bearer ${testContext.authToken}`)
      .send({ currency: 'EUR' })
      .expect(502);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/failed to fetch exchange rates/i);
  });
});
