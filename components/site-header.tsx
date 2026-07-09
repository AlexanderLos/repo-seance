/**
 * The top bar (DESIGN-NOTES §5.1): brand wordmark + tagline, the Exhume search
 * (desktop only — the landing hero owns the mobile input), and nav. The nav's
 * "Autopsy" label lights up only on a report page; "Share report" appears there
 * too. Links to the Graveyard/How-it-works sections live on the landing page.
 */
import Link from "next/link";
import { ExhumeBar } from "./exhume-bar";
import { ShareButton } from "./share-button";
import { cn } from "./util/cn";

export type ActiveNav = "autopsy" | "graveyard" | "home";

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "uppercase tracking-[.12em] transition-colors",
        active ? "text-sc-ink" : "text-sc-muted hover:text-sc-body",
      )}
    >
      {children}
    </Link>
  );
}

export function SiteHeader({
  active = "home",
  exhumeValue,
  showShare = false,
}: {
  active?: ActiveNav;
  exhumeValue?: string;
  showShare?: boolean;
}) {
  return (
    <header className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-sc-hair bg-sc-bg/90 px-4 py-2.5 backdrop-blur sm:h-16 sm:flex-nowrap sm:gap-x-7 sm:gap-y-0 sm:px-7 sm:py-0">
      <Link
        href="/"
        className="flex flex-shrink-0 items-baseline gap-3"
        aria-label="Repo Séance — home"
      >
        <span className="font-serif text-[26px] font-semibold tracking-[.04em] text-sc-ink">
          Repo Séance
        </span>
        <span className="hidden text-[10px] uppercase tracking-[.22em] text-sc-muted lg:inline">
          Forensics for dead code
        </span>
      </Link>

      <div className="hidden max-w-[640px] flex-1 md:block">
        <ExhumeBar size="sm" initialValue={exhumeValue ?? ""} />
      </div>

      <nav className="ml-auto flex items-center gap-4 font-mono text-xs sm:gap-6">
        {active === "autopsy" ? (
          <span className="uppercase tracking-[.12em] text-sc-ink" aria-current="page">
            Autopsy
          </span>
        ) : null}
        <NavLink href="/#graveyard" active={active === "graveyard"}>
          Graveyard
        </NavLink>
        <span className="hidden sm:inline">
          <NavLink href="/#how-it-works">How it works</NavLink>
        </span>
        {showShare ? (
          <>
            <span className="hidden h-[18px] w-px bg-sc-border sm:inline-block" />
            <ShareButton />
          </>
        ) : null}
      </nav>
    </header>
  );
}
