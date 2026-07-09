/**
 * Gate 6 — Responsiveness (SPEC §10.6, §6). Runs in both projects (375 + 1440).
 *
 * No horizontal overflow on the landing page or an autopsy at either width, and
 * the interrogation is usable at both: a focusable input in the desktop rail
 * and, on mobile, a launcher that opens a full-height sheet. No LLM — the
 * autopsy is served from cache.
 *
 * SPEC §6 makes "no horizontal scroll at any width" a shipping gate, so the
 * overflow assertion is intentionally strict rather than tolerant.
 */
import { test, expect, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    scrollWidth,
    `documentElement.scrollWidth (${scrollWidth}px) must be <= innerWidth (${innerWidth}px)`,
  ).toBeLessThanOrEqual(innerWidth);
}

test("landing page has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("autopsy page has no horizontal overflow", async ({ page }) => {
  await page.goto("/atom/atom");
  // "Case No." pins this to the visible certificate eyebrow, not the <title>.
  await expect(
    page.getByText(/Certificate of repository death.*Case No\./),
  ).toBeVisible({ timeout: 120_000 });
  await expectNoHorizontalOverflow(page);
});

test("desktop: the interrogation rail input is focusable", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "The desktop rail is present only at desktop widths.",
  );
  await page.goto("/atom/atom");
  const input = page.getByLabel("Ask the departed a question");
  await expect(input).toBeVisible({ timeout: 120_000 });
  await input.focus();
  await expect(input).toBeFocused();
});

test("mobile: a launcher opens a full-height sheet with a focusable input", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "The full-height chat sheet exists only at mobile widths.",
  );
  await page.goto("/atom/atom");
  // "Case No." pins this to the visible certificate eyebrow, not the <title>.
  await expect(
    page.getByText(/Certificate of repository death.*Case No\./),
  ).toBeVisible({ timeout: 120_000 });

  // The inline trigger reveals the sheet launcher; the launcher opens the sheet.
  await page.getByRole("button", { name: /speak with the ghost/i }).click();
  const openSheet = page.getByRole("button", {
    name: "Open the interrogation",
  });
  await expect(openSheet).toBeVisible();
  await openSheet.click();

  const input = page.getByLabel("Ask the departed a question");
  await expect(input).toBeVisible();
  await input.focus();
  await expect(input).toBeFocused();

  // The input lives inside a fixed sheet that covers ~the whole viewport height.
  const heightRatio = await input.evaluate((el) => {
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.body) {
      if (getComputedStyle(node).position === "fixed") {
        return node.getBoundingClientRect().height / window.innerHeight;
      }
      node = node.parentElement;
    }
    return 0;
  });
  expect(
    heightRatio,
    "the interrogation sheet should fill ~the full viewport height",
  ).toBeGreaterThan(0.9);
});
