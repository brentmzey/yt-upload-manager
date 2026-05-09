// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [
      tailwindcss(),
      wasm(),
      topLevelAwait()
    ],
    optimizeDeps: {
      exclude: ['pocketbase', 'brotli-wasm']
    },
    build: {
      target: 'esnext'
    }
  }
});