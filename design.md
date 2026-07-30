# Design — GeoTracks

A locked design system for this app. Every screen redesign reads this file
before emitting code. Do not regenerate it per screen — extend or amend it when
the system needs to grow.

The system is **Hum**: cream paper, a multi-accent palette, rounded sans, and
buttons whose press is their feedback. It replaced a dark navy-purple MUI theme
and a mono-only type stack.

## Genre

**playful.** Warm and alive rather than tidy — GeoTracks is a game about
listening, not a dashboard. Playful's usual low-chroma rule is relaxed here
because Hum is its documented exception, and because a guessing map needs its
markings to survive being twelve pixels wide.

## Source of truth

Colours are chosen in exactly one place: **`src/tokens.ts`**. `src/tokens.css`
is the same set as CSS custom properties (imported by `src/index.css`) and is
the portable export — it lives under `src/` rather than at the repo root because
it is imported by the app; a second copy at the root would drift from it.

The system is designed in OKLCH — each token's design value sits in a comment
beside it — but **ships as sRGB hex**, because these values are consumed three
ways: through MUI's palette, which runs colour manipulators that cannot
decompose `oklch()`; as SVG `fill`/`stroke` attributes on the map; and as plain
CSS. One resolved value in all three keeps a single red on screen.

## Macrostructure families

- **Menu / Scoreboard (content pages)** — centred column on `Base`, capped at
  `sm`, standing on the **night backdrop** (below): the map under a black veil,
  which is ground rather than enrichment — nothing is added to the column.
  Typography and the button stack carry it. These are the two screens that are
  _about_ the game without being made of it, and the backdrop is what says so.
  Their foreground is **paper on night**, the mirror of the app pages' ink on
  paper; opaque surfaces they contain (the scoreboard's table card) are cream
  and take ink back.
- **Game / Explore (app pages)** — **Workbench**: the map is a live surface
  covering the viewport, with `PanelSurface` floating over one corner in
  landscape and dropping to a content-sized bottom tray in portrait. Governed by
  `src/layout.ts`, which this redesign did not touch. No enrichment: the map is
  the page. A readout the player never acts on may take a corner of the map on
  its own plaque — the panel's treatment (opaque, ink-outlined, 20px) but
  click-through — as Competition's standings do; controls stay in the panel.
- **Run summary (content page over an app surface)** — the Workbench shell with
  the panel scrolling its Turn result rows.

## Theme

| token                   | value                              | job                     |
| ----------------------- | ---------------------------------- | ----------------------- |
| `--color-paper`         | `#f7f5ec` · `oklch(97% 0.012 95)`  | cream, never pure white |
| `--color-paper-2`       | `#eeebdf` · `oklch(94% 0.016 95)`  | tinted band             |
| `--color-paper-3`       | `#e5e1d3` · `oklch(91% 0.020 95)`  | surface hover           |
| `--color-paper-muted`   | `#b7b5ab` · `oklch(76% 0.008 95)`  | secondary copy on night |
| `--color-night`         | `#05070a` · `oklch(11% 0.008 250)` | the backdrop's veil     |
| `--color-ink`           | `#12171b` · `oklch(20% 0.012 250)` | near-black, cool tilt   |
| `--color-ink-muted`     | `#54595e` · `oklch(46% 0.010 250)` | secondary copy, 6.5:1   |
| `--color-rule`          | `#cdd1d6` · `oklch(86% 0.008 250)` | hairlines               |
| `--color-accent`        | `#f6ce00` · `oklch(86% 0.18 95)`   | pear — primary action   |
| `--color-accent-deep`   | `#d19c00` · `oklch(72% 0.17 88)`   | the button's solid edge |
| `--color-accent-2`      | `#009fef` · `oklch(66% 0.18 235)`  | cyan — links            |
| `--color-accent-3`      | `#ff3a5d` · `oklch(68% 0.24 18)`   | coral — large surfaces  |
| `--color-accent-3-deep` | `#c42942` · `oklch(54% 0.19 18)`   | coral that holds text   |
| `--color-mint`          | `#66da85` · `oklch(80% 0.16 150)`  | correct                 |
| `--color-mint-deep`     | `#45b164` · `oklch(68% 0.15 150)`  | correct, as a map fill  |
| `--color-focus`         | `#0055a9` · `oklch(45% 0.16 250)`  | focus ring, 6.7:1       |

### The rule that governs the accents

**Accents own fills; ink owns foregrounds.** On cream, pear is 1.4:1, mint
2.5:1 and cyan 2.7:1 — none of them clears even the 3:1 bar for a graphical
object, let alone 4.5:1 for text. So an accent may fill a shape that carries an
ink label, but may not be the colour a glyph or a word is drawn in.

Where an accent identity _must_ be a foreground, it gets its own darker value:
`mintInk` (`#1c8742`, 4.2:1) and `accent3Deep` (`#c42942`, 5.1:1). There is no
pear equivalent, deliberately — a pear dark enough to read as text stops looking
like pear, so pear-as-text is simply not a move this system has.

**On night the pairs swap ends.** `accent3Deep` is the coral that holds a
foreground on cream and only 2.0:1 on the backdrop; the wordmark's `T` is drawn
in the light `accent3` there instead (4.1:1, and it is display type). The same
goes for chrome: ink becomes paper, `inkMuted` becomes `paperMuted`, and the
focus ring — `--color-focus` is 1.6:1 on night, a ring nobody could find —
becomes paper, scoped by `[data-surface="night"]` in `src/index.css`. Nothing
else about the system changes: the pear button and its ink label are the same
button on either ground.

Each accent holds one job and does not appear where it doesn't mean something:
pear = the primary action, cyan = links and the Spotify hand-off, coral = one
loud moment per screen, mint = correct. No gradients between accents, ever.

## The map

The map has its own palette because it is most of the app.

| token          | value     | job                                   |
| -------------- | --------- | ------------------------------------- |
| `--map-sea`    | `#528eb3` | the ground — 2.6:1 under land         |
| `--map-land`   | `#e6dbb2` | playable — warm, there is music here  |
| `--map-inert`  | `#b4b8bc` | no music: neutral _and_ a step darker |
| `--map-hover`  | `#faf8f1` | near-white, used by nothing else      |
| `--map-border` | `#8c8675` | the hairline between two countries    |
| `--map-mark`   | `#12171b` | the outline a marked country gets     |

**Separation on the map is always a lightness separation.** Hue does not
survive being a country twelve pixels wide, and the map's first palette proved
it: it held land apart from sea, border from land and inert land from land on
hue alone, and every one of those pairs landed between 1.03:1 and 1.10:1 — a
world drawn in a single colour. Each is now a real step in lightness, with hue
carrying only the meaning (warm = there is music here, neutral = there is not).

The sea is the load-bearing one. Deep enough and the land/sea step **is** the
coastline, with no stroke doing the work; it is also what the straggler markers
are found against, since those cream dots sit out in open ocean and are the only
target their countries have. The border is deliberately the reverse — 2.6:1 on
land but 1.0:1 on sea, so it divides neighbours without ringing every island in
a halo.

**Every mark on the map carries an ink outline.** This is load-bearing, not
decoration: on cream land the warm end of the proximity scale is 1.3:1 and mint
is 2.0:1, so a fill on its own cannot be what makes a mark visible. The outline
does that job and the fill is left to carry the meaning. `BaseMap` takes a
`marked` predicate for it, which — like `fillFor` — says nothing about _what_ is
marked, so the base stays state-agnostic (ADR-0003).

**The proximity scale runs amber → deep coral** and descends in _lightness_ as
well as hue (`HEAT` in `src/tokens.ts`). Hue alone would order the scale only
for players who can separate red from amber, and on cream a pale near end would
vanish into the land. Endpoints: `hsl(45, 100%, 48%)` → `hsl(348, 70%, 45%)`.

**Turn outcomes** are mint / pear / coral-deep (`OUTCOME_FILLS`), which is the
old green/amber/red run translated into the palette one for one.

### The map as the content pages' backdrop

The content pages are the way in to three surfaces made of the map, so they
stand on one: the game's map at rest, covering the viewport behind the column
(`BackdropMap`). It is a **veil, not a wash** — the map is drawn at full
strength and then covered in `night` at 0.82 — so what is left is a coastline in
the dark rather than a picture of the world. Paper type lands at ~12:1 over it
whatever the map has drawn underneath, which is what lets the veil be the same
one on both pages and under any pan.

The veil belongs to the **map** rather than to the backdrop (`BaseMap`'s `veil`:
`night` holds it, `lift` takes it off on mount, `settle` draws it on, `none`
never had one), because it is also how a screen arrives in both directions — see
Motion. All of them must start and end on the same darkness, so there is one
value, in `tokens.ts` and mirrored into `tokens.css` for the keyframes.

Three things are taken off the map on the way in, all for the same reason —
nothing here is picked, so nothing here is a target:

- **No straggler dots.** They exist so every guessable country has something big
  enough to hit; drawn at a constant screen size out in open ocean, they are the
  only thing on a decorative map that reads as UI (`BaseMap`'s `showStragglers`,
  which defaults to on: a surface opts out of being playable, never into it).
- **One land fill.** The playable/inert split is a statement about where there
  is music. Under the veil the two land a hundredth of a stop apart anyway, so
  all it would add is patchiness in a picture that means nothing.
- **No name on hover, and no country selectable.** The whole thing is
  click-through and out of the accessibility tree, so the column's buttons
  remain the entire screen to a pointer, a keyboard and a screen reader alike.

**Both content pages get it, and only they do.** The map surfaces are the map
already; the backdrop is what marks a screen as being about the game without
being made of it.

## Typography

- **Display and body:** Plus Jakarta Sans — 700 for display, 600 for buttons and
  emphasis, 400 for copy. Tracking `-0.025em` on display. No serif anywhere.
- **Mono:** JetBrains Mono, kept for the one job it earns — figures that line
  up. Scores, distances, turn counts, country codes. Not running copy, which is
  what the old Inconsolata-everywhere stack was doing.
- `font-variant-numeric: tabular-nums` is set globally on `body`.
- **No italics for emphasis.** Weight (500) or colour carries it. Italic is for
  running copy only.

## Spacing

MUI's 8-point scale via `sx`, with the named 4-point scale in `tokens.css`
(`--space-*`) for anything written as plain CSS. Screen geometry —
landscape/portrait, chrome clearance, the portrait tray's ceiling — stays in
`src/layout.ts` and is not this system's business.

## Radii

`--radius-card: 20px` · `--radius-pill: 999px` · `--radius-input: 12px`.
**No square corners** — this is the rounded theme. Buttons are pills.

## Motion

- Easings: `--ease-press: cubic-bezier(0.2, 0.7, 0.3, 1)` for the button,
  `--ease-snap: cubic-bezier(0.22, 1, 0.36, 1)` for reveals, and
  `--ease-reveal: cubic-bezier(0.65, 0, 0.35, 1)` for the veil alone. It is the
  one easing here that is not front-loaded, because the thing it moves is not:
  brightness climbs much faster than a veil's opacity falls — halfway off is
  already ~80% of the way to full — so `--ease-snap` spent the first 70ms of a
  reveal doing most of the visible work and the rest crawling, which is a flash
  with a long tail. Symmetric: the darkness lets go rather than jumping, and
  settles rather than stopping.
- **The press is the feedback.** A filled button has a solid colour edge beneath
  it (`0 4px 0 0 accentDeep`) giving it thickness — never a negative spread,
  which would make the edge narrower than the button and read as a dropped
  shadow. It lifts 2px on hover (edge grows to 6px) and presses _down_ 3px on
  `:active` (edge shrinks to 1px). No `scale()`, no spring overshoot.
- **Arriving somewhere** is three things, staged, and only ever _in_ — the
  outgoing screen is gone the instant it is replaced, and holding two screens
  alive to cross-fade them would mean two maps mounted at once:
  1. **The screen arrives**, and how depends on which family it is in.
     - A **content page** fades up and settles the last 8px (`screen-enter`,
       220ms). Only the _content_: the chrome is deliberately outside it. If it
       was reached from a map surface, the night is drawn back over that map
       underneath it (`veil-settle`, 320ms) instead of the page cutting to
       black. Brisker than the reveal, because the page's paper type is fading
       up over the same seconds and does it over a lit map until the veil is
       most of the way in. On the first page of a session the veil is simply
       already there: there is nothing to come back from, and animating it would
       show a lit world and then put it out.
     - A **map surface** does not fade. It is the map the page before it was
       standing on, so it arrives by that map's **veil lifting** (`veil-lift`,
       520ms, from exactly the 0.82 the page ended on). Fading a map means
       drawing it at less than full opacity, and what shows through is the cream
       underneath: the player sees the whole screen wash out to white and then
       resolve. The one thing on these screens that was already there is the
       world, so the way in is to uncover it rather than to draw a new one.
       The Run summary is the exception — it is reached from the game screen,
       which is this same map already revealed, so it lifts nothing.
  2. **The wordmark glides.** It is the one element every screen shares, so it
     is what carries the eye across an otherwise instant swap: the incoming one
     is drawn where the outgoing one was and released (FLIP, 420ms, in
     `Base.tsx`). It measures the word rather than the heading block — the
     heading fills its container on both screens, so the block's own box would
     put the two at the same width and the flight would never scale. Being
     transform-only it runs on the compositor, which matters because the screen
     it lands on is mounting ~250 country shapes on the main thread at the time.
  3. **The panel** comes in last (`panel-enter`, 320ms after a 120ms beat) and
     from the edge it is attached to: the tray up from the bottom in portrait,
     the card down from the top in landscape. Staged, so the map reads as the
     page and the panel as the thing placed on it.
- `prefers-reduced-motion: reduce` collapses spatial motion globally in
  `src/index.css`; the press still recolours, so nothing loses its feedback. The
  glide is the one piece of motion that rule cannot reach — it is a Web
  Animation, not a CSS one — so it checks the query itself.
- The focus ring is **never** animated.

## Microinteractions stance

- Silent success over celebratory toasts.
- The panel is **opaque and outlined, never blurred.** A translucent blur over a
  map fights the thing it sits on; the panel is the one surface that has to stay
  readable whatever the player has panned underneath it.
- No glassmorphism, no gradient text, no accent stripe on a card edge.

## CTA voice

- **Primary** — filled pear pill, ink label, the solid edge and the press.
  One per primary moment; three filled pear buttons never stack in a row except
  on the menu, where each _is_ a primary choice.
- **Secondary** — outlined pill, **ink** border and ink label (not pear: see the
  accent rule).

## What screens MUST share

- The wordmark, including its single coral `T` — and its `aria-label`, because
  splitting the word into elements to colour one letter also splits it for the
  accessibility tree, which otherwise announces "Geo T racks".
- The accent set and the one-job-each rule.
- Plus Jakarta Sans + JetBrains Mono, and mono only for figures.
- The CTA voice: pill radius, the edge, the press.
- The map palette and the marked-country outline.

## What screens MAY differ on

- Which macrostructure family they belong to (above).
- Panel content and its order.
- Whether the map is the surface at all, or only the veiled backdrop above.
- Which ground they are on: the content pages are paper on night, the app pages
  ink on paper.

## Per-page allowances

- Content pages: typography only, plus the night backdrop.
- App pages: no enrichment — the map is the artefact.
- No screen gets a hero illustration, a mascot, or a character moment. Hum
  normally asks for one; GeoTracks already has 240 hand-drawn shapes on screen
  and does not need another.

## Exports

`src/tokens.css` is the drop-in CSS export. A Tailwind `@theme` block, a DTCG
`tokens.json` and shadcn/ui variables can be generated from it if this system is
ever reused elsewhere; the app itself needs none of them, so they are not
carried here as dead files.
