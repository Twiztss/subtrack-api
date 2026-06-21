import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('Express security baseline', () => {
  it('sets common security headers and hides Express fingerprinting', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});
