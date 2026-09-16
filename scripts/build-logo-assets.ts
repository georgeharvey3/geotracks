/**
 * Regenerate the mark's committed asset files from its one geometry.
 *
 *   node scripts/build-logo-assets.ts
 *
 * Writes `public/logo.svg`, `public/logo192.png`, `public/logo512.png`,
 * `public/geotracks.ico`, `public/apple-touch-icon.png` and the two maskable
 * PNGs. Re-run it only when the mark itself changes — like
 * `build-map-geometry.mjs`, the outputs are committed and the script is not part
 * of the build.
 *
 * Two families come out of the one drawing, because a tab strip and a home
 * screen ask for opposite things. The **favicon** family is transparent and
 * full-bleed: it is composited onto whatever chrome the browser has, and padding
 * itself would only make it look smaller than its neighbours. The **installed**
 * family is opaque and inset, because the platform masks it — iOS flattens any
 * transparency to black and then cuts a squircle out of the result, so a
 * transparent full-bleed mark becomes a clipped pin on a black tile. They are
 * generated together so the two can never drift apart.
 *
 * The paths come from `src/Components/Logo/geometry.ts`, which `Logo.tsx` also
 * draws from, so the favicon cannot drift from the mark on screen. The two
 * colours come from `src/tokens.css` — the system's portable export — because
 * this file runs under bare `node`, which strips TypeScript's types but still
 * resolves imports as ESM and so cannot follow `tokens.ts`'s extensionless
 * specifiers.
 *
 * Rasterising needs Chrome on the machine (`google-chrome`, or `CHROME` in the
 * environment). Nothing in CI runs this.
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GLYPH_STROKE,
  LOGO_STROKE,
  LOGO_VIEW_BOX,
  PIN_PATH,
  PLAY_PATH,
} from "../src/Components/Logo/geometry.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const chrome = process.env.CHROME ?? "google-chrome";

/** One colour is chosen in one place; here we are only reading it back. */
const token = (name: string): string => {
  const css = readFileSync(join(root, "src", "tokens.css"), "utf8");
  const match = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`No --color-${name} in tokens.css`);
  return match[1].trim();
};

const pear = token("accent");
const ink = token("ink");
const paper = token("paper");

/** The mark itself — the two paths, in viewBox units, and nothing around them. */
const mark = `  <path d="${PIN_PATH}" fill="${pear}" stroke="${ink}" stroke-width="${LOGO_STROKE}" stroke-linejoin="round"/>
  <path d="${PLAY_PATH}" fill="${ink}" stroke="${ink}" stroke-width="${GLYPH_STROKE}" stroke-linejoin="round"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEW_BOX}">
${mark}
</svg>
`;
writeFileSync(join(publicDir, "logo.svg"), svg);

/** The viewBox is square (see `LOGO_VIEW_BOX`); this is that square's side. */
const BOX = Number(LOGO_VIEW_BOX.split(" ")[2]);

/**
 * The same mark, inset by `margin` of the canvas on every side and standing on
 * cream rather than on nothing.
 *
 * Cream because it is the ground the mark is *designed* on: the ink outline
 * around the pin exists because pear is 1.4:1 on paper (`design.md` § The
 * brand), so an icon on cream is the mark exactly as the app draws it, outline
 * and all, rather than a second treatment invented for the home screen.
 *
 * Opaque because the platforms that use these icons do not composite them onto
 * anything friendly: iOS fills transparency with black, and Android draws them
 * on its own wallpaper-dependent ground.
 */
const onPaper = (margin: number): string => {
  const scale = 1 - margin * 2;
  const offset = (BOX * margin).toFixed(4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEW_BOX}">
  <rect x="0" y="0" width="${BOX}" height="${BOX}" fill="${paper}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
${mark}
  </g>
</svg>
`;
};

/**
 * How much ground each installed icon leaves around the mark.
 *
 * `APPLE` — iOS masks the icon into a squircle whose corners eat roughly 22% of
 * the side, and Apple's own icons seat their subject well inside that. 11% a
 * side keeps the pin's point and head clear of the cut without shrinking it to
 * a dot in the middle of a tile.
 *
 * `MASKABLE` — the web app manifest's `maskable` purpose promises that anything
 * inside the **circle** of 80% diameter survives whatever mask the launcher
 * applies, and this is the strict circular reading of that rather than the
 * generous squircle one: an icon clipped on somebody else's launcher is not
 * something we would ever see. The number is fitted to the mark's *ink* rather
 * than to its bounding box — a pin is round on top and pointed at the bottom, so
 * it has nothing in the corners, and bounding its diagonal instead would shrink
 * it to 69% of the canvas to protect two corners that are empty. At 77% the
 * furthest inked pixel sits at about 0.92 of the safe radius: inside, with the
 * margin a drawing should keep from a boundary rather than hugging it.
 */
const APPLE_MARGIN = 0.11;
const MASKABLE_MARGIN = 0.115;

/**
 * Chrome, driven over the DevTools protocol rather than with `--screenshot`.
 *
 * Headless Chrome reserves part of the window it is given for browser UI that
 * is never drawn, so `--window-size=192,192` lays the page out in 192×105 and
 * writes a 192×192 file with the bottom of the mark cut off. `captureScreenshot`
 * with an explicit clip is the only way to ask for exactly the square we want.
 */
const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--remote-debugging-port=0",
    // What makes the ground transparent rather than white.
    "--default-background-color=00000000",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

const debuggerUrl = await new Promise<string>((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error(`${chrome} never reported a debugger URL`)),
    20_000,
  );
  browser.stderr.on("data", (chunk: Buffer) => {
    const match = /ws:\/\/\S+/.exec(String(chunk));
    if (!match?.[0]) return;
    clearTimeout(timer);
    resolve(match[0]);
  });
  browser.on("error", reject);
});

/**
 * The URL Chrome prints is the *browser* endpoint, which has no `Page` domain
 * on it. Rather than hunting for a tab through the HTTP listing — which is not
 * populated at the moment the browser answers — we open one ourselves and
 * attach to it, and every drawing command is then addressed to that session.
 */
const socket = new WebSocket(debuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve));

let nextId = 0;
const pending = new Map<number, (result: unknown) => void>();
socket.addEventListener("message", (event: MessageEvent) => {
  const message = JSON.parse(String(event.data)) as {
    id?: number;
    result?: unknown;
  };
  if (message.id !== undefined) pending.get(message.id)?.(message.result);
});

const send = <T>(
  method: string,
  params: object = {},
  sessionId?: string,
): Promise<T> =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve as (result: unknown) => void);
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send<{ targetId: string }>("Target.createTarget", {
  url: "about:blank",
});
const { sessionId } = await send<{ sessionId: string }>(
  "Target.attachToTarget",
  { targetId, flatten: true },
);

/** Everything below is addressed to that tab rather than to the browser. */
const inPage = <T>(method: string, params: object = {}): Promise<T> =>
  send<T>(method, params, sessionId);

await inPage("Page.enable");
// The command-line flag alone does not reach a clipped capture: without this
// the mark is composited onto white and the icon has a square around it.
await inPage("Emulation.setDefaultBackgroundColorOverride", {
  color: { r: 0, g: 0, b: 0, a: 0 },
});

/**
 * Rasterise `source` at `size`, on transparent ground.
 *
 * The ground stays transparent here whatever is being drawn: the favicon family
 * wants it that way, and the installed family paints its own cream rect over the
 * whole box (`onPaper`), so there is nothing left for the page underneath to
 * show through.
 *
 * No padding is added at this level either. The mark fills a square viewBox, so
 * a square canvas is its own box — a favicon that pads itself is a favicon that
 * looks smaller than every other one in the tab strip — and the icons that *do*
 * want an inset carry it in their SVG, where the reason for it can be written
 * down next to the number.
 */
const rasterise = async (size: number, source = svg): Promise<Buffer> => {
  const { frameTree } = await inPage<{ frameTree: { frame: { id: string } } }>(
    "Page.getFrameTree",
  );
  await inPage("Emulation.setDeviceMetricsOverride", {
    width: size,
    height: size,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await inPage("Page.setDocumentContent", {
    frameId: frameTree.frame.id,
    html: `<html><body style="margin:0">${source.replace(
      "<svg",
      `<svg width="${size}" height="${size}" style="display:block"`,
    )}</body></html>`,
  });
  const { data } = await inPage<{ data: string }>("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
    captureBeyondViewport: true,
  });
  return Buffer.from(data, "base64");
};

for (const size of [192, 512]) {
  writeFileSync(join(publicDir, `logo${size}.png`), await rasterise(size));
}

/**
 * The installed family.
 *
 * `apple-touch-icon.png` is 180 because that is the one size an iPhone asks for
 * — iOS scales it down for the sizes it also wants and never up, so a single
 * 180 is the whole iOS story rather than the first of six files.
 *
 * The maskable pair matches the sizes of the transparent pair beside it in the
 * manifest, because a launcher chooses between `any` and `maskable` at the same
 * size and should not have to trade one property away for the other.
 */
writeFileSync(
  join(publicDir, "apple-touch-icon.png"),
  await rasterise(180, onPaper(APPLE_MARGIN)),
);
for (const size of [192, 512]) {
  writeFileSync(
    join(publicDir, `maskable${size}.png`),
    await rasterise(size, onPaper(MASKABLE_MARGIN)),
  );
}

/**
 * An .ico is a directory of images; every browser that still reads one reads a
 * PNG payload, so the entries are the PNGs above rather than bitmaps we would
 * have to encode ourselves.
 */
const icoSizes = [16, 32, 48];
const images = [];
for (const size of icoSizes) images.push(await rasterise(size));
const HEADER = 6;
const ENTRY = 16;
const header = Buffer.alloc(HEADER);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(images.length, 4);

let offset = HEADER + ENTRY * images.length;
const entries = images.map((png, i) => {
  const entry = Buffer.alloc(ENTRY);
  const size = icoSizes[i] as number;
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // palette size: none
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

writeFileSync(
  join(publicDir, "geotracks.ico"),
  Buffer.concat([header, ...entries, ...images]),
);

console.log(
  "Wrote logo.svg, logo192.png, logo512.png, geotracks.ico, " +
    "apple-touch-icon.png, maskable192.png and maskable512.png",
);

socket.close();
browser.kill();
