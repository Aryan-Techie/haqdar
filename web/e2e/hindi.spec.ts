import { expect, test } from "@playwright/test";

const DEVANAGARI = /[ऀ-ॿ]/;

test("Hindi: home and first chat question are in Devanagari", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.getByRole("link", { name: /बोलकर पूछें/ })).toBeVisible();
  expect(await page.locator("main").innerText()).toMatch(DEVANAGARI);

  await page.getByRole("link", { name: /बोलकर पूछें/ }).click();
  await expect(page).toHaveURL(/\/chat/);
  await expect(page.getByText("आप किस राज्य या केंद्र शासित प्रदेश में रहते हैं?").first()).toBeVisible();
});
