import { expect, test } from "@playwright/test";
import { fakeAuthApi } from "./fixtures/auth-api.js";
import { fakeChargersApi } from "./fixtures/chargers-api.js";
import { fakeGoogleMaps } from "./fixtures/google.js";

test("has a privacy policy and terms of use in every language", async ({ page }) => {
  for (const { path, heading, updated } of [
    { path: "/en/privacy/", heading: "Privacy policy", updated: "Last updated: November 21, 2026" },
    { path: "/en/terms/", heading: "Terms of use", updated: "Last updated: November 21, 2026" },
    { path: "/pl/privacy/", heading: "Polityka prywatności", updated: /^Ostatnia aktualizacja:/ },
    { path: "/pl/terms/", heading: "Regulamin", updated: /^Ostatnia aktualizacja:/ },
    { path: "/hu/privacy/", heading: "Adatvédelmi tájékoztató", updated: /^Utolsó frissítés:/ },
    { path: "/hu/terms/", heading: "Felhasználási feltételek", updated: /^Utolsó frissítés:/ },
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(updated)).toBeVisible();
  }
});

test("states the terms Google requires for its maps", async ({ page }) => {
  await page.goto("/en/terms/");

  await expect(
    page.getByRole("link", { name: "Google Maps/Google Earth Additional Terms of Service" })
  ).toHaveAttribute("href", "https://maps.google.com/help/terms_maps/");
  await expect(
    page.getByRole("heading", { name: "No crawling, scraping or AI use" })
  ).toBeVisible();
});

test("links the legal pages from the account menu, signed in or not", async ({ page }) => {
  await fakeGoogleMaps(page);
  await fakeAuthApi(page);
  await fakeChargersApi(page);
  await page.goto("/pl/");

  await page.getByRole("button", { name: "Zaloguj się" }).click();
  const legal = page
    .getByRole("dialog", { name: "Konto" })
    .getByRole("navigation", { name: "Informacje prawne" });
  await legal.getByRole("link", { name: "Regulamin" }).click();

  await expect(page).toHaveURL("/pl/terms/");
  await expect(page.getByRole("heading", { level: 1, name: "Regulamin" })).toBeVisible();
  await page.getByRole("link", { name: "Powrót do mapy" }).click();
  await expect(page).toHaveURL("/pl/");
});

test("keeps AI crawlers out, and every crawler out of the API", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();

  for (const bot of ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "PerplexityBot"]) {
    expect(robots).toContain(`User-agent: ${bot}`);
  }
  expect(robots).toMatch(/User-agent: \*\nDisallow: \/api\//);
  // Every page asks not to be used for AI.
  expect(await (await request.get("/en/")).text()).toContain(
    '<meta name="robots" content="noai, noimageai">'
  );
});
