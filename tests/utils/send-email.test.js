import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendReminderEmail } from '../../utils/send-email.js';

describe('utils/send-email', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not log email success messages in test mode', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await sendReminderEmail({
      to: 'test@example.com',
      userName: 'Test User',
      type: 'subscription-created',
      subscription: {
        name: 'Spotify',
        renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currency: 'USD',
        price: '9.99',
        payment: 'active',
      },
    });

    expect(logSpy).not.toHaveBeenCalled();
  });
});
