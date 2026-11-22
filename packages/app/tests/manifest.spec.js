import { expect, test } from "@ev-maps/e2e/test.js";

// The web app manifest is what browsers read to install the app, so these
// tests check what it tells them.

test("describes the app in each language", async ({ request }) => {
  for (const { lang, description } of [
    { lang: "en", description: "Find electric vehicle charging stations near you" },
    { lang: "pl", description: "Znajdź stacje ładowania samochodów elektrycznych w pobliżu" },
    { lang: "hu", description: "Találd meg a közeli elektromosautó-töltőállomásokat" },
  ]) {
    const response = await request.get(`/${lang}/manifest.webmanifest`);
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({
      name: "EV Maps",
      lang,
      description,
      start_url: "/",
      display: "standalone",
    });
  }
});

test("has icons for every purpose, and they exist", async ({ request }) => {
  const { icons } = await (await request.get("/en/manifest.webmanifest")).json();

  expect(icons.map(({ sizes, purpose }) => `${sizes} ${purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);
  for (const { src } of icons) {
    const response = await request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});
