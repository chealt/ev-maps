import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  devToolbar: {
    enabled: process.env.ASTRO_DEV_TOOLBAR !== "false",
  },
});
