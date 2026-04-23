/**
 * Unit tests for utils/currency.js (convertCurrency) with a stubbed fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convertCurrency } from '../../utils/currency.js';

describe('utils/currency — convertCurrency', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the same amount when from and to are identical (no fetch)', async () => {
    const result = await convertCurrency(42.5, 'USD', 'USD');
    expect(result).toBe(42.5);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('multiplies by the target rate from the API response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { EUR: 0.85 } }),
    });

    const result = await convertCurrency(100, 'USD', 'EUR');
    expect(result).toBe(85);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.exchangerate-api.com/v4/latest/USD'
    );
  });

  it('throws 400 when amount is not a finite number', async () => {
    await expect(convertCurrency(NaN, 'USD', 'EUR')).rejects.toMatchObject({
      message: expect.stringMatching(/invalid amount/i),
      statusCode: 400,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('throws 502 when the HTTP response is not ok', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(convertCurrency(10, 'USD', 'EUR')).rejects.toMatchObject({
      message: expect.stringMatching(/failed to fetch exchange rates/i),
      statusCode: 502,
    });
  });

  it('throws 502 when the target rate is missing from the payload', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { GBP: 0.8 } }),
    });

    await expect(convertCurrency(10, 'USD', 'EUR')).rejects.toMatchObject({
      message: expect.stringMatching(/no exchange rate available/i),
      statusCode: 502,
    });
  });
});
