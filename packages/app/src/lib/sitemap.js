// The sitemap (src/pages/sitemap.xml.js, #456): every page search engines
// may index, in every language, each with its other languages as hreflang
// alternates, so a search engine shows the page in its user's language.
// `paths` are relative to a language, e.g. "" for /en/, "hu/" for /en/hu/;
// the pages with noindex (admin, saved places, suggestions) aren't in it.

const escapeXml = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const pageUrl = (site, language, path) => new URL(`/${language}/${path}`, site).href;

// For a visitor whose language has no page: the home page's is /, which the
// Worker sends to their language and country; any other page's, English.
const defaultUrl = (site, path) => (path ? pageUrl(site, "en", path) : new URL("/", site).href);

const sitemapXml = (site, languages, paths) => {
  const urls = paths.flatMap((path) =>
    languages.map((language) => {
      const alternates = [
        ...languages.map((other) => [other, pageUrl(site, other, path)]),
        ["x-default", defaultUrl(site, path)],
      ]
        .map(
          ([hreflang, href]) =>
            `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`
        )
        .join("\n");
      return `  <url>\n    <loc>${escapeXml(pageUrl(site, language, path))}</loc>\n${alternates}\n  </url>`;
    })
  );
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${urls.join("\n")}\n</urlset>\n`
  );
};

export { defaultUrl, pageUrl, sitemapXml };
