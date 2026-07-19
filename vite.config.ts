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
  },
});
