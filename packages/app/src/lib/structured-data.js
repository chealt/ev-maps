// The pages' structured data for search engines (JSON-LD, schema.org; #456):
// what the site is on every indexable page, and on a country page, the
// country's fastest chargers as EVChargingStation places. Layout.astro and
// the country pages embed it.

// Enough to say what the page is about without adding much to its size:
// the page itself holds up to 4,000 chargers for the map.
const MAX_LISTED_CHARGERS = 100;

const website = (site, lang) => ({
  "@type": "WebSite",
  "@id": new URL("/#website", site).href,
  name: "EV Maps",
  url: new URL("/", site).href,
  inLanguage: lang,
  publisher: { "@id": new URL("/#organization", site).href },
});

const organization = (site) => ({
  "@type": "Organization",
  "@id": new URL("/#organization", site).href,
  name: "EV Maps",
  url: new URL("/", site).href,
  logo: new URL("/icon-512.png", site).href,
});

const chargingStation = (charger) => ({
  "@type": "EVChargingStation",
  name: charger.name,
  ...(charger.address ? { address: charger.address } : {}),
  geo: {
    "@type": "GeoCoordinates",
    latitude: charger.location.lat,
    longitude: charger.location.lng,
  },
  ...(charger.operator ? { brand: { "@type": "Brand", name: charger.operator } } : {}),
});

// Every page's: the site and who runs it.
const siteGraph = (site, lang) => [website(site, lang), organization(site)];

// A country page's: the page, with the fastest of its chargers.
const countryGraph = ({ site, lang, url, title, description, chargers }) => {
  const listed = chargers
    .filter((charger) => charger.name && charger.location)
    .toSorted((a, b) => (b.maxPowerKw ?? 0) - (a.maxPowerKw ?? 0))
    .slice(0, MAX_LISTED_CHARGERS);
  return [
    {
      "@type": "CollectionPage",
      "@id": url,
      url,
      name: title,
      description,
      inLanguage: lang,
      isPartOf: { "@id": new URL("/#website", site).href },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: listed.length,
        itemListElement: listed.map((charger, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: chargingStation(charger),
        })),
      },
    },
  ];
};

// The <script type="application/ld+json"> content: "<" escaped, so a
// charger's name can't close the element.
const jsonLd = (graph) =>
  JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll("<", "\\u003c");

export { MAX_LISTED_CHARGERS, countryGraph, jsonLd, siteGraph };
