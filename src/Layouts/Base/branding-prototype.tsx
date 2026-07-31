/**
 * PROTOTYPE — throwaway. Delete before this branch is folded into anything.
 *
 * The question: the wordmark's single coral `T` reads as an arbitrary letter
 * picked out of the middle of a word. What should the brand be instead, and
 * what logo mark goes with it?
 *
 * Five variants of the wordmark + mark, switchable app-wide via `?variant=`,
 * mounted on the real screens (`Base.tsx` chrome + the menu's display size) so
 * each one is judged where the wordmark actually lives — on night at 2.5rem, on
 * a lit map at 1.5rem — rather than on a swatch page. The menu additionally
 * carries a specimen strip showing the mark down to favicon size.
 *
 * Nothing here is production shape: the letter substitutions are kerned by eye
 * with em nudges, and a real one would be drawn as a single path.
 */
import { useEffect, useSyncExternalStore } from "react";
import { Box, Typography } from "@mui/material";

import { COLORS } from "../../tokens";

export type VariantKey = "A" | "B" | "C" | "D" | "E";

export const VARIANT_KEYS: VariantKey[] = ["A", "B", "C", "D", "E"];

export const VARIANT_NAMES: Record<VariantKey, string> = {
  A: "Coral T (today)",
  B: "The Groove — the o is the record",
  C: "The Parallel — a rule, not a letter",
  D: "The Seam — weight, and a play-pin",
  E: "The Signal — a place emitting music",
};

/** Why each one is a different *argument*, not a different colour. */
export const VARIANT_NOTES: Record<VariantKey, string> = {
  A: "Control. One letter in the middle of the word is coloured, and nothing about the word explains why that letter. There is no mark today.",
  B: "The emphasis moves onto the one letter that can *be* something: the o of Geo is drawn as grooves — a record read as a globe's parallels. Type is one colour; the mark is the o standing alone.",
  C: "No letter is singled out at all. A coral rule runs under the word like a parallel (and like a groove), so the accent is a line with a meaning rather than a highlighted glyph. The mark is that idea closed into a disc.",
  D: "Emphasis follows the compound word's own seam — Geo light, Tracks bold — and colour leaves the type entirely, which frees coral to stay the one loud moment elsewhere. The mark carries the brand: a map pin whose head is a play button.",
  E: "The accent becomes a place: a coral dot sits at the seam of the compound, and the mark grows the same dot into a point emitting sound. Type stays one colour and one weight.",
};

/* ------------------------------------------------------------------ *
 * Which variant is showing
 * ------------------------------------------------------------------ */

const readVariant = (): VariantKey | null => {
  if (import.meta.env.PROD) return null;
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search)
    .get("variant")
    ?.toUpperCase();
  return VARIANT_KEYS.includes(raw as VariantKey) ? (raw as VariantKey) : null;
};

let current: VariantKey | null = readVariant();
const listeners = new Set<() => void>();

export const setVariant = (next: VariantKey) => {
  current = next;
  const url = new URL(window.location.href);
  url.searchParams.set("variant", next);
  window.history.replaceState(null, "", url);
  listeners.forEach((l) => l());
};

/**
 * `null` when no `?variant=` is in the URL — the app then renders exactly what
 * it renders today, so the default path (and the test suite) is untouched.
 */
export const usePrototypeVariant = (): VariantKey | null =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => null,
  );

/* ------------------------------------------------------------------ *
 * The marks
 * ------------------------------------------------------------------ */

interface MarkProps {
  /** Pixels, or 0 to fill whatever box the mark is placed in (the inline `o`). */
  size: number;
  onNight?: boolean;
  /** Force the favicon-grade drawing regardless of size. */
  simplified?: boolean;
}

const ink = (onNight?: boolean) => (onNight ? COLORS.paper : COLORS.ink);
/** Coral swaps ends with the ground, exactly as the wordmark's T does today. */
const coral = (onNight?: boolean) =>
  onNight ? COLORS.accent3 : COLORS.accent3Deep;

const Svg = ({
  size,
  children,
  title,
}: {
  size: number;
  children: React.ReactNode;
  title: string;
}) => (
  <svg
    width={size || "100%"}
    height={size || "100%"}
    viewBox="0 0 64 64"
    role="img"
    aria-label={title}
    style={{ display: "block", overflow: "visible" }}
  >
    {children}
  </svg>
);

/** B — concentric grooves: a record at a glance, a globe's parallels at a look. */
export const MarkGroove = ({ size, onNight, simplified }: MarkProps) => {
  const small = simplified ?? size < 26;
  const fg = ink(onNight);
  const w = small ? 7 : 5;
  return (
    <Svg size={size} title="GeoTracks">
      {(small ? [28] : [29, 21.5, 14]).map((r) => (
        <circle
          key={r}
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={fg}
          strokeWidth={w}
        />
      ))}
      <circle cx={32} cy={32} r={small ? 11 : 7} fill={coral(onNight)} />
    </Svg>
  );
};

/**
 * C — a disc cut by three parallels, which are also three passes of a wave.
 *
 * They *bow*: straight ones are how a globe's parallels actually project when
 * it faces you square on, and drawn that way the mark reads as a hamburger menu
 * at any size and as a minus-in-a-circle at 16px. Tilting the globe is what
 * makes them curve, and a curve is also what makes them sound rather than UI.
 */
export const MarkParallel = ({ size, onNight, simplified }: MarkProps) => {
  const small = simplified ?? size < 26;
  const parallels = small
    ? ["M14 25 Q32 35 50 25", "M17 42 Q32 51 47 42"]
    : ["M16 21 Q32 30 48 21", "M11 33 Q32 42 53 33", "M18 44 Q32 52 46 44"];
  return (
    <Svg size={size} title="GeoTracks">
      <circle cx={32} cy={32} r={31} fill={coral(onNight)} />
      {parallels.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={COLORS.paper}
          strokeWidth={small ? 7 : 5}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
};

/** D — a map pin whose head is a play button. Pear fills, ink draws. */
export const MarkPlayPin = ({ size, onNight, simplified }: MarkProps) => {
  const small = simplified ?? size < 26;
  return (
    <Svg size={size} title="GeoTracks">
      <path
        d="M32 3c-12.7 0-23 10.3-23 23 0 16.4 20.2 33.4 21.1 34.1a3 3 0 0 0 3.8 0C34.8 59.4 55 42.4 55 26 55 13.3 44.7 3 32 3z"
        fill={COLORS.accent}
        stroke={small ? ink(onNight) : "none"}
        strokeWidth={small ? 3 : 0}
      />
      <path
        d={small ? "M25 15l17 11-17 11z" : "M26 16l17 10-17 10z"}
        fill={COLORS.ink}
        strokeLinejoin="round"
        strokeWidth={4}
        stroke={COLORS.ink}
      />
    </Svg>
  );
};

/** E — a point on the ground, and the sound coming off it. */
export const MarkSignal = ({ size, onNight, simplified }: MarkProps) => {
  const small = simplified ?? size < 26;
  const fg = ink(onNight);
  return (
    <Svg size={size} title="GeoTracks">
      {!small && (
        <path
          d="M20 15A31 31 0 0 1 51 46"
          fill="none"
          stroke={fg}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
      <path
        d={small ? "M20 24A34 34 0 0 1 54 58" : "M20 27A25 25 0 0 1 45 52"}
        fill="none"
        stroke={fg}
        strokeWidth={small ? 8 : 6}
        strokeLinecap="round"
      />
      <circle cx={20} cy={52} r={small ? 13 : 10} fill={coral(onNight)} />
    </Svg>
  );
};

export const Mark = ({
  variant,
  ...rest
}: MarkProps & { variant: VariantKey }) => {
  switch (variant) {
    case "B":
      return <MarkGroove {...rest} />;
    case "C":
      return <MarkParallel {...rest} />;
    case "D":
      return <MarkPlayPin {...rest} />;
    case "E":
      return <MarkSignal {...rest} />;
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ *
 * The wordmarks
 * ------------------------------------------------------------------ */

interface WordProps {
  onNight?: boolean;
  /** Chrome size (1.5rem) rather than display size. */
  compact?: boolean;
}

/** A — what ships today: Geo + a coral T + racks. */
const WordCoralT = ({ onNight }: WordProps) => (
  <>
    Geo
    <Box
      component="span"
      sx={{ color: onNight ? COLORS.accent3 : "error.main" }}
    >
      T
    </Box>
    racks
  </>
);

/** B — the o of Geo, drawn as the mark. */
const WordGroove = ({ onNight, compact }: WordProps) => (
  <>
    Ge
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: "0.68em",
        height: "0.68em",
        mx: "0.04em",
        // Sits the disc on the x-height rather than the baseline: an o has no
        // overshoot to spare and a circle that hangs low reads as a full stop.
        verticalAlign: "-0.02em",
      }}
    >
      {/* Fills its box, so the groove count is chosen by where the word is
          rather than by a measured size: three grooves at display size, one at
          chrome size, which is the same call the favicon makes. */}
      <MarkGroove size={0} onNight={onNight} simplified={compact} />
    </Box>
    Tracks
  </>
);

/** C — one colour, and a coral parallel underneath. */
const WordParallel = ({ onNight }: WordProps) => (
  <Box component="span" sx={{ display: "inline-block" }}>
    GeoTracks
    <Box
      sx={{
        height: "0.075em",
        mt: "0.06em",
        borderRadius: 999,
        bgcolor: coral(onNight),
      }}
    />
  </Box>
);

/** D — the compound's seam carried by weight, with no colour in the type. */
const WordSeam = ({ onNight }: WordProps) => (
  <>
    <Box
      component="span"
      sx={{
        fontWeight: 400,
        color: onNight ? COLORS.paperMuted : COLORS.inkMuted,
      }}
    >
      Geo
    </Box>
    <Box component="span" sx={{ fontWeight: 700 }}>
      Tracks
    </Box>
  </>
);

/** E — a coral point sits at the seam. */
const WordSignal = ({ onNight }: WordProps) => (
  <>
    Geo
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: "0.19em",
        height: "0.19em",
        mx: "0.09em",
        verticalAlign: "0.16em",
        borderRadius: 999,
        bgcolor: coral(onNight),
      }}
    />
    Tracks
  </>
);

export const VariantWord = ({
  variant,
  ...rest
}: WordProps & { variant: VariantKey }) => {
  switch (variant) {
    case "B":
      return <WordGroove {...rest} />;
    case "C":
      return <WordParallel {...rest} />;
    case "D":
      return <WordSeam {...rest} />;
    case "E":
      return <WordSignal {...rest} />;
    default:
      return <WordCoralT {...rest} />;
  }
};

/* ------------------------------------------------------------------ *
 * The specimen strip (menu only)
 * ------------------------------------------------------------------ */

const SIZES = [64, 40, 32, 16];

const Chip = ({
  children,
  label,
  bg,
  nowrap,
}: {
  children: React.ReactNode;
  label: string;
  bg: string;
  nowrap?: boolean;
}) => (
  <Box sx={{ textAlign: "center", minWidth: 0 }}>
    <Box
      sx={{
        bgcolor: bg,
        borderRadius: "12px",
        p: 1.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: nowrap ? "nowrap" : "wrap",
        gap: 1.5,
        minHeight: 72,
      }}
    >
      {children}
    </Box>
    <Typography
      variant="caption"
      sx={{ color: COLORS.paperMuted, fontSize: "0.65rem" }}
    >
      {label}
    </Typography>
  </Box>
);

/**
 * Everything a mark has to survive: display size, the tab-bar 16px, and both
 * grounds. Rendered under the menu's buttons, and only when `?variant=` is set.
 */
export const BrandSpecimen = ({ variant }: { variant: VariantKey }) => (
  <Box sx={{ mt: 5, textAlign: "left" }}>
    {/* Paper, not pear: the system has no pear that may be drawn as text. */}
    <Typography
      variant="overline"
      sx={{ color: COLORS.paper, display: "block" }}
    >
      {variant} — {VARIANT_NAMES[variant]}
    </Typography>
    <Typography
      variant="body2"
      sx={{ color: COLORS.paperMuted, mb: 2.5, maxWidth: 460 }}
    >
      {VARIANT_NOTES[variant]}
    </Typography>

    {variant === "A" ? (
      <Typography variant="body2" sx={{ color: COLORS.paperMuted }}>
        No mark exists today — flip to B–E to compare.
      </Typography>
    ) : (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 1.5,
        }}
      >
        <Chip label="on night" bg="rgba(255,255,255,0.04)">
          {SIZES.map((s) => (
            <Mark key={s} variant={variant} size={s} onNight />
          ))}
        </Chip>
        <Chip label="on paper (favicon, app icon)" bg={COLORS.paper}>
          {SIZES.map((s) => (
            <Mark key={s} variant={variant} size={s} />
          ))}
        </Chip>
        <Chip label="lockup, chrome size" bg={COLORS.paper} nowrap>
          <Mark variant={variant} size={22} />
          <Typography
            variant="h1"
            aria-label="GeoTracks"
            sx={{ fontSize: "1.5rem", color: COLORS.ink, whiteSpace: "nowrap" }}
          >
            <VariantWord variant={variant} compact />
          </Typography>
        </Chip>
      </Box>
    )}
  </Box>
);

/* ------------------------------------------------------------------ *
 * The switcher
 * ------------------------------------------------------------------ */

const cycle = (from: VariantKey, delta: number) => {
  const index = VARIANT_KEYS.indexOf(from);
  const next =
    VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length];
  if (next) setVariant(next);
};

export const PrototypeSwitcher = ({ current }: { current: VariantKey }) => {
  const go = (delta: number) => cycle(current, delta);

  const button = {
    border: "none",
    background: "transparent",
    color: COLORS.paper,
    fontSize: "1rem",
    cursor: "pointer",
    padding: "4px 10px",
    lineHeight: 1,
  } as const;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 999,
        bgcolor: "#1b1f24",
        border: "2px solid #6f42c1",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        color: COLORS.paper,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: "0.75rem",
        whiteSpace: "nowrap",
      }}
    >
      <button
        type="button"
        style={button}
        onClick={() => go(-1)}
        aria-label="Previous variant"
      >
        ←
      </button>
      <span>
        PROTOTYPE {current} — {VARIANT_NAMES[current]}
      </span>
      <button
        type="button"
        style={button}
        onClick={() => go(1)}
        aria-label="Next variant"
      >
        →
      </button>
    </Box>
  );
};

/** `←`/`→` anywhere on the page, as long as nothing is being typed into. */
export const usePrototypeKeys = (showing: VariantKey | null) => {
  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      cycle(showing, e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showing]);
};
