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
        statements: 4,
        branches: 4,
        functions: 4,
        lines: 4,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
