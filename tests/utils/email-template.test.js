import { describe, expect, it } from 'vitest';
import { generateEmailTemplate } from '../../utils/email-template.js';

describe('utils/email-template', () => {
  it('escapes user-controlled content before embedding it in HTML', () => {
    const html = generateEmailTemplate({
      userName: '<script>alert("user")</script>',
      subscriptionName: '<img src=x onerror=alert(1)>',
      renewalDate: 'Jun 20, 2026',
      planName: '<b>Premium</b>',
      price: 'USD 9.99',
      paymentStatus: 'active',
      accountSettingsLink: 'https://example.com/account',
      supportLink: 'https://example.com/support',
      daysLeft: 3,
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;alert(&quot;user&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;Premium&lt;/b&gt;');
  });

  it('falls back to safe hrefs when email links use unsafe protocols', () => {
    const html = generateEmailTemplate({
      userName: 'Test User',
      subscriptionName: 'Spotify',
      renewalDate: 'Jun 20, 2026',
      planName: 'Premium',
      price: 'USD 9.99',
      paymentStatus: 'active',
      accountSettingsLink: 'javascript:alert(1)',
      supportLink: 'data:text/html,<script>alert(1)</script>',
      daysLeft: 3,
    });

    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).not.toContain('href="data:text/html');
    expect(html).toContain('href="#"');
  });
});
