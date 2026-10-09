import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Two projects, split by whether a suite needs a DOM.
//
// jsdom costs about a second of setup per file and a lot of memory, and it was being paid by every
// suite. Only the component tests need it: no `tests/**/*.test.ts` file touches document, window,
// localStorage, matchMedia or testing-library, which the contract test in
// tests/vitest-projects.test.ts keeps true. Splitting them took a full local run from unaffordable
// on a memory-constrained machine to seconds for the suites most changes touch.
//
// `extends: true` inherits the plugins and aliases below, so a project only states its difference.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    testTimeout: 15000,
    exclude: ['tests/e2e/**', 'node_modules/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.tsx'],
          exclude: ['tests/e2e/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/e2e/**'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'next/navigation': path.resolve(__dirname, './node_modules/next/navigation.js'),
      'next/server': path.resolve(__dirname, './node_modules/next/server.js'),
      'server-only': path.resolve(__dirname, './tests/shims/server-only.ts'),
    },
  },
})
