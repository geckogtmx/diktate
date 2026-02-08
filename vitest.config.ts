import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/typescript/**/*.test.ts'],
    setupFiles: ['./tests/typescript/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage_typescript',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'dist/', 'tests/', 'out/', 'release/'],
      thresholds: {
        statements: 2,
        branches: 2,
        functions: 2,
        lines: 2,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
