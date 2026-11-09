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
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_MAPS_API_KEY || ''),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_CLIENT_ID || ''),
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
