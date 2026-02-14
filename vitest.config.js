import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
