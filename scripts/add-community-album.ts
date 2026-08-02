/**
 * Accept a Suggestion: write one Community album into the database.
 *
 *   node scripts/add-community-album.ts [--live-from YYYY-MM-DD] [--dry-run]
 *   node scripts/add-community-album.ts <album-url-or-id> <ALPHA2> [...]
 *
 * With no album named, it lists the Suggestions waiting in the database and
 * accepts the one you pick. Naming an album and a country instead adds it by
 * hand, for an album nobody suggested. **This is a transcription tool, not a
 * gatekeeper** — nothing here can verify that the country makes sense, which is
 * what the human review step is for. Hand-copying fifteen track URLs per album
 * is the only reason it exists.
 *
 * **The album goes into the database, not into a file** (ADR-0007). Everything
 * here — the read and the write — goes through the Firebase CLI, logged in as
 * the project owner: the console's own privilege, with no admin SDK and no
 * service-account JSON on disk. Accepting is a single atomic multi-path update
 * that writes the album and deletes the Suggestion it came from, so the review
 * queue empties itself and there is no "reviewed" flag to keep in step.
 *
 * **The review screen can accept too now** (ADR-0008), so this is no longer the
 * only way in. It reaches Spotify's catalogue by a different door — the reviewer
 * signs in to their own Spotify account with PKCE, which needs no secret — and
 * it writes the same record, through the same shared rules in
 * `src/music/acceptance.ts`. This stays because it needs no Spotify sign-in and
 * no browser, and because `--live-from` and adding an album nobody suggested
 * both live here.
 *
 * Credentials come from `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` in the
 * gitignored `.env`. The **secret** must never be given a `VITE_` prefix, which
 * would publish it to every visitor; the id is a public client identifier and is
 * separately exposed as `VITE_SPOTIFY_CLIENT_ID` for the review screen. See the
 * warning in `.env.example`.
 *
 * Like the repo's other scripts, this runs under bare `node`, which strips
 * TypeScript's types but resolves imports as plain ESM — hence the explicit
 * `.ts` extension below, and hence `spotifyAlbum.ts` being import-free.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { extractAlbumId } from "../src/helpers/spotifyAlbum.ts";
// The rules the review screen also accepts by (ADR-0008): the `liveFrom`
// default, the URL cleaning, the duplicate check and the record's own shape.
// Import-free for the same reason `spotifyAlbum.ts` is.
import {
  cleanTrackUrl,
  communityAlbumFrom,
  heldTrack,
  nextDay,
} from "../src/music/acceptance.ts";
// Types only, so node erases the import outright and never resolves it — which
// is what lets this reach into `src/types.ts`, whose own imports it could not
// follow. The album shape is declared in exactly one place regardless.
import type { Album, CommunityAlbum } from "../src/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// `albums.json` is read from disk rather than through `src/music/library.ts`,
// which owns the bundled half everywhere else: that module imports the JSON as
// ESM, which under bare node would need an import attribute, and it pulls in the
// app's module graph behind it.
const readJSON = (path: string): unknown =>
  JSON.parse(readFileSync(join(root, path), "utf8"));

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- arguments

interface Args {
  /** The album and country named on the command line, or null to go and ask. */
  named: { album: string; code: string } | null;
  liveFrom: string | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let liveFrom: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--live-from") {
      i += 1;
      liveFrom = argv[i] ?? "";
    } else if (arg.startsWith("--live-from=")) {
      liveFrom = arg.slice("--live-from=".length);
    } else if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  const [album, code] = positional;
  // Nothing named is the ordinary path: go and read the Suggestions. One thing
  // named is a half-typed command, not a request for either.
  if (positional.length !== 0 && (!album || !code)) {
    fail(
      "Usage: node scripts/add-community-album.ts [<album-url-or-id> <ALPHA2>] " +
        "[--live-from YYYY-MM-DD] [--dry-run]",
    );
  }
  if (liveFrom !== null && !/^\d{4}-\d{2}-\d{2}$/.test(liveFrom)) {
    fail(`--live-from must be YYYY-MM-DD, got: ${liveFrom}`);
  }

  return {
    named: album && code ? { album, code: code.toUpperCase() } : null,
    liveFrom,
    dryRun,
  };
}

// ------------------------------------------------------------- credentials

/**
 * `.env` as a plain map, read here rather than through a dependency: this is
 * the only thing in the repo that needs it, and the file is three lines.
 * Anything already in the environment wins.
 */
function readEnvFile(): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(join(root, ".env"), "utf8");
  } catch {
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    values[match[1]!] = match[2]!.trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

/**
 * A bearer token via the client-credentials flow: no user login, nothing to
 * authorise, free. It reads public catalogue data and nothing else.
 */
async function getAccessToken(): Promise<string> {
  const env = { ...readEnvFile(), ...process.env };
  const id = env.SPOTIFY_CLIENT_ID;
  const secret = env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    fail(
      "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env (no VITE_ prefix — " +
        "that would publish the secret to every visitor). Create an app at " +
        "https://developer.spotify.com/dashboard.",
    );
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    fail(`Spotify refused the credentials (${response.status}).`);
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) fail("Spotify returned no access token.");
  return body.access_token;
}

// ----------------------------------------------------------------- Spotify

interface SpotifyTrack {
  id: string;
  external_urls?: { spotify?: string };
}

interface SpotifyAlbum {
  name: string;
  artists: { name: string }[];
  tracks: { items: SpotifyTrack[]; next: string | null };
}

async function get<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) fail(`Spotify has no such album: ${url}`);
  if (!response.ok) {
    fail(`Spotify request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

/**
 * The album's track URLs, in order, cleaned. All 785 Folkways albums use bare
 * `https://open.spotify.com/track/{id}` addresses, and the file must not develop
 * a second dialect: Spotify's own `external_urls` carry no `?si=`, but anything
 * that ever did is cut off here.
 */
async function fetchTracks(album: SpotifyAlbum, token: string) {
  const items = [...album.tracks.items];
  let next = album.tracks.next;
  while (next) {
    const page = await get<{ items: SpotifyTrack[]; next: string | null }>(
      next,
      token,
    );
    items.push(...page.items);
    next = page.next;
  }

  return items.map((track) =>
    cleanTrackUrl(
      track.external_urls?.spotify ??
        `https://open.spotify.com/track/${track.id}`,
    ),
  );
}

// ------------------------------------------------------------- suggestions

/** One `suggestions/{pushId}`, exactly as the form writes it. */
interface SuggestionRecord {
  albumId: string;
  countryCode: string;
  note?: string;
  uid: string;
  createdAt: number;
}

/**
 * Every Suggestion in the database, oldest first.
 *
 * Read through the **Firebase CLI**, which is already installed and already
 * logged in — `firebase deploy --only database` is how the rules making this
 * node write-only got there in the first place — and `.firebaserc` names the
 * project, so this needs no credential of its own: no admin SDK, no
 * service-account JSON on disk. The client cannot read `suggestions` and the
 * owner can, which is the entire review step.
 */
function firebaseCLI(args: string[], input?: string): string {
  try {
    return execFileSync("firebase", args, {
      cwd: root,
      encoding: "utf8",
      input,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    fail(
      "The Firebase CLI failed. Install it and log in:\n" +
        "  npm install -g firebase-tools && firebase login\n\n" +
        `  ${error instanceof Error ? error.message.split("\n")[0] : error}`,
    );
  }
}

/** One node, parsed. An empty node reads back as `null`, not as `{}`. */
function firebaseGet(path: string): unknown {
  return JSON.parse(firebaseCLI(["database:get", path]));
}

function readSuggestions(): { key: string; record: SuggestionRecord }[] {
  const parsed = firebaseGet("/suggestions") as Record<
    string,
    SuggestionRecord
  > | null;
  if (!parsed) return [];

  return Object.entries(parsed)
    .map(([key, record]) => ({ key, record }))
    .sort((a, b) => a.record.createdAt - b.record.createdAt);
}

// Firebase's own push-key alphabet: 64 characters in ASCII order, which is what
// makes the keys sort chronologically as plain strings. The app relies on that
// ordering — the daily seed draws by index into the Library, so every player is
// owed the same albums in the same sequence.
const PUSH_CHARS =
  "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

/**
 * A push key, generated here because a multi-path update has to name its paths
 * and so cannot use `push()`. Eight characters of timestamp followed by twelve
 * random ones; the real implementation also increments the random half when two
 * keys are made in the same millisecond, which this cannot be, being run once
 * per invocation by a human.
 */
function pushKey(now = Date.now()): string {
  let time = now;
  const stamp: string[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    stamp[i] = PUSH_CHARS[time % 64]!;
    time = Math.floor(time / 64);
  }

  let key = stamp.join("");
  for (let i = 0; i < 12; i += 1) {
    key += PUSH_CHARS[Math.floor(Math.random() * 64)]!;
  }
  return key;
}

/** Every accepted Community album, as the app reads them. */
function readCommunityAlbums(): Record<string, CommunityAlbum> {
  return (
    (firebaseGet("/communityAlbums") as Record<
      string,
      CommunityAlbum
    > | null) ?? {}
  );
}

/**
 * Accept, in one write: the album lands and the Suggestion it came from is
 * deleted.
 *
 * A **multi-path update from the root**, which RTDB applies atomically — so
 * there is no window in which the album exists and the Suggestion is still
 * queued, or the reverse. The key is generated here rather than by `push`
 * because the update has to name both paths at once, and RTDB push keys are
 * plain sortable strings: chronological, and the order the app relies on.
 */
function acceptIntoDatabase(
  key: string,
  album: CommunityAlbum,
  suggestion: string | null,
): void {
  const update: Record<string, unknown> = {
    [`/communityAlbums/${key}`]: album,
  };
  if (suggestion) update[`/suggestions/${suggestion}`] = null;

  firebaseCLI(["database:update", "/", "-"], JSON.stringify(update));
}

/**
 * A stranger typed the note, on a node that anyone may write to. Control
 * characters are stripped before it is printed, because a terminal takes escape
 * sequences as instructions and this one is about to show 500 characters of
 * somebody else's text.
 */
const plain = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/[\u0000-\u001f\u007f]/g, " ");

/**
 * List what is waiting, and ask which one to accept.
 *
 * There is no "already accepted" state to show: accepting deletes the Suggestion
 * in the same write that stores the album, so this list holds only what is still
 * undecided. Declining one deletes it too, from the review screen.
 */
async function pickSuggestion(
  countries: { code: string; name: string }[],
): Promise<{ album: string; code: string; suggestion: string }> {
  const suggestions = readSuggestions();
  if (suggestions.length === 0) fail("No Suggestions waiting.");

  const nameOf = (code: string) =>
    countries.find((entry) => entry.code === code)?.name ?? `unknown (${code})`;

  console.log("");
  suggestions.forEach(({ record }, index) => {
    const day = new Date(record.createdAt).toISOString().slice(0, 10);
    console.log(
      `  ${`${index + 1}`.padStart(2)}. ${nameOf(record.countryCode)} · ` +
        `${record.albumId} · ${day}`,
    );
    if (record.note) console.log(`      "${plain(record.note)}"`);
  });
  console.log("");

  if (!process.stdin.isTTY) {
    fail(
      "Not a terminal — name the album and the country as arguments instead.",
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("  Accept which? [number, or q] ")).trim();
  rl.close();

  if (answer === "" || answer.toLowerCase() === "q") {
    console.log("\n  Nothing accepted.\n");
    process.exit(0);
  }

  const chosen = suggestions[Number(answer) - 1];
  if (!chosen) fail(`Not one of the numbers above: ${answer}`);

  return {
    album: chosen.record.albumId,
    code: chosen.record.countryCode.toUpperCase(),
    suggestion: chosen.key,
  };
}

// -------------------------------------------------------------------- main

const args = parseArgs(process.argv.slice(2));

// The alpha-2 code is what a Suggestion stores; the Library joins by *name*, so
// the name is looked up here and written out. All 134 album countries match
// `countries.json` exactly, and that is worth keeping true.
const countries = readJSON("src/countries.json") as {
  code: string;
  name: string;
}[];
const folkways = readJSON("src/albums.json") as Album[];

// Either the album was named on the command line, or we go and read what has
// been suggested. Both arrive here as the same two strings, and everything
// below this line is the same work whichever it was.
const chosen = args.named
  ? { ...args.named, suggestion: null }
  : await pickSuggestion(countries);

const link = extractAlbumId(chosen.album);
if (!link.ok) {
  fail(
    link.reason === "track"
      ? `That is a track link, not an album: ${chosen.album}`
      : `Not a Spotify album link or id: ${chosen.album}`,
  );
}

const country = countries.find((entry) => entry.code === chosen.code);
if (!country) fail(`Not a country code in countries.json: ${chosen.code}`);

const token = await getAccessToken();
const album = await get<SpotifyAlbum>(
  `https://api.spotify.com/v1/albums/${link.albumId}`,
  token,
);
const tracks = await fetchTracks(album, token);
if (tracks.length === 0) fail("That album has no tracks.");

// Duplicates are caught by track URL, not by album id: `albums.json` stores
// tracks and holds no album ids at all. A track we already have means this is a
// re-submission of a record already in the Library — checked across both halves,
// the bundled file and what is already in the database.
const community = Object.values(readCommunityAlbums());
const duplicate = heldTrack(tracks, [...folkways, ...community]);
if (duplicate) {
  fail(
    `Already in the Library, as "${duplicate.albumName}" — matched on ${duplicate.track}.`,
  );
}

const entry: CommunityAlbum = communityAlbumFrom({
  country: country.name,
  albumName: album.name,
  tracks,
  liveFrom: args.liveFrom ?? nextDay(new Date()),
  // Only when it came from one, and kept as provenance rather than bookkeeping:
  // the Suggestion is deleted in the same write, so there is no queue left to
  // reconcile this against.
  suggestion: chosen.suggestion ?? undefined,
});

const artists = album.artists.map((artist) => artist.name).join(", ");
console.log(`\n  ${entry.album_name} — ${artists}`);
console.log(`  ${entry.country} · ${tracks.length} tracks`);
console.log(`  live in Explore and Infinite at once`);
console.log(`  live in Competition after ${entry.liveFrom}\n`);

if (args.dryRun) {
  console.log(JSON.stringify(entry, null, 2));
  console.log("\n  --dry-run: nothing written.\n");
} else {
  acceptIntoDatabase(pushKey(), entry, chosen.suggestion);
  console.log("  Written to communityAlbums. No deploy needed.");
  if (chosen.suggestion) {
    console.log("  The Suggestion it came from is gone from the queue.\n");
  } else {
    console.log("");
  }
}
