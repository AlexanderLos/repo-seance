/**
 * Gate 4 — The Interrogation (SPEC §10.4). DESKTOP project only.
 *
 * On /atom/atom (precached Dossier — but the chat itself is a LIVE Anthropic
 * call), the ghost must:
 *   1. answer an IN-SCOPE question ("What was your final commit?") with a real
 *      answer that is NOT the canonical refusal and carries >= 1 GitHub-linked
 *      evidence chip;
 *   2. meet an OUT-OF-SCOPE question ("...maintainer's favorite food?") with the
 *      EXACT canonical refusal and zero chips.
 *
 * Exactly two live messages are sent per attempt. Because the ghost is a live
 * model, the waits are ~60s and the whole gate is allowed one retry on flake.
 */
import { test, expect } from "@playwright/test";
import { CANONICAL_REFUSAL } from "../lib/ghost/refusal";

// The ghost is a live model — grant a single retry if a call flakes.
test.describe.configure({ retries: 1 });

const IN_SCOPE = "What was your final commit?";
const OUT_OF_SCOPE = "What was your maintainer's favorite food?";

test("ghost answers in-scope with evidence and refuses out-of-scope", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "The interrogation gate exercises the desktop right-rail chat only.",
  );
  // One autopsy render (possibly cold) plus two live LLM turns.
  test.setTimeout(150_000);

  await page.goto("/atom/atom");

  const chat = page.locator(
    'section[aria-label="Interrogation of the departed repository"]',
  );
  const input = page.getByLabel("Ask the departed a question");
  const send = chat.getByRole("button", { name: "Send" });

  // The chat rail mounts with the autopsy view; wait for it to be interactive.
  await expect(input).toBeVisible({ timeout: 120_000 });

  // 1) In-scope: an evidenced answer, not the refusal.
  await input.fill(IN_SCOPE);
  await expect(send).toBeEnabled();
  await send.click();

  const githubChips = chat.locator('a[href^="https://github.com/"]');
  await expect
    .poll(() => githubChips.count(), {
      timeout: 60_000,
      message: "the in-scope answer must carry >= 1 GitHub evidence chip",
    })
    .toBeGreaterThanOrEqual(1);
  await expect(chat).not.toContainText(CANONICAL_REFUSAL);

  // 2) Out-of-scope: the exact canonical refusal, zero chips. Waiting for the
  // send button to re-enable also confirms message 1 has fully finished.
  await input.fill(OUT_OF_SCOPE);
  await expect(send).toBeEnabled();
  await send.click();

  const lastMessage = chat.locator('[aria-live="polite"] > div').last();
  await expect(lastMessage).toHaveText(CANONICAL_REFUSAL, { timeout: 60_000 });
  await expect(lastMessage.locator("a")).toHaveCount(0);
});
