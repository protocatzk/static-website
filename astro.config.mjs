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
});
