/**
 * The three-band frame every surface shares (DESIGN-NOTES §3): a candle-lit
 * radial ground, the header, the page's main content, and the trust footer.
 * The `min-width: 1560px` of the mock is deliberately gone — this is fluid from
 * 375px up (SPEC §6). Base voice is the machine mono; the serif is opt-in.
 */
import type { ReactNode } from "react";
import { SiteHeader, type ActiveNav } from "./site-header";
import { SiteFooter } from "./site-footer";

export function SeanceShell({
  children,
  active = "home",
  exhumeValue,
  showShare = false,
}: {
  children: ReactNode;
  active?: ActiveNav;
  exhumeValue?: string;
  showShare?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-sc-bg bg-[radial-gradient(1200px_600px_at_50%_-10%,#17130b_0%,#0a0908_60%)] font-mono text-sc-ink">
      <SiteHeader active={active} exhumeValue={exhumeValue} showShare={showShare} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
