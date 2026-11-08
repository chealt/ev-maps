import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',
  }),
  srcDir: './src',
  publicDir: './public',
  build: {
    outDir: './dist',
  },
});
