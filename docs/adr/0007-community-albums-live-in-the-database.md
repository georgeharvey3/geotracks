# Community albums live in the database; Folkways stays bundled

**Status:** proposed

**Supersedes** ADR-0005's "no notion of the Library updating without a deploy", and the parts of
[ADR-0005](0005-suggestions-collected-in-the-app-and-accepted-by-a-commit.md) and
[ADR-0006](0006-suggestions-reviewed-in-app-behind-a-google-account.md) that say the accept script
never writes to the database. What survives from both, and is the reason this is a small change
rather than a rewrite: **the Smithsonian Folkways half is a static asset and stays one.**

## The problem is the release, not the file

Accepting a Suggestion today is a commit, a PR into `develop`, a release merge into `main` and a
Pages deploy. The clerical work is already gone — the script lists the waiting Suggestions and writes
the album — so what is left is purely the **shipping**, and shipping is the expensive part. An album
somebody suggested waits on a release it has nothing to do with.

The tempting conclusion is that the Library should be a database. It should not, and the numbers say
so plainly. `src/albums.json` is 785 albums and 12,111 track URLs: **0.91 MB raw, 245 KB gzipped**,
bundled behind a content hash and cached indefinitely by the CDN. Read from RTDB instead, that is
~0.9 MB fetched **per session**, uncached and metered against Spark's 10 GB/month — about 11,000
sessions before the free tier is spent, against effectively nothing today.

Three costs that are not about bytes. **Git stops being the source of truth** for a dataset
catalogued by hand into six spreadsheets over two years: no diff, no history, no revert, and no copy
in every clone — one mutable node behind one login. **Provenance stops being positional**: the
two-file split _is_ the Folkways record, and `Album` gains no `source` field deliberately, so one
table means adding exactly the field that was refused. And **`createInitialState` would have to
become async**, which is the synchronous heart of the reducer and of the Daily Run's resume path.

## The split follows the shape of the data

The half that changes is small and the half that is large does not change. So:

- **`src/albums.json` — Folkways.** Bundled. 0.91 MB, static, and the provenance record.
- **`src/community-albums.json` — promoted Community albums.** Bundled. Small, and the half of the
  community catalogue that Competition may draw from.
- **`communityAlbums/` in RTDB — accepted, not yet promoted.** Live in Explore and Infinite from the
  moment they are accepted, without a deploy.

**The accept script writes to the database instead of a file**, through the Firebase CLI it already
reads through — owner privilege, no admin SDK, no service-account JSON on disk. It stays a terminal
command, and it has to: accepting needs the album's full track list, which comes from Spotify's
catalogue API, which needs the client secret. oEmbed gives a title and a cover and no tracks. **A
click in the review screen cannot accept an album** without a paid Cloud Function to hold that
secret, and this is the reason — not squeamishness about browsers writing to databases.

Accept becomes one atomic multi-path `update()`: write the album, delete the Suggestion it came from.
The review queue then empties itself, and `acceptedSuggestionKeys` and the `suggestion` marker in the
listing both stop having a job — an accepted Suggestion is simply gone. The key is still recorded on
the album, now as provenance rather than as bookkeeping.

## `liveFrom` survives, and it was wrong to say otherwise

Competition draws **only from the bundled files**, so nothing arriving from the database can move the
daily seed. That is the property that matters: `getDailySongs` draws by array index and
`createInitialState` re-derives the day's ten on every page load, so a pool that can change at any
moment would hand two players on the same day different Daily Songs onto the same leaderboard, and
hand a player resuming an unfinished Run six turns from a sequence their first four were never part
of.

It is tempting to conclude that `liveFrom` can then be deleted. It cannot, and this ADR exists partly
to say so before somebody removes it. **Promotion** — moving an album out of the database and into
`community-albums.json` — still changes the Competition pool, and still lands by a deploy that can
happen at any hour. Comparability across players on a given day requires every one of them to be
holding the same pool that day, and only a date gate gives that. Storing the day's ten in the Daily
Run record would protect a player mid-Run but would not make two players' days agree.

What changes is its **granularity**: `liveFrom` is authored once per promotion batch, at a release,
instead of once per accepted album. The per-Suggestion friction — the question "what date should this
be?" asked every single time — is what goes away.

The alternative considered and rejected was that Community albums **never** reach Competition, which
would delete `liveFrom` outright and leave Competition as the Folkways canon. It is coherent, and it
was rejected because a contributor's album never appearing in the game proper is a poor answer to
somebody who took the trouble to suggest one.

## Reading it

`communityAlbums/` gets `.read: true` — it is app content, like `scores`, and there is nothing in it
a stranger could not see by using the app. It gets **no client write at all**: it inherits `false`
from the root, and the owner's CLI bypasses rules, so unlike `suggestions` there is not even an admin
branch. The one destructive thing the review screen can do stays what ADR-0006 gave it: deleting a
Suggestion.

**The read fails soft.** Folkways is bundled, so an unreachable database costs Explore and Infinite
their Community albums and costs Competition, the Daily Run and the whole game nothing. The app
renders on the bundled Library immediately rather than waiting.

Live albums arrive by an action that **tops up** the pools. This is safe rather than merely
convenient: an album that has just arrived cannot already have been drawn, so appending it to
Infinite's shrinking pool cannot resurrect a Song a session has already played. Explore's Country
queues are built per country on first selection, so a country becoming Playable later needs nothing
at all.

## Consequences

`competitionAlbums(library, today)` stops taking the whole Library and takes the bundled files, which
is what it was always really asking for. `src/music/library.ts` gains the union of bundled and live,
and `library` stops being a constant — the reducers already take albums as a parameter, so the seam
exists. A new hook, `useCommunityAlbums`, joins the others in `src/hooks/`, with a fake beside
`leaderboardFake`; it is the fourth RTDB seam and the second read-only one.

The accept script gains a `--dry-run` that prints what it would write to the database rather than to
a file, keeps its duplicate check by track URL across all three sources, and loses its `liveFrom`
default. A **promote** script is new work and is not in this ADR — until it exists, promotion is a
hand edit of `community-albums.json` and a delete from the node, which is acceptable at the volume
this catalogue grows.

**Community albums lose git history.** Each is re-derivable from the Suggestion that produced it
until that Suggestion is deleted, and after promotion it is in a file again — but between those two
points the only copy is one mutable node. A periodic `firebase database:get` committed as a backup is
the cheap mitigation and is worth doing before this ships. The 1 GB Spark storage cap is not a
concern at this size; the 10 GB/month transfer cap is what would eventually bite, and the bundled
Folkways half is what keeps it far away.
