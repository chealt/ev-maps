import { describe, expect, test } from "bun:test";
import { MAX_LISTED_CHARGERS, countryGraph, jsonLd, siteGraph } from "./structured-data.js";

const SITE = "https://ev.chealt.com";
const charger = (name, maxPowerKw, extra = {}) => ({
  name,
  maxPowerKw,
  location: { lat: 47.5, lng: 19.04 },
  ...extra,
});

describe("siteGraph", () => {
  test("is the website and its organization", () => {
    const [website, organization] = siteGraph(SITE, "hu");
    expect(website).toMatchObject({ "@type": "WebSite", url: `${SITE}/`, inLanguage: "hu" });
    expect(organization).toMatchObject({ "@type": "Organization", logo: `${SITE}/icon-512.png` });
    expect(website.publisher["@id"]).toBe(organization["@id"]);
  });
});

describe("countryGraph", () => {
  const options = {
    site: SITE,
    lang: "en",
    url: `${SITE}/en/hu/`,
    title: "EV chargers in Hungary",
    description: "…",
  };

  test("lists the fastest chargers first, as charging stations", () => {
    const [page] = countryGraph({
      ...options,
      chargers: [
        charger("Slow", 11),
        charger("Fast", 150, { address: "Deák tér", operator: "MOL Plugee" }),
      ],
    });
    expect(page).toMatchObject({ "@type": "CollectionPage", url: `${SITE}/en/hu/` });
    const [first, second] = page.mainEntity.itemListElement;
    expect(first).toMatchObject({
      position: 1,
      item: { "@type": "EVChargingStation", name: "Fast" },
    });
    expect(first.item).toMatchObject({
      address: "Deák tér",
      brand: { name: "MOL Plugee" },
      geo: { latitude: 47.5, longitude: 19.04 },
    });
    expect(second.item.name).toBe("Slow");
    expect(second.item).not.toHaveProperty("brand");
  });

  test("lists at most the limit, and only chargers with a name", () => {
    const chargers = [
      charger(undefined, 300),
      ...Array.from({ length: 150 }, (_, i) => charger(`C${i}`, i)),
    ];
    const [page] = countryGraph({ ...options, chargers });
    expect(page.mainEntity.numberOfItems).toBe(MAX_LISTED_CHARGERS);
    expect(page.mainEntity.itemListElement[0].item.name).toBe("C149");
  });
});

describe("jsonLd", () => {
  test("escapes < so it can't close the script", () => {
    const json = jsonLd([{ name: "</script>" }]);
    expect(json).not.toContain("<");
    expect(JSON.parse(json)["@graph"][0].name).toBe("</script>");
  });
});
