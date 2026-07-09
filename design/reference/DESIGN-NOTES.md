<!--
  DERIVED DOCUMENT — implementation reference only, not a source of truth to copy blindly.
  Everything below was extracted from the FROZEN artifact design/repo-seance-v2.html
  (decoded via scratchpad/extract.js into design/reference/extracted.html).
  Where this doc quotes numbers, layouts, or copy, it is describing the MOCK. The MOCK
  hardcodes data and invents trust statistics; SPEC §0/§7 require several of these values
  (footer eval stats) to become TRUE at build time from evals/results.json — see §8 below.
  Pixel values, hexes, and copy are transcribed verbatim from the mock so the UI team can
  reproduce the look faithfully at desktop widths, then make it responsive (SPEC §6).
-->

# Repo Séance — Design Reference (extracted from `repo-seance-v2.html`)

The mock is a single desktop screen: **The Autopsy** for a (fictional) dead repo
`stellarbeacon/chronicle`. It is dark, warm-gold, funereal, monospace-machine-voice with a
serif-ghost-voice overlay. Source line numbers below refer to `design/reference/extracted.html`.

> The mock is built with a proprietary bundler templating language: `<sc-for list="{{ x }}">`
> = a `.map()` loop, `<sc-if value="{{ x }}">` = conditional render, `{{ expr }}` = data
> binding, `style-hover="…"` = a `:hover` style, `hint-placeholder-count` = editor-only noise.
> Translate these to React/JSX + Tailwind. The real component logic lives in the trailing
> `<script type="text/x-dc">` (extracted.html lines 676–798).

---

## 1. Color palette (every value, with role)

Theme is a single dark palette. One themeable accent (`--accent`) with 4 options; **gold
`#C9973F` is the default** and is what the mock renders. Accent is referenced as
`var(--accent, #c9973f)`.

### Accent (themeable) — from the mock's `data-props`
| Token | Hex | Name |
|---|---|---|
| accent (default) | `#C9973F` | gold |
| accent option | `#7FA97A` | green |
| accent option | `#8B7FB8` | purple |
| accent option | `#A13029` | red |

Accent hover / lighter gold: `#e0b366`. Accent bars use `rgba(201,151,63,.55)` (= gold @ 55%).

### Backgrounds (darkest → lightest)
| Hex | Role |
|---|---|
| `#0a0908` | page base; body; radial-gradient outer stop; also used by `html,body` |
| `#0c0a07` | "Last words" commit box background |
| `#0e0c08` | header search input bg; evidence-chip bg; chat input bg |
| `#0e100b` | revival-plan gradient bottom stop |
| `#100d08` | certificate gradient bottom stop |
| `#10130d` | ghost chat-bubble bg; revival-plan gradient top stop |
| `#12100a` | **standard card/panel bg** (cause, decline, last-words, unfinished, interrogation) |
| `#14110a` | certificate gradient top stop |
| `#161c12` | "Attempt resurrection" button bg (green family) |
| `#17130b` | user chat-bubble bg; radial-gradient inner stop (top glow) |
| `#1b2416` | "Attempt resurrection" hover bg |
| `#1c160c` | Exhume button bg; active tab bg; moon send-button bg |
| `#241b0e` | Exhume / send-button hover bg |

### Borders & hairlines (dark → light)
| Hex | Role |
|---|---|
| `#1c170e` | unfinished-business row separators (`border-top`) |
| `#241d11` | faint hairline: header bottom, certificate inner frame, vitals divider, section dividers, footer top, inactive-tab border, dead decline bars |
| `#2c2416` | **standard panel border** (`1px solid #2c2416`); chip borders; input borders |
| `#2f3d2a` | green-tinted border: revival-plan section, ghost bubble |
| `#3a4a34` | "Attempt resurrection" button border (green) |
| `#4a3c20` | gold hover border (chips, active tab, "View final commit", nav share) |

### Text (dimmest → brightest)
| Hex | Role |
|---|---|
| `#4a4336` | dimmest: chat footer microcopy; "// the todo was never fixed" (italic) |
| `#4a3c20` | mid-decay decline bars (also a border) |
| `#5d5545` | dim labels: Born/Died/Age labels, "confidence-ranked", "Confirmed · N days silent", footer text, subtitle |
| `#5d6b55` | revival green-dim: step numerals, effort tags, "est. 3 weekends" |
| `#6b6250` | muted: tagline, inactive nav, "git://", counts, name slash, "— final commit" line, meta |
| `#7a2620` | **danger red**: flatline label, DECEASED stamp border, "2023 †", death dashed lines |
| `#7a6f58` | secondary italic: cause quote, chat evidence chips, "// TODO:" line |
| `#8d8268` | **section H2 headings** (uppercase), branch refs, decline caption, body-dim |
| `#8fae8a` | "Revival plan" H2 (green) |
| `#a13029` | DECEASED stamp text (red) |
| `#a89c7e` | certificate epitaph (italic); user chat-bubble text |
| `#a9c49e` | "Attempt resurrection" button text |
| `#b6ab8d` | last-words commit body text |
| `#b9c4ae` | revival step text; ghost chat-bubble text |
| `#c4dbb8` | "Attempt resurrection" hover text |
| `#c9973f` | **primary accent** (gold): links, `<a>` default, active glyphs, progress fill, send button |
| `#cfc5a9` | bright body: inputs, item titles, cause labels, "Share report", "View final commit" |
| `#e0b366` | accent-hover gold: `a:hover`, active tab text, Exhume hover |
| `#e7ddc4` | brightest body / **brand wordmark**; root text color; `::selection` fg |
| `#f0e8d2` | headline off-white: certificate H1, "Cause of death" headline |

### rgba
- `rgba(10,9,8,.9)` — sticky header background (translucent over page).
- `rgba(201,151,63,.55)` — live decline bars (gold @ 55%).

### Misc
- `::selection { background: #3a2f1a; color: #e7ddc4; }`
- Global link: `a { color: #c9973f } a:hover { color: #e0b366 }`

---

## 2. Typography

Two self-hosted families (SPEC §2 mandates `next/font`, Google-hosted in the mock):

- **Cormorant Garamond** — *the ghost / serif voice.* Weights present: 400, 500, 600, 700
  (normal) and 400, 500, 600 (italic). Used for headings, the epitaph, poetic one-liners, and
  ghost chat bubbles.
- **IBM Plex Mono** — *the machine voice.* Weights present: 400, 500, 600 (normal only). Used
  for essentially everything else: labels, body, inputs, buttons, nav, footer, user chat, meta.

Fallbacks in the mock: `'Cormorant Garamond', serif` and `'IBM Plex Mono', monospace`.

### Per-element type spec (verbatim from mock)
| Element | Family | Size | Weight | Style | Tracking / notes | Color |
|---|---|---|---|---|---|---|
| Brand "Repo Séance" | Cormorant | 26px | 600 | — | `letter-spacing .04em` | `#e7ddc4` |
| Tagline "Forensics for dead code" | Mono | 10px | 400 | — | `.22em`, UPPERCASE | `#6b6250` |
| Header "git://" prefix | Mono | 13px | 400 | — | — | `#6b6250` |
| Header search input | Mono | 13px | 400 | — | — | `#cfc5a9` |
| Exhume button | Mono | 11px | 400 | — | `.18em`, UPPERCASE | accent |
| Nav links | Mono | 12px | 400 | — | `.12em`, UPPERCASE | `#e7ddc4` active / `#6b6250` idle |
| Certificate eyebrow | Mono | 10px | 400 | — | `.32em`, UPPERCASE | `#6b6250` |
| Certificate H1 (repo name) | Cormorant | 52px | 500 | — | `line-height 1.05` | `#f0e8d2` (slash `#6b6250`) |
| Epitaph | Cormorant | 21px | 400 | italic | `line-height 1.45`, `max-width 560px` | `#a89c7e` |
| Vitals row (Born/Died/…) | Mono | 12px | 400 | — | label span `#5d5545` | `#8d8268` |
| DECEASED stamp | Mono | 20px | 400 | — | `.3em`, UPPERCASE, `rotate(-9deg)` | `#a13029` |
| "Confirmed · N days silent" | Mono | 10px | 400 | — | `.18em`, UPPERCASE | `#5d5545` |
| "Vitals" label | Mono | 10px | 400 | — | `.24em`, UPPERCASE | `#6b6250` |
| "flatline · …" | Mono | 11px | 400 | — | — | `#7a2620` |
| Section H2 (all panels) | Mono | 11px | 400 | — | `.26em`, UPPERCASE | `#8d8268` (revival `#8fae8a`) |
| Panel sublabels (e.g. "commits / month") | Mono | 10px | 400 | — | — | `#5d5545` |
| "Cause of death" headline | Cormorant | 27px | 600 | — | `line-height 1.1` | `#f0e8d2` |
| Cause label | Mono | 12.5px | 400 | — | `line-height 1.45` | `#cfc5a9` |
| Cause pct | Mono | 11px | 400 | — | — | `#6b6250` |
| Cause italic quote | Cormorant | 16px | 400 | italic | — | `#7a6f58` |
| Decline caption | Mono | 11.5px | 400 | — | `line-height 1.6` | `#8d8268` |
| Year axis labels | Mono | 10px | 400 | — | — | `#5d5545` (`2023 †` = `#7a2620`) |
| Last-words commit box | Mono | 12px | 400 | — | `line-height 1.75` | `#b6ab8d` |
| Evidence chips | Mono | 10px | 400 | — | — | `#8d8268` (chat `#7a6f58`) |
| Unfinished tabs | Mono | 10.5px | 400 | — | `.1em`, UPPERCASE | active `#e0b366` / idle `#6b6250` |
| Unfinished item ref | Mono | 11px | 400 | — | fixed `width 68px` | `#8d8268` |
| Unfinished item title | Mono | 12.5px | 400 | — | — | `#cfc5a9` |
| Unfinished item meta | Mono | 10.5px | 400 | — | — | `#6b6250` |
| Revival step numeral (i./ii.) | Mono | 11px | 400 | — | — | `#5d6b55` |
| Revival step text | Mono | 12.5px | 400 | — | `line-height 1.5` | `#b9c4ae` |
| Revival effort tag | Mono | 10px | 400 | — | — | `#5d6b55` |
| "Attempt resurrection" btn | Mono | 11px | 400 | — | `.18em`, UPPERCASE | `#a9c49e` |
| Interrogation subtitle | Mono | 11px | 400 | — | — | `#5d5545` |
| Ghost chat bubble | Cormorant | 17px | 400 | italic | `line-height 1.55` | `#b9c4ae` |
| User chat bubble | Mono | 12px | 400 | normal | `line-height 1.55` | `#a89c7e` |
| Chat input | Mono | 12.5px | 400 | — | placeholder "Ask the departed…" | `#cfc5a9` |
| Chat send glyph "☽" | Mono | 15px | — | — | — | accent |
| Chat footer microcopy | Mono | 10px | 400 | — | centered | `#4a4336` |
| Footer | Mono | 10.5px | 400 | — | — | `#5d5545` |

**Recurring uppercase-eyebrow pattern:** small mono, UPPERCASE, wide tracking (`.18em`–`.32em`),
dim color. Used for every section H2, the certificate eyebrow, button labels, and stamps.

---

## 3. Layout & spacing system

Root wrapper (extracted.html:473):
```
min-height: 100vh;
min-width: 1560px;   ← SPEC §6 ORDERS THIS KILLED. Must go fully responsive to 375px.
background: radial-gradient(1200px 600px at 50% -10%, #17130b 0%, #0a0908 60%);
color: #e7ddc4; font-family: 'IBM Plex Mono', monospace;
display: flex; flex-direction: column;
```

Three stacked bands: **header (64px) → main (flex:1 grid) → footer**.

- **Header** — `display:flex; height:64px; padding:0 28px; gap:28px; border-bottom:1px #241d11;
  background:rgba(10,9,8,.9)`. Children: brand+tagline block (`flex-shrink:0`), search bar
  (`flex:1; max-width:640px; height:38px`), nav (`margin-left:auto; gap:24px`).
- **Main** — `display:grid; grid-template-columns: minmax(0,1fr) 396px; gap:18px;
  padding:22px 28px 12px; align-items:start`. Left = case file (fluid); right = interrogation
  (**fixed 396px**).
- **Left column** — `flex column; gap:18px; min-width:0`, containing in order:
  1. Certificate `<section>` (full width)
  2. **Row A** grid `grid-template-columns: 1.15fr 1fr 1fr; gap:18px; align-items:stretch`
     → Cause of death | Decline | Last words
  3. **Row B** grid `grid-template-columns: 1.4fr 1fr; gap:18px; align-items:stretch`
     → Unfinished business | Revival plan
- **Right column** — `<aside>` `align-self:stretch`, standard card; internally 3 rows:
  header / scrollable message list (`flex:1; overflow-y:auto`) / input footer.
- **Footer** — `display:flex; padding:14px 28px; border-top:1px #241d11`.

**Standard card recipe:** `border:1px solid #2c2416; background:#12100a; padding:22px 24px`.
Certificate padding is larger: `34px 40px 30px`.

**Spacing scale observed (px):** 2, 6, 8, 10, 11, 12, 14, 16, 18, 22, 24, 26, 28, 32, 34, 40.
Dominant rhythm: **18px** for major gaps (grid gap, left-column gap), **12–16px** inside cards,
**28px** header horizontal padding, **24px** vitals gap.

### Responsive mandate (SPEC §6 — deviation REQUIRED)
- Kill `min-width:1560px`. No horizontal scroll at any width down to **375px**. Shipping gate.
- Mobile = single-column case file, order: **certificate → cause of death → decline → last
  words → unfinished business → revival → interrogation**. (Note: this collapses Row A/Row B and
  moves the interrogation aside to the END; on mobile the chat opens as a **full-height sheet**.)
- The desktop two-column `minmax(0,1fr) 396px` and the `1.15fr 1fr 1fr` / `1.4fr 1fr` inner
  grids must degrade to stacked single columns.

---

## 4. Borders, textures & effects

- **Certificate "framed document" look**: outer `1px solid #2c2416` + an absolutely-positioned
  inner frame `inset:6px; border:1px solid #241d11; pointer-events:none` (double-rule border).
  Certificate bg is a vertical gradient `linear-gradient(180deg,#14110a,#100d08)`.
- **DECEASED rubber stamp**: `transform:rotate(-9deg); border:3px double #7a2620; color:#a13029;
  padding:10px 22px 10px 26px; opacity:.9; animation:flicker 7s infinite`.
- **Revival plan** gets a green tint to signal hope: border `#2f3d2a`, gradient
  `linear-gradient(180deg,#10130d,#0e100b)`, green headings/text/button.
- **Page glow**: warm radial gradient anchored above top-center (`at 50% -10%`), `#17130b`→
  `#0a0908`, giving a candle-lit vignette.
- **Progress bars** (cause of death): `height:3px; background:#241d11` track with a
  `var(--accent)` fill at `opacity:.75`, width = percentage.
- **Hover states** (mock uses `style-hover=`): links/chips brighten to accent + border `#4a3c20`;
  buttons shift bg one step lighter (`#1c160c`→`#241b0e`, `#161c12`→`#1b2416`) and text brightens.
- **Animations** (only two `@keyframes`, extracted.html:469–470):
  - `flicker` `7s infinite` — DECEASED stamp opacity: `0/100%→1`, `45%→.82`, `52%→.95`,
    `60%→.78`, `70%→1` (a guttering-candle flicker).
  - `drift` `4s ease-in-out infinite` — the candle glyph: `translateY(0 → -3px → 0)`.
  - Respect `prefers-reduced-motion` when reproducing (SPEC accessibility floor).

---

## 5. Page structure — section by section (in DOM order)

### 5.1 Header / top bar (extracted.html:476–493)
- **Brand:** "Repo Séance" (Cormorant 26/600) + tagline "Forensics for dead code" (mono eyebrow).
- **Search bar:** segmented control — `git://` prefix cell (border-right `#241d11`) · text input ·
  "Exhume" button (accent text on `#1c160c`). Mock input value: `github.com/stellarbeacon/chronicle`.
- **Nav:** `Autopsy` (active `#e7ddc4`) · `Graveyard` · `How it works` · a 1px `#2c2416` divider ·
  `Share report ↗` (bordered pill). SPEC: brand is **Repo Séance** everywhere; "autopsy" is
  internal report language, so the nav item can stay "Autopsy" as the report label.

### 5.2 Death certificate (extracted.html:502–530)
Two-column flex (`justify-content:space-between`): left = identity block, right = stamp block.
- Eyebrow: "Certificate of repository death · Case No. 0198".
- H1: `stellarbeacon/chronicle` (slash dimmed).
- Epitaph (italic): *"A beautiful attempt to bring time-travel to state management. It shimmered —
  then slipped through the cracks."*
- Vitals inline row: **Born** Jan 12, 2019 · **Died** Nov 3, 2023 · **Age** 4y 9m ·
  **Survived by** 1,204 stars · 87 forks.
- Right stamp: **DECEASED** (rotated, red double-border) + "Confirmed · 378 days silent".
- **Vitals strip** (bottom, above a divider): label "Vitals" · an inline SVG heartbeat sparkline ·
  right label "flatline · Oct 28 2022" (red). See §7.

### 5.3 Row A — Cause of death (5.3a), Decline (5.3b), Last words (5.3c)

**5.3a Cause of death** (extracted.html:536–559)
- H2 "Cause of death" + right note "confidence-ranked".
- Big headline (Cormorant 27/600): "Dependency upgrade failure".
- List of 3 causes, each: label · pct · a `var(--accent)` progress bar · evidence chips. Data §6.
- Closing italic quote: *"The lights went out, and no one came back to relight them."*

**5.3b Decline** (extracted.html:562–578) — the bar chart. H2 "Decline" + "commits / month".
Bars, a dashed red flatline marker at `right:14%`, the drifting candle 🕯, a year axis
`2019 2020 2021 2022 2023 †`, and caption: "Cadence fell 91% in the final year. Last maintainer
reply: #198, 14 months before death." See §7 for chart mechanics.

**5.3c Last words** (extracted.html:581–590)
- H2 "Last words".
- Terminal-style commit box (`#0c0a07`, hairline border):
  - "— final commit · 1f3c9aa · Oct 28, 2022"
  - "refactor(store): simplify time travel logic and remove legacy fallbacks"
  - "// TODO: fix replay on edge cases" (`#7a6f58`)
  - "// the todo was never fixed" (`#4a4336`, italic) ← the sardonic gloss (SPEC §4 `lastWordsGloss`)
- Full-width "View final commit ↗" button.

### 5.4 Row B — Unfinished business (5.4a), Revival plan (5.4b)

**5.4a Unfinished business** (extracted.html:597–615) — a **tabbed** panel.
- H2 "Unfinished business" + tab buttons (right): `Branches · 4`, `Issues · 117`, `TODOs · 23`.
- Body = a list of rows for the active tab; each row: ref (fixed 68px) · title (fluid) · meta.
- Rows separated by `1px #1c170e` top borders. Full data for all three tabs in §6.

**5.4b Revival plan** (extracted.html:618–631) — the green "hope" panel.
- H2 "Revival plan" (green) + "est. 3 weekends".
- Numbered steps (i./ii./iii./iv.) with effort tags on the right.
- Bottom CTA button: "⚡ Attempt resurrection" (green).

### 5.5 Interrogation / ghost chat (aside, extracted.html:636–662)
- Header: H2 "Interrogation" + subtitle "Every answer cites its evidence. No séance theatrics
  without receipts."
- Scrollable message list: alternating **user** (mono, right-aligned, `#17130b` bubble) and
  **ghost** (Cormorant italic, left-aligned, green-bordered `#10130d` bubble) messages. Ghost
  messages carry evidence chips beneath. Seed conversation + canned replies in §6.
- Input footer: bordered field, placeholder "Ask the departed…", send button glyph **☽**.
- Microcopy under input: "Answers are grounded in repo data · 32/32 evals passing". ← STAT, see §8.

### 5.6 Footer (extracted.html:666–673)
`Séance Engine v2.4.1 · 94% of claims cite direct evidence · 0 hallucinations across 32 eval
cases`  … (right-aligned) `Analysis completed in 13.7s ✓`. ← STATS, see §8.

---

## 6. All copy strings & data — VERBATIM

Reproduce the mock's voice exactly. All strings below are copied from the mock.

### 6.1 Chrome / nav / buttons
- Brand: `Repo Séance`  | Tagline: `Forensics for dead code`
- Search prefix: `git://` | Search value (demo): `github.com/stellarbeacon/chronicle`
- Buttons: `Exhume` · `Share report ↗` · `View final commit ↗` · `⚡ Attempt resurrection`
- Nav: `Autopsy` · `Graveyard` · `How it works`

### 6.2 Certificate
- Eyebrow: `Certificate of repository death · Case No. 0198`
- Repo: `stellarbeacon/chronicle`
- Epitaph: `A beautiful attempt to bring time-travel to state management. It shimmered — then slipped through the cracks.`
- `Born`  `Jan 12, 2019` · `Died`  `Nov 3, 2023` · `Age`  `4y 9m` · `Survived by`  `1,204 stars · 87 forks`
- Stamp: `Deceased` (rendered uppercase) · `Confirmed · 378 days silent`
- Vitals strip: `Vitals` … `flatline · Oct 28 2022`

### 6.3 Cause of death
- H2: `Cause of death` · note: `confidence-ranked` · headline: `Dependency upgrade failure`
- Causes (label / pct / evidence):
  1. `Breaking changes in React 18 left the app in ruins` — **74%** — evidence `8d2a7f1`, `#198`
  2. `Three critical dependency alerts ignored` — **58%** — evidence `dependabot ×3`
  3. `Maintainer silence for 14 months` — **41%** — evidence `#213`, `9 unanswered PRs`
- Closing quote: `The lights went out, and no one came back to relight them.`

### 6.4 Decline
- H2: `Decline` · sublabel: `commits / month`
- Axis: `2019` `2020` `2021` `2022` `2023 †`
- Caption: `Cadence fell 91% in the final year. Last maintainer reply: #198, 14 months before death.`

### 6.5 Last words
- H2: `Last words`
- `— final commit · 1f3c9aa · Oct 28, 2022`
- `refactor(store): simplify time travel logic and remove legacy fallbacks`
- `// TODO: fix replay on edge cases`
- `// the todo was never fixed`

### 6.6 Unfinished business (tabs + rows)
Tab labels & counts: `Branches · 4`  `Issues · 117`  `TODOs · 23`

**Branches** (ref `branch` / title / meta):
| title | meta |
|---|---|
| `feature/v2-time-engine` | `8 behind · 1y` |
| `refactor/store-layer` | `23 behind · 1y` |
| `experiment/rxjs-migration` | `12 behind · 2y` |
| `chore/remove-legacy` | `4 behind · 2y` |

**Issues** (ref / title / meta):
| ref | title | meta |
|---|---|---|
| `#213` | `Time travel breaks on large lists` | `bug · open 1y` |
| `#198` | `React 18 compatibility` | `breaking · open 1y` |
| `#177` | `Memory leak in DevTools` | `bug · open 2y` |
| `#164` | `Replay desync after hot reload` | `bug · open 2y` |

**TODOs** (ref / title / meta):
| ref | title | meta |
|---|---|---|
| `store.ts` | `// TODO: fix replay on edge cases` | `oldest · 2y` |
| `devtools.ts` | `// TODO: dispose subscriptions on unmount` | `2y` |
| `selector.ts` | `// FIXME: memo invalidation is O(n²)` | `3y` |
| `README.md` | `// TODO: document time-travel API` | `3y` |

### 6.7 Revival plan
- H2: `Revival plan` · note: `est. 3 weekends`
- Steps (numeral / step / effort):
  1. `i.` `Bump React 17 → 18, restore CI green` `~2d`
  2. `ii.` `Merge or bury the 4 abandoned branches` `~1d`
  3. `iii.` `Add test suite for time-travel core (0 → 70%)` `~3d`
  4. `iv.` `Triage 117 issues; close the ghosts` `~1d`

### 6.8 Interrogation
- H2: `Interrogation`
- Subtitle: `Every answer cites its evidence. No séance theatrics without receipts.`
- Input placeholder: `Ask the departed…`  · Send glyph: `☽`
- Microcopy: `Answers are grounded in repo data · 32/32 evals passing`

**Seed conversation** (user / ghost, ghost carries evidence):
1. user: `Why did you stop?`
2. ghost: `I was left alone with breaking changes, and no one came to guide me through.`
   — evidence: `8d2a7f1`, `#198`, `deps: react 18.0.0`
3. user: `What do you regret most?`
4. ghost: `I shipped potential, not tests. Nine of my modules died uncovered.`
   — evidence: `coverage: 31%`, `ci: none`
5. user: `What would you need to live again?`
6. ghost: `A patient maintainer, updated dependencies, and a test suite. Please.`
   — evidence: `#213`, `feature/v2-time-engine`

**Canned replies** (mock cycles these on new user input; `userCount % 3`):
1. `My branches remember what my main forgot. Start with refactor/store-layer.`
   — evidence: `refactor/store-layer`, `23 commits behind`
2. `Ask issue #177 — it saw the memory leak that no one believed in.`
   — evidence: `#177`, `devtools/profiler.ts`
3. `I cannot say. The evidence is silent on that, and I do not invent.` — evidence: *(none)*

> **NOTE:** canned reply #3 is **exactly** the SPEC §5 canonical refusal string. Preserve it
> character-for-character (`I cannot say. The evidence is silent on that, and I do not invent.`).
> In the real app this must be triggered by failed evidence validation, not a modulo counter.

### 6.9 Footer / version (see §8 before shipping any of these)
- `Séance Engine v2.4.1`
- `94% of claims cite direct evidence`
- `0 hallucinations across 32 eval cases`
- `Analysis completed in 13.7s ✓`

---

## 7. Charts — how they're drawn

### 7.1 Vitals heartbeat sparkline (certificate, extracted.html:524–527)
Inline SVG, decorative EKG motif — **not** data-bound in the mock:
```
<svg viewBox="0 0 600 36" preserveAspectRatio="none" style="height:36px">
  <polyline fill="none" stroke="var(--accent,#c9973f)" stroke-width="1.5" opacity=".85"
    points="0,18 60,18 70,8 80,30 90,18 150,18 160,10 170,27 180,18 250,18 262,13 274,24
            286,18 360,18 372,16 384,21 396,18 600,18"/>
  <line x1="420" y1="4" x2="420" y2="32" stroke="#7a2620" stroke-width="1" stroke-dasharray="3 3"/>
</svg>
```
A flat baseline at `y=18` with four heartbeat blips of **decreasing amplitude** (as the repo
weakens), then a dashed **red vertical death-marker at x=420** and a dead-flat line to `x=600`.
`preserveAspectRatio="none"` lets it stretch full-width. For the real app: either keep this as a
stylized motif or drive blip positions from recent activity; the death marker = the flatline date.

### 7.2 Decline bar chart (extracted.html:567–577)
- **60 bars**, one per bucket. Heights array (percent, mock):
  `[8,14,10,22,30,26,38,44,40,52,60,56,70,78,66,84,92,80,96,100,88,94,82,90,76,84,68,74,60,66,52,58,44,48,36,40,30,26,20,22,16,12,14,9,7,8,5,4,3,2,2,1,0,0,0,0,0,0,0,0]`
  — shape = rise → plateau (~100 mid) → decay → **silence (trailing zeros)**.
- Each bar: `flex:1; height:{pct}; min-height:1px`, container `display:flex; align-items:flex-end;
  gap:2px; min-height:150px; padding-top:18px; position:relative`.
- **Color thresholds by index** `i`:
  - `i >= 52` (`deadStart`) → `#241d11` (dead/silent — dark, barely visible)
  - else `i >= 44` → `#4a3c20` (decay — dim gold)
  - else → `rgba(201,151,63,.55)` (alive — gold @ 55%)
- **Flatline overlay:** an absolutely-positioned dashed red divider at `right:14%`
  (`border-left:1px dashed #7a2620`) + the candle glyph just above it.
- Real app (SPEC §3): bucket commits by month, map counts→bar heights; last month with ≥1 commit
  before terminal silence = flatline; recolor alive/decay/dead around that boundary.

---

## 8. Footer trust statistics — MUST BECOME TRUE (SPEC §0/§7)

The mock **hardcodes invented eval numbers**. SPEC is emphatic: shipping invented trust-numbers
is the single worst outcome. Every stat below must render **from `evals/results.json`** at build
time, or say so honestly if results are missing/failing. `results.json` shape:
`{ total, passed, evidenceCitationRate, hallucinationCount, generatedAt }`.

| Mock string (verbatim) | Where | Source once real |
|---|---|---|
| `32/32 evals passing` | chat input footer | `passed`/`total` |
| `94% of claims cite direct evidence` | page footer | `evidenceCitationRate` |
| `0 hallucinations across 32 eval cases` | page footer | `hallucinationCount` + `total` |
| `Séance Engine v2.4.1` | page footer | decorative version string (safe to keep/adjust) |
| `Analysis completed in 13.7s ✓` | page footer | **per-request** autopsy timing (real elapsed), NOT an eval stat — do not source from results.json |

> **CI GREP GATE (SPEC §7/§10.8):** literal strings like `32/32` and `0 hallucinations` in
> `app/` are a **build failure**. Do NOT paste these numbers into components — bind them.
> Danger literals to avoid hardcoding: `32/32`, `94%`, `0 hallucinations`, `32 eval cases`.

---

## 9. Icons, glyphs & emoji

- **🕯 candle** — appears **exactly once**, in the Decline chart (extracted.html:572),
  positioned `right:14%; top:-2px; translateX(50%); font-size:12px; animation:drift 4s ...`.
  **SPEC §6 REQUIRES replacing 🕯 with a small inline SVG flame.** Keep it atop the flatline
  marker, keep the gentle `drift` bob (honor `prefers-reduced-motion`).
- **☽ waxing crescent moon** — chat send button glyph (15px, accent). UI glyph; not mandated for
  replacement, but consider an accessible `aria-label="Send"` since it's a bare symbol button.
- **⚡ high voltage** — leads "⚡ Attempt resurrection" button.
- **† dagger** — death marker in "2023 †" and certificate context.
- **↗ arrow** — trailing "Share report ↗", "View final commit ↗".
- **✓ check** — trailing "Analysis completed in 13.7s ✓".
- **· middot** — the pervasive separator (nav, meta, footer, tabs). Keep it.
- **— em dash** — epitaph and "— final commit …".

---

## 10. Interaction patterns

- **Unfinished-business tabs** — `state.tab` ∈ `branches|issues|todos`. Clicking a tab swaps the
  active list (`items = tabData[state.tab]`) and restyles the tab: active → border `#4a3c20`,
  bg `#1c160c`, text `#e0b366`; idle → border `#241d11`, bg transparent, text `#6b6250`. Make
  these real tab buttons (keyboard reachable, `aria-selected`).
- **Chat input** — controlled input bound to `state.draft`; `onChange` updates draft; **Enter
  submits** (`onKeyDown` checks `e.key === 'Enter'`); the ☽ button also submits. On submit: trim
  draft, ignore empty, append `{who:'user'}` + a `{who:'ghost'}` reply, clear draft. In the real
  app this becomes the streaming grounded chat (SPEC §5), not canned replies.
- **Hover** — links & evidence chips brighten to accent and border to `#4a3c20`; buttons step
  their bg one shade lighter and brighten text (see §4). Global `a:hover → #e0b366`.
- **Evidence chips** — every ghost answer and every cause renders chips that are links (`<a>`).
  SPEC §4/§5: a chip must resolve to a REAL url (commit/issue/branch/file) or be stripped; never
  render an unresolved chip.
- **Scroll** — only the interrogation message list scrolls (`overflow-y:auto`); the page itself
  should not scroll horizontally at any width (SPEC §6).

---

## 11. Gotchas / deviations the UI team must apply (not optional)

1. **Kill `min-width:1560px`**; full responsive to 375px; mobile single-column order per §3.
2. **Replace 🕯** with an inline SVG flame (§9).
3. **Bind all footer stats** from `evals/results.json`; never hardcode (§8). CI grep gate.
4. **Accessibility (SPEC §6 floor):** several body texts are ≤11px and use very dim grays
   (`#4a4336`, `#5d5545`, `#5d6b55`, `#6b6250`) on near-black `#0a0908`/`#12100a` — these are
   below 4.5:1. **Brighten the dim grays for anything that is real body text**; keep ≤11px only
   for decorative labels. Ensure every interactive element is keyboard reachable; give the ☽
   send button and icon-only controls accessible labels.
5. **Escape all GitHub-sourced text** (commit messages, issue titles, branch names, TODO lines
   are attacker-controlled — SPEC §9). No `dangerouslySetInnerHTML` on Dossier data.
6. **The refusal string is canonical** — keep §6.8 reply #3 verbatim and drive it from failed
   evidence validation, not a counter.
7. **`stellarbeacon/chronicle` and every number here are the mock's fiction** — real values come
   from the Dossier (SPEC §3) and synthesis (SPEC §4). Reproduce the *voice and layout*, not the
   data.
