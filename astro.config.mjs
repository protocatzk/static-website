// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// GitHub Pages: https://protocatzk.github.io/static-website/
export default defineConfig({
  site: 'https://protocatzk.github.io',
  base: '/static-website',
  output: 'static',
  build: {
    // Clean URLs friendly for static hosts
    format: 'directory',
  },
  vite: {
    // v86 ships prebuilt ESM + wasm; load on demand via dynamic import
    optimizeDeps: {
      exclude: ['v86'],
    },
  },
});
