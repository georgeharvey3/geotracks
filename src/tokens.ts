/**
 * The design system's colour tokens — the one place a colour is chosen.
 *
 * The system is designed in OKLCH (each token's design value is in the comment
 * beside it) but ships as sRGB hex, because these values are consumed three
 * different ways: through MUI's palette, which runs colour manipulators that
 * cannot decompose `oklch()`; as SVG `fill`/`stroke` attributes on the map; and
 * as plain CSS. One resolved value in all three keeps a single red on screen.
 * `tokens.css` at the repo root is the portable export of the same set.
 *
 * See `design.md` for what each token is *for*; the rule that matters is that a
 * colour appears in exactly one entry here and is referenced by name elsewhere.
 */

export const COLORS = {
  /** Cream, never pure white — the ground everything sits on. */
  paper: "#f7f5ec", //        oklch(97% 0.012 95)
  /** Tinted band, for a section that needs separating from the page. */
  paper2: "#eeebdf", //       oklch(94% 0.016 95)
  /** Deeper still: hover on a surface, and inert chrome. */
  paper3: "#e5e1d3", //       oklch(91% 0.020 95)

  /** Near-black with a cool tilt, never pure black. */
  ink: "#12171b", //          oklch(20% 0.012 250)
  /** Secondary copy. 6.5:1 on paper, so it stays readable rather than faint. */
  inkMuted: "#54595e", //     oklch(46% 0.010 250)
  /** Hairline rules and dividers. */
  rule: "#cdd1d6", //         oklch(86% 0.008 250)

  /** Pear — the primary action. Buttons, and nothing else competing. */
  accent: "#f6ce00", //       oklch(86% 0.18 95)
  /** The solid edge under a pear button: its thickness, not a shadow. */
  accentDeep: "#d19c00", //   oklch(72% 0.17 88)

  /** Sky-cyan — links and the Spotify hand-off. Never a fill on the map. */
  accent2: "#009fef", //      oklch(66% 0.18 235)

  /** Coral — one loud moment per screen. Large surfaces only. */
  accent3: "#ff3a5d", //      oklch(68% 0.24 18)
  /**
   * The coral that carries small text: 5.1:1 against paper either way round,
   * so it works as warning copy on cream and as a chip with cream text on it.
   * `accent3` itself is only 3.2:1 and may never hold a label.
   */
  accent3Deep: "#c42942", //  oklch(54% 0.19 18)

  /** Mint — correct. The revealed answer, and the country now playing. */
  mint: "#66da85", //         oklch(80% 0.16 150)
  /** The mint that survives being drawn on cream land. */
  mintDeep: "#45b164", //     oklch(68% 0.15 150)
  /**
   * Mint as a *foreground* on cream, at 4.2:1. The accents are designed to own
   * fills, not text: pear is 1.4:1 on paper and mint 2.5:1, so anything drawn
   * in an accent rather than filled with one needs its own darker value.
   */
  mintInk: "#1c8742", //      oklch(55% 0.14 150)

  /** Focus ring. 6.7:1 on paper, and never animated. */
  focus: "#0055a9", //        oklch(45% 0.16 250)

  /** Scoreboard medals — ordinal, so they stay literal. */
  gold: "#f6ce00", //         = accent
  silver: "#b9bec4", //       oklch(80% 0.010 250)
  bronze: "#bd835b", //       oklch(66% 0.090 55)
} as const;

/**
 * The map's own palette. Land sits above sea in lightness so the coastline
 * reads without an outline doing the work, and the hover highlight goes
 * near-white — a value nothing else on the map uses.
 *
 * Every separation here is a *lightness* separation, because hue on its own
 * does not survive being a country twelve pixels wide. The first version of
 * this palette tried to hold three of them apart on hue alone and came out
 * flat: land against sea was 1.10:1, the border against land 1.10:1 and inert
 * land against land 1.03:1 — a world drawn in one colour.
 */
export const MAP_COLORS = {
  /**
   * Deep enough that the land/sea step *is* the coastline (2.6:1 against land).
   * The pale sea it replaced sat a shade lighter than the continents floating
   * on it, so nothing had an edge; it also left the straggler markers — cream
   * dots out in open ocean, and the only target those countries have — with
   * 1.1:1 to be found against.
   */
  sea: "#528eb3", //          oklch(62% 0.085 238)
  /** Land the app holds music for: warm, because there is something here. */
  land: "#e6dbb2", //         oklch(89% 0.055 95)
  /**
   * No music, or not choosable: neutral, so it recedes beside the warm land.
   * It recedes in lightness too — dropping the hue but keeping land's lightness
   * left 1.03:1 between them, which is to say no difference at all.
   */
  inertLand: "#b4b8bc", //    oklch(78% 0.008 250)
  highlight: "#faf8f1", //    oklch(98% 0.010 95)
  /**
   * The hairline between countries. Warm, out of the land's own family, so it
   * reads as a line drawn on the paper rather than a pencil laid across it, and
   * dark enough to divide two neighbours: 2.6:1 on land, 1.8:1 on inert land.
   * It is deliberately invisible against the sea (1.0:1) — the coastline is the
   * land/sea step, and a stroke that showed there would ring every island in a
   * halo. It used to be the sea colour, which made every internal border a
   * ghost on a map whose whole job is picking one country out of its region.
   */
  border: "#8c8675", //       oklch(62% 0.025 88)
  /**
   * The outline a *marked* country gets. Every mark on a cream map is lighter
   * than 3:1 against the land it sits on — pear is 1.3:1 — so the fill alone
   * cannot be what makes a mark visible. The outline carries that job and the
   * fill carries the meaning.
   */
  mark: "#12171b", //         = ink
} as const;

/**
 * The proximity heat scale's endpoints, as HSL components so the scale can be
 * interpolated across them. Amber to deep coral: on cream, a pale yellow near
 * end would vanish into the land, and the scale descends in lightness as well
 * as hue so it stays ordered for a player who can't separate the two by hue.
 */
export const HEAT = {
  near: { h: 45, s: 100, l: 48 },
  far: { h: -12, s: 70, l: 45 }, // -12 === 348, kept signed so it interpolates
} as const;

/** Every wrong guess with hints off: one flat value, carrying no distance. */
export const FLAT_WRONG = "#bb6c6f"; // oklch(62% 0.10 18)
