/**
 * Gate 5 — Liveness honesty (SPEC §10.5).
 *
 * A living repository (vercel/next.js) must render the "still breathes" page —
 * playful copy, vitals, and an invitation back to the Graveyard — and NEVER a
 * death certificate. This path is a LIVE GitHub build with no LLM call, so the
 * first load can be slow; it is cached thereafter.
 */
import { test, expect } from "@playwright/test";

test("a living repo renders the alive page, not a certificate", async ({
  page,
}) => {
  await page.goto("/vercel/next.js");

  await expect(page.getByText("This one still breathes.")).toBeVisible({
    timeout: 90_000,
  });

  // Playful eyebrow + a couple of vitals labels.
  await expect(page.getByText("subject is alive")).toBeVisible();
  await expect(page.getByText("Last pulse")).toBeVisible();
  await expect(page.getByText("Stars", { exact: true })).toBeVisible();

  // A living repo gets NO death certificate and NO deceased/fading stamp.
  await expect(page.getByText("Certificate of repository death")).toHaveCount(0);
  await expect(page.getByText("Deceased", { exact: true })).toHaveCount(0);

  // The invitation back to the Graveyard.
  await expect(
    page.getByRole("link", { name: "Wander the Graveyard" }),
  ).toBeVisible();
});
