import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  srcDir: './src',
  publicDir: './public',
  build: {
    outDir: './dist',
  },
  vite: {
    define: {
      global: {},
    },
    esbuild: {
      define: {
        HTMLElement: 'HTMLElement',
        customElements: 'customElements',
        ShadowRoot: 'ShadowRoot',
      },
    },
  },
});
