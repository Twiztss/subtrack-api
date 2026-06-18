/**
 * Exchange-rate conversion using exchangerate-api.com (v4 latest/{base}).
 * Subscription amounts are stored as strings; conversion returns a number.
 * Rates are cached in-memory per base currency with a 10-minute TTL to avoid
 * hammering the upstream API on every conversion request.
 */

export const SUBSCRIPTION_CURRENCIES = ['USD', 'EUR', 'GBP', 'THB'];

const RATE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const rateCache = new Map(); // key: baseCurrency -> { rates, fetchedAt }

/** Clear the in-memory rate cache (used in tests). */
export const clearRateCache = () => rateCache.clear();

const fetchRates = async (from) => {
  const cached = rateCache.get(from);
  if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_TTL_MS) {
    return cached.rates;
  }

  const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
  if (!response.ok) {
    const error = new Error('Failed to fetch exchange rates');
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  rateCache.set(from, { rates: data.rates, fetchedAt: Date.now() });
  return data.rates;
};

export const convertCurrency = async (amount, from, to) => {
  if (from === to) {
    return amount;
  }
  if (!Number.isFinite(amount)) {
    const error = new Error('Invalid amount for currency conversion');
    error.statusCode = 400;
    throw error;
  }

  const rates = await fetchRates(from);
  const rate = rates?.[to];
  if (rate == null || !Number.isFinite(rate)) {
    const error = new Error(`No exchange rate available for ${from} → ${to}`);
    error.statusCode = 502;
    throw error;
  }

  return amount * rate;
};
