/**
 * The share surface (SPEC §6 item 5): a dynamic tombstone card for /{owner}/{repo}.
 * Uses ONLY the committed graveyard snapshot / shared cache (lookupCachedAutopsy)
 * — it never triggers a fetch or an LLM call. A dead repo shows born/died years
 * and the synthesized cause headline; an alive repo gets a "still breathes" card;
 * anything not yet cached falls back to a generic tombstone. This is the virality
 * surface, so it is styled with the séance palette even without webfonts.
 */
import { ImageResponse } from "next/og";
import { lookupCachedAutopsy } from "@/components/autopsy/precache-lookup";
import { formatYear, formatDays } from "@/components/util/format";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface RouteParams {
  params: Promise<{ owner: string; repo: string }>;
}

const BG = "#0a0908";
const PANEL_TOP = "#14110a";
const HAIR = "#241d11";
const BORDER = "#2c2416";
const INK = "#f0e8d2";
const MUTED = "#9a8f74";
const FAINT = "#90856a";
const ACCENT = "#c9973f";
const DANGER = "#cd5f52";
const GREEN = "#8fae8a";

export default async function Image({ params }: RouteParams) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);

  const cached = await lookupCachedAutopsy(owner, repo);
  const alive = cached?.dossier.death.status === "alive";
  const bornYear = cached ? formatYear(cached.dossier.repo.createdAt) : null;
  const diedYear = cached ? formatYear(cached.dossier.repo.pushedAt) : null;
  const cause = cached?.autopsy?.causes[0]?.label ?? null;
  const daysSince = cached ? cached.dossier.death.daysSincePush : null;

  const eyebrow = alive
    ? "The subject still breathes"
    : cached
      ? "Certificate of repository death"
      : "Forensics for dead code";
  const accentColor = alive ? GREEN : ACCENT;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: `linear-gradient(180deg, #15110a 0%, ${BG} 62%)`,
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* framed document */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: `1px solid ${BORDER}`,
            background: `linear-gradient(180deg, ${PANEL_TOP} 0%, #100d08 100%)`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 52,
            right: 52,
            bottom: 52,
            border: `1px solid ${HAIR}`,
            display: "flex",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "0 40px",
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: MUTED,
              fontFamily: "sans-serif",
            }}
          >
            {eyebrow}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginTop: 28,
              fontSize: 88,
              fontWeight: 600,
              color: INK,
              lineHeight: 1.02,
            }}
          >
            <span>{owner}</span>
            <span style={{ color: MUTED }}>/</span>
            <span>{repo}</span>
          </div>

          {cached ? (
            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 26,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: FAINT,
                fontFamily: "sans-serif",
              }}
            >
              {alive
                ? `Alive · last pulse ${daysSince !== null ? formatDays(daysSince) : "recent"} ago`
                : `Born ${bornYear ?? "—"} — Died ${diedYear ?? "—"}`}
            </div>
          ) : null}

          {cause ? (
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: 34,
                fontStyle: "italic",
                color: accentColor,
                maxWidth: 900,
              }}
            >
              {cause}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 44,
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: MUTED,
              fontFamily: "sans-serif",
            }}
          >
            <span style={{ color: accentColor }}>Repo Séance</span>
            <span style={{ margin: "0 14px", color: BORDER }}>·</span>
            <span>Speak with the ghost</span>
          </div>
        </div>

        {/* stamp */}
        <div
          style={{
            position: "absolute",
            top: 92,
            right: 96,
            display: "flex",
            transform: "rotate(-9deg)",
            border: `3px solid ${alive ? GREEN : "#7a2620"}`,
            color: alive ? GREEN : DANGER,
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
            padding: "12px 26px",
            fontFamily: "sans-serif",
          }}
        >
          {alive ? "Living" : "Deceased"}
        </div>
      </div>
    ),
    { ...size },
  );
}
