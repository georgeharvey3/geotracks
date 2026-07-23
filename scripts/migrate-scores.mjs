#!/usr/bin/env node
// One-off migration: convert the legacy leaderboard shape
//   scores/{name: score}            e.g. scores/Alice = 150
// into the append-only push-ID shape the hardened app + rules expect
//   scores/{pushId: { name, score, createdAt }}
//
// `createdAt` is backfilled (there is no original timestamp) with a fixed
// migration epoch so ordering stays stable and the value is a real number.
//
// Run this WHILE the database is still world-writable — i.e. BEFORE deploying
// the strict rules in `database.rules.json`, which reject the legacy shape.
// It uses the RTDB REST API (no service account needed) and is idempotent:
// once legacy scalar entries are gone, re-running is a no-op.
//
// Usage:
//   node scripts/migrate-scores.mjs            # dry run — prints the plan
//   node scripts/migrate-scores.mjs --apply    # perform the migration
//
// Database URL resolution: $VITE_FIREBASE_DB_URL, else --db=<url>, else the
// known public database.

const FALLBACK_DB_URL =
  "https://geotracks-d9b5c-default-rtdb.europe-west1.firebasedatabase.app";

// Timestamp stamped on every backfilled record: 2020-01-01T00:00:00Z. A fixed
// past date makes clear these predate real submissions.
const BACKFILL_CREATED_AT = Date.UTC(2020, 0, 1);

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dbArg = args.find((a) => a.startsWith("--db="))?.slice("--db=".length);
const dbUrl = (
  process.env.VITE_FIREBASE_DB_URL ||
  dbArg ||
  FALLBACK_DB_URL
).replace(/\/$/, "");

const scoresUrl = `${dbUrl}/scores.json`;

async function main() {
  console.log(`Reading ${scoresUrl}`);
  const res = await fetch(scoresUrl);
  if (!res.ok) {
    throw new Error(`GET failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) ?? {};

  const legacy = Object.entries(data).filter(
    // Legacy entries are `name -> number`; already-migrated records are objects.
    ([, value]) => typeof value === "number",
  );

  if (legacy.length === 0) {
    console.log(
      "No legacy `{name: score}` entries found — nothing to migrate.",
    );
    return;
  }

  console.log(
    `Found ${legacy.length} legacy entr${legacy.length === 1 ? "y" : "ies"}:`,
  );
  for (const [name, score] of legacy) {
    console.log(`  ${name} = ${score}`);
  }

  if (!apply) {
    console.log(
      "\nDry run. Re-run with --apply to push these as records and delete the legacy keys.",
    );
    return;
  }

  for (const [name, score] of legacy) {
    const record = { name, score, createdAt: BACKFILL_CREATED_AT };
    const postRes = await fetch(scoresUrl, {
      method: "POST",
      body: JSON.stringify(record),
    });
    if (!postRes.ok) {
      throw new Error(`POST failed for ${name}: ${postRes.status}`);
    }
    const { name: pushId } = await postRes.json();
    console.log(`  migrated ${name} -> scores/${pushId}`);

    // Remove the legacy scalar key now that the record exists.
    const delRes = await fetch(
      `${dbUrl}/scores/${encodeURIComponent(name)}.json`,
      { method: "DELETE" },
    );
    if (!delRes.ok) {
      throw new Error(`DELETE failed for ${name}: ${delRes.status}`);
    }
  }

  console.log(
    `\nMigrated ${legacy.length} record(s). Now deploy the strict rules: firebase deploy --only database`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
