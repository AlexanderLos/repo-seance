/**
 * Gate 3 — The Autopsy (SPEC §10.3).
 *
 * `pnpm dev` + a precached Graveyard repo (/atom/atom) must render the full
 * death certificate: the certificate itself, a confidence-ranked cause of death
 * whose evidence chips number >= 3 with each linking to a real GitHub URL, the
 * decline chart, the last words (final commit), and the revival plan.
 *
 * We assert the chip href PATTERN only and never follow the links — fetching
 * them would spend live GitHub budget and couple the gate to github.com uptime.
 * The autopsy is served from cache/precache; the first load on a cold server can
 * pay a one-time synthesis, so the terminal wait is deliberately generous.
 */
import { test, expect } from "@playwright/test";

test("precached repo renders the full death certificate with linked evidence", async ({
  page,
}) => {
  await page.goto("/atom/atom");

  // Terminal signal that the ritual finished and the case file rendered. The
  // "Case No." qualifier pins this to the visible certificate eyebrow, not the
  // <title> element (which also says "Certificate of repository death").
  await expect(
    page.getByText(/Certificate of repository death.*Case No\./),
  ).toBeVisible({ timeout: 120_000 });

  // Certificate: repository identity + the DECEASED rubber stamp.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("atom");
  await expect(page.getByText("Deceased", { exact: true })).toBeVisible();

  // Cause of death: >= 3 evidence chips, every one a real GitHub link. The only
  // <a> elements inside this section are the resolved evidence chips.
  const causeSection = page.locator("section", {
    has: page.getByRole("heading", { name: "Cause of death" }),
  });
  await expect(causeSection).toBeVisible();

  const chips = causeSection.locator("a");
  const chipCount = await chips.count();
  expect(
    chipCount,
    "cause of death should surface at least 3 evidence chips",
  ).toBeGreaterThanOrEqual(3);

  for (let i = 0; i < chipCount; i += 1) {
    const href = await chips.nth(i).getAttribute("href");
    expect(href, `evidence chip #${i} must link to github.com`).toMatch(
      /^https:\/\/github\.com\//,
    );
  }

  // Decline chart, last words, and revival plan all present.
  await expect(page.getByRole("heading", { name: "Decline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Last words" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Revival plan" }),
  ).toBeVisible();
});
