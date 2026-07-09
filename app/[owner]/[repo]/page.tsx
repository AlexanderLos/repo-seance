import type { Metadata } from "next";
import { SeanceShell } from "@/components/seance-shell";
import { AutopsyClient } from "@/components/autopsy/autopsy-client";
import { lookupCachedAutopsy } from "@/components/autopsy/precache-lookup";

interface RouteParams {
  params: Promise<{ owner: string; repo: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const slug = `${owner}/${repo}`;

  let title = `${slug} · Repo Séance`;
  let description = `An autopsy of ${slug} — cause of death, last words, and a ghost that cites its evidence for every claim.`;

  const cached = await lookupCachedAutopsy(owner, repo);
  if (cached) {
    if (cached.dossier.death.status === "alive") {
      title = `${slug} still breathes · Repo Séance`;
      description = `${slug} is alive and well — no death certificate here. Wander the Graveyard for the ones that went quiet.`;
    } else if (cached.autopsy) {
      title = `${slug} · Certificate of repository death`;
      description = cached.autopsy.epitaph;
    }
  }

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AutopsyPage({ params }: RouteParams) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);

  return (
    <SeanceShell active="autopsy" exhumeValue={`${owner}/${repo}`} showShare>
      <AutopsyClient owner={owner} repo={repo} />
    </SeanceShell>
  );
}
