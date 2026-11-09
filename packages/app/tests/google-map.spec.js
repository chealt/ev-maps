import { test, expect } from '@playwright/test';

// Test GoogleMap component

test('GoogleMap component loads', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('ev-google-map');
  await expect(map).toBeVisible();
});

test('GoogleMap shows user location', async ({ page }) => {
  await page.goto('/');
  const locateButton = page.locator('.locate-button');
  await locateButton.click();
  const status = page.locator('.map-status');
  await expect(status).toContainText('Location:');
});

test('GoogleMap shows EV chargers', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('ev-google-map');
  await expect(map).toHaveAttribute('data-show-ev-chargers', 'true');
  const markers = page.locator('.gm-marker');
  await expect(markers).toHaveCountGreaterThan(0);
});

test('GoogleMap shows charger details', async ({ page }) => {
  await page.goto('/');
  const marker = page.locator('.gm-marker').first();
  await marker.click();
  const detailsPanel = page.locator('.charger-details');
  await expect(detailsPanel).toBeVisible();
});
