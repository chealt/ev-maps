import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  srcDir: "./src",
  publicDir: "./public",
  build: {
    outDir: "./dist",
  },
  vite: {
    define: {
      global: {},
      'import.meta.env.GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.GOOGLE_MAPS_API_KEY || ''),
      'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID || ''),
    },
    esbuild: {
      define: {
        HTMLElement: "HTMLElement",
        customElements: "customElements",
        ShadowRoot: "ShadowRoot",
      },
    },
  },
});
