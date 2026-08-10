/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/, so the deploy workflow
  // sets VITE_BASE. Dev and local builds stay at the root.
  base: process.env.VITE_BASE ?? '/',
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
