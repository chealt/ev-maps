// The web app manifest, one per language: /en/manifest.webmanifest, ... The
// app starts at /, which the Worker sends to the user's language and country.

import { translations } from "../../i18n/index.js";
import { languages } from "../../lib/pages.js";

// The brand color (Layout.astro's theme-color) and the light background.
const THEME_COLOR = "#059669";
const BACKGROUND_COLOR = "#f1f5f9";

const getStaticPaths = () => languages().map((lang) => ({ params: { lang } }));

const manifest = (lang) => {
  const { page } = translations(lang);
  return {
    id: "/",
    name: "EV Maps",
    short_name: "EV Maps",
    description: page.subtitle,
    lang,
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
};

const GET = ({ params }) =>
  new Response(JSON.stringify(manifest(params.lang)), {
    headers: { "content-type": "application/manifest+json" },
  });

export { GET, getStaticPaths };
