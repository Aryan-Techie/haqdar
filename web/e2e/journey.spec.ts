import { expect, test, type Page } from "@playwright/test";

const BUDGET_MS = 180_000;

/** Tap an option button inside the visible answer group. */
async function tap(page: Page, name: string | RegExp) {
  await page.getByRole("group", { name: /your answer|उत्तर/i }).getByRole("button", { name, exact: typeof name === "string" }).click();
}

test("English journey: home to saved scheme", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();

  const started = Date.now();
  await page.getByRole("link", { name: /Ask in your voice/ }).click();
  await expect(page).toHaveURL(/\/chat/);

  // Fixed questions: state, age, gender, occupation, income, category.
  await page.getByRole("searchbox").fill("Haryana");
  await page.getByRole("button", { name: "Haryana", exact: true }).click();
  await page.getByRole("textbox").fill("52");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await tap(page, "Woman");
  await tap(page, "Homemaker");
  await tap(page, "Under ₹1 lakh");
  await tap(page, "SC");

  // Offer step: answer the two extra questions (marital status, BPL, ...), which then evaluates.
  await page.getByRole("button", { name: /Answer \d+ more question/ }).click();
  const prefer = ["Widowed", "Yes", "Not studying"];
  for (let i = 0; i < 2 && !page.url().includes("/results"); i++) {
    const answer = page.getByRole("button", { name: new RegExp(`^(${prefer.join("|")})$`) });
    const see = page.getByRole("button", { name: /See my schemes/i });
    await expect(answer.first().or(see)).toBeVisible();
    if (await answer.first().isVisible()) await answer.first().click();
    else break;
  }
  const see = page.getByRole("button", { name: /See my schemes/i });
  if (!page.url().includes("/results") && (await see.isVisible())) await see.click();

  await expect(page).toHaveURL(/\/results/, { timeout: 30_000 });
  const eligible = page.locator('[data-testid="scheme-card"][data-verdict="eligible"]');
  await expect(eligible.first()).toBeVisible({ timeout: 15_000 });
  const elapsed = Date.now() - started;
  expect(elapsed).toBeLessThan(BUDGET_MS);
  await expect(eligible.first()).toContainText(/\.(gov|nic)\.in/);

  // Detail page.
  await eligible.first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/schemes\//);
  const heading = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  const source = page.getByRole("link", { name: /opens in a new tab/i }).first();
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute("href", /^https?:\/\//);
  await page.getByRole("button", { name: "Documents" }).click();
  await expect(page.getByRole("checkbox").first()).toBeVisible();

  // Save requires sign-in.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: /Sign in with your phone/ });
  await sheet.getByLabel("Mobile number").fill("9876543210");
  await sheet.getByRole("button", { name: "Send code" }).click();
  await sheet.getByLabel(/code/i).fill("123456");
  await sheet.getByRole("checkbox", { name: /I agree/ }).check();
  await sheet.getByRole("button", { name: /Verify and continue/ }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible({ timeout: 15_000 });

  await page.goto("/saved");
  await expect(page.getByText(heading).first()).toBeVisible({ timeout: 15_000 });
});
