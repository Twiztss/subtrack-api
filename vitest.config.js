import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret',
      JWT_EXPIRES_IN: '1h',
      ENABLE_ARCJET: 'false',
      ENABLE_WORKFLOW: 'false',
      QSTASH_URL: 'https://qstash.example.test',
      QSTASH_TOKEN: 'test-qstash-token',
      QSTASH_CURRENT_SIGNING_KEY: 'test-current-signing-key',
      QSTASH_NEXT_SIGNING_KEY: 'test-next-signing-key',
    },

    // Test environment
    environment: 'node',
    
    // Global test timeout (30 seconds for integration tests)
    testTimeout: 30000,
    
    // Hook timeouts
    hookTimeout: 30000,
    
    // Coverage configuration (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
      ],
    },
    
    // Globals (so you don't need to import describe, it, expect in every file)
    globals: true,
    
    // Reporter
    reporter: 'verbose',
    
    // Separate threads for parallel tests
    threads: true,
    
    // Disable isolation for faster tests (use with caution)
    // isolate: false,
  },
});
