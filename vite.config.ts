/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * A feature switch as a literal the bundler can see.
 *
 * Substituted into the source before anything else runs, so `if (__FEATURE_X__)`
 * becomes `if (false)` and the branch — with everything only it reached — folds away.
 * Reading `import.meta.env` at runtime instead would leave all of it in the bundle,
 * turned off but still downloaded. See `src/config/features.ts`.
 */
const flag = (value: string | undefined): string =>
  JSON.stringify(!['false', '0', 'off', 'no'].includes((value ?? '').trim().toLowerCase()));

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/, so the deploy workflow
  // sets VITE_BASE. Dev and local builds stay at the root.
  base: process.env.VITE_BASE ?? '/',
  define: {
    __FEATURE_PYTHON_CONSOLE__: flag(process.env.VITE_FEATURE_PYTHON_CONSOLE),
    __FEATURE_NOTEBOOK__: flag(process.env.VITE_FEATURE_NOTEBOOK),
  },
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    // Keep CRA's output directory so existing deploy/serve steps stay valid.
    outDir: 'build',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Entry points and type-only modules have nothing to exercise; counting
      // them only dilutes the number the rest of the source is judged by.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/index.tsx',
        'src/setupTests.ts',
        'src/vite-env.d.ts',
        'src/types/**',
        'src/assets/**',
      ],
    },
  },
});
