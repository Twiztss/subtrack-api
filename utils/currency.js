/**
 * Exchange-rate conversion using exchangerate-api.com (v4 latest/{base}).
 * Subscription amounts are stored as strings; conversion returns a number.
 */

export const SUBSCRIPTION_CURRENCIES = ['USD', 'EUR', 'GBP', 'THB'];

export const convertCurrency = async (amount, from, to) => {
  if (from === to) {
    return amount;
  }
  if (!Number.isFinite(amount)) {
    const error = new Error('Invalid amount for currency conversion');
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
  if (!response.ok) {
    const error = new Error('Failed to fetch exchange rates');
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  const rate = data?.rates?.[to];
  if (rate == null || !Number.isFinite(rate)) {
    const error = new Error(`No exchange rate available for ${from} → ${to}`);
    error.statusCode = 502;
    throw error;
  }

  return amount * rate;
};
