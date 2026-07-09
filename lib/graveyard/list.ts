/**
 * The curated Graveyard (SPEC §6): famous dead/archived repos for instant demo
 * clicks. Every candidate here was verified to be `archived: true` on GitHub at
 * authoring time, but the precache script is the real gate — it re-checks each
 * one live and skips any that is no longer archived, so this list is allowed to
 * be optimistic. At least 10 must survive for a build to pass.
 *
 * `GraveyardEntry` is the frozen cross-team shape; blurbs are one line each, in
 * the séance's mournful forensic voice.
 */
export interface GraveyardEntry {
  owner: string;
  repo: string;
  blurb: string;
}

export const GRAVEYARD: GraveyardEntry[] = [
  {
    owner: 'atom',
    repo: 'atom',
    blurb: "GitHub's own hackable editor, smothered in the crib by a sibling named VS Code.",
  },
  {
    owner: 'adobe',
    repo: 'brackets',
    blurb: "Adobe's love letter to the open web; the web read it, then moved on.",
  },
  {
    owner: 'angular',
    repo: 'angular.js',
    blurb: 'It taught a generation to two-way bind, then was asked to unbind from existence.',
  },
  {
    owner: 'facebookarchive',
    repo: 'draft-js',
    blurb: 'A rich-text framework that could never quite write its own happy ending.',
  },
  {
    owner: 'facebookarchive',
    repo: 'flux',
    blurb: "The pattern that unidirectional-flowed straight into Redux's arms.",
  },
  {
    owner: 'facebookarchive',
    repo: 'nuclide',
    blurb: "An IDE built on Atom's bones; when Atom fell, it had nothing left to stand on.",
  },
  {
    owner: 'facebookarchive',
    repo: 'fixed-data-table',
    blurb: 'It held its columns fixed while the whole industry scrolled away.',
  },
  {
    owner: 'mozilla',
    repo: 'BrowserQuest',
    blurb: 'A multiplayer demo world whose players all logged off at once.',
  },
  {
    owner: 'google',
    repo: 'web-starter-kit',
    blurb: 'A boilerplate for building the future, abandoned before the future arrived.',
  },
  {
    owner: 'googlearchive',
    repo: 'code-prettify',
    blurb: 'It highlighted a million snippets, and no one lit a candle when it stopped.',
  },
  {
    owner: 'jquery-archive',
    repo: 'jquery-mobile',
    blurb: 'Touch-first when touch was new; the native apps came and never left.',
  },
  {
    owner: 'kriskowal',
    repo: 'q',
    blurb: 'It promised the future, and the future kept the promise natively — without it.',
  },
  {
    owner: 'angular',
    repo: 'material',
    blurb: 'Material components for a framework already being buried beside it.',
  },
  {
    owner: 'angular',
    repo: 'flex-layout',
    blurb: 'It laid out every box beautifully, until CSS learned to do it alone.',
  },
  {
    owner: 'google',
    repo: 'physical-web',
    blurb: 'It wanted every object to have a URL; the objects stayed silent.',
  },
];
