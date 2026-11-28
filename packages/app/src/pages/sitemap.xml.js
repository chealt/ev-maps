// /sitemap.xml, built with the site (src/lib/sitemap.js): each language's
// map, country pages and legal pages. public/robots.txt points to it.

import { languages, listCountries } from "../lib/pages.js";
import { sitemapXml } from "../lib/sitemap.js";

const GET = ({ site }) =>
  new Response(
    sitemapXml(site, languages(), [
      "",
      ...listCountries().map(({ country }) => `${country}/`),
      "privacy/",
      "terms/",
    ]),
    { headers: { "content-type": "application/xml; charset=utf-8" } }
  );

export { GET };
