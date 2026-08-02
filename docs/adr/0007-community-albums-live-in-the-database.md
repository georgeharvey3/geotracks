# Community albums live in the database; Folkways stays bundled

**Status:** accepted, with one conclusion overturned by
[ADR-0008](0008-suggestions-accepted-in-the-app-with-the-reviewers-spotify.md): "a click in the
review screen cannot accept an album" was right that the catalogue API needs a credential and wrong
that the credential has to be the app's. The reviewer's own Spotify account, via PKCE, needs no
secret — so accepting is now a button as well as a command, and `communityAlbums/` has the narrow,
create-only admin write branch this ADR says it has none of.

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

The tempting conclusion is that the whole Library should be a database. It should not, and the
numbers say so plainly. `src/albums.json` is 785 albums and 12,111 track URLs: **0.91 MB raw, 245 KB
gzipped**, bundled behind a content hash and cached indefinitely by the CDN. Read from RTDB instead,
that is ~0.9 MB fetched **per session**, uncached and metered against Spark's 10 GB/month — about
11,000 sessions before the free tier is spent, against effectively nothing today.

Three costs that are not about bytes. **Git stops being the source of truth** for a dataset
catalogued by hand into six spreadsheets over two years: no diff, no history, no revert, and no copy
in every clone — one mutable node behind one login. **Provenance stops being positional**: the
two-file split _is_ the Folkways record, and `Album` gains no `source` field deliberately, so one
table means adding exactly the field that was refused. And **`createInitialState` would have to
become async**, which is the synchronous heart of the reducer and of the Daily Run's resume path.

The half that changes is small, and the half that is large does not change. That is the whole basis
of the split — **size and mutability, not trust.**

## Competition draws from the database too

An earlier draft of this ADR kept Competition to the bundled files, on the grounds that a pool which
can change at any moment cannot be seeded from. That confused the property being protected with one
particular way of getting it.

What `getDailySongs` actually needs is narrow. It takes `rand() * available.length`, splices, and
repeats, so it depends on the pool's **length and order** — and `createInitialState` re-derives the
day's ten on every page load. The invariant is therefore:

> the effective Competition pool on date D is the same set, in the same order, for every player, and
> does not change after date D begins.

A file satisfies that by being immutable between deploys. **A database satisfies it just as well**,
by two things it already has. `liveFrom` lives in the record and gates the set by date exactly as it
does in a file — an album is accepted into Explore and Infinite immediately and joins Competition
only once every player has crossed its date at their own local midnight. And RTDB children come back
ordered by key, with push keys chronological and lexicographically sortable, so the order is
deterministic without anything being stored to make it so. Bundled albums first, live albums after,
sorted by key.

So `liveFrom` stays, in the record rather than in a file, defaulted by the accept script to tomorrow
as it is today. **Promotion is not needed for Competition eligibility**, and with it goes the last
reason for `src/community-albums.json` to exist at all. The file is deleted rather than kept as an
archive: a copy nothing reads is a copy nobody notices going stale, and it would have reintroduced
the two-sources-of-truth problem the split was supposed to end.

The discipline this demands is real and should be written down rather than assumed: **an album whose
`liveFrom` has passed is frozen.** Editing or deleting one changes the pool's length and order for
anybody who loads after the change, and silently gives them a different day. This is the same
discipline that already applies to deploying a Folkways edit mid-day, which is an accepted risk
today; the difference is that a database makes it one command instead of a release, so it wants
saying out loud.

## The cost that is real: a failed read is a wrong Run

This is the one genuine objection to the paragraph above, and it is not the one the earlier draft
made.

Everything bundled cannot be half-loaded. A network read can. If the community half fails to arrive
for one player, that player seeds Competition from a **shorter pool**, gets a different ten, plays
them, and submits the score to the same leaderboard as everyone else. Nothing anywhere would look
wrong. That is silent corruption of precisely the thing the daily seed exists to provide.

So Competition **fails closed** on this read, which is the opposite of how the Daily Run's stored
record behaves and deliberately so. A day record that will not parse hands the player a fresh Run,
because a serialization bug of ours must not be indistinguishable from a punishment. Here the harm
runs the other way: a Run played on the wrong pool is worse than a Run not started, because it is
counted. Competition does not open until the album read has resolved, and says so if it cannot.

That is a new loading state and not a new dependency: the app is already useless without the network
— it streams from Spotify and reads the leaderboard over the same connection. A player who cannot
reach the database cannot hear a Song either.

**Explore and Infinite fail soft**, and keep the behaviour the earlier draft described: Folkways is
bundled, so an unreachable database costs them their Community albums and costs them nothing else.
Neither is compared between players, so neither has anything to corrupt.

## Where things live

- **`src/albums.json` — Folkways.** Bundled. 0.91 MB, static, the provenance record.
- **`communityAlbums/` in RTDB — every accepted Community album.** Live in Explore and Infinite at
  once; in Competition from its own `liveFrom`. The only copy there is.

`src/community-albums.json` is **deleted**. Provenance stays positional in the sense that matters —
Folkways is the bundled file and nothing else is — but it is now a boundary between a file and a
node rather than between two files.

**The accept script writes to the database instead of a file**, through the Firebase CLI it already
reads through — owner privilege, no admin SDK, no service-account JSON on disk. It stays a terminal
command, and it has to: accepting needs the album's full track list, which comes from Spotify's
catalogue API, which needs the client secret. oEmbed gives a title and a cover and no tracks. **A
click in the review screen cannot accept an album** without a paid Cloud Function to hold that
secret, and this is the reason — not squeamishness about browsers writing to databases.

Accept becomes one atomic multi-path `update()`: write the album, delete the Suggestion it came from.
The review queue then empties itself, and `acceptedSuggestionKeys` and the "already accepted" marker
in both listings stop having a job — an accepted Suggestion is simply gone. The key is still recorded
on the album, now as provenance rather than as bookkeeping.

`communityAlbums/` gets `.read: true` — it is app content, like `scores`, and holds nothing a
stranger could not see by using the app. It gets **no client write at all**: it inherits `false` from
the root, and the owner's CLI bypasses rules, so unlike `suggestions` there is not even an admin
branch. The one destructive thing the review screen can do stays what ADR-0006 gave it: deleting a
Suggestion.

## Consequences

`competitionAlbums(albums, today)` keeps its job and its signature, and now filters a Library that is
part bundled and part live. `src/music/library.ts` gains that union, and `library` stops being a
constant — the reducers already take albums as a parameter, so the seam exists. A new hook,
`useCommunityAlbums`, joins the others in `src/hooks/` with a fake beside `leaderboardFake`; it is
the fourth RTDB seam and the second read-only one.

**The menu grows a gate it did not have.** Competition cannot open until the read resolves, so the
three-state Daily Run button gains a fourth, disabled state, and the failure needs wording that
distinguishes "not yet" from "not today". Explore and Infinite stay openable throughout. Live albums
arrive by an action that **tops up** the pools, which is safe rather than merely convenient: an album
that has just arrived cannot already have been drawn, so appending it to Infinite's shrinking pool
cannot resurrect a Song a session has already played. Explore's Country queues are built per country
on first selection, so a country becoming Playable later needs nothing.

The accept script's `--dry-run` prints what it would write to the database rather than to a file, and
it keeps its duplicate check by track URL across both sources.

**Community albums have no copy in git, and this is the real cost of the whole ADR.** One mutable
node behind one login is the entire catalogue: no diff, no history, no revert, and nothing in a clone
to restore from. An accidental delete is unrecoverable, and the freeze discipline above is then the
only thing standing between a careless edit and a day whose Songs quietly disagree between players. A
scheduled `firebase database:get` kept somewhere outside the repo is the mitigation, and it is worth
having **before** this ships rather than after; nothing in the codebase can enforce it.

The 1 GB Spark storage cap is not a concern at this size. The 10 GB/month transfer cap is what would
eventually bite, and keeping the 0.9 MB Folkways half bundled is what holds it far away.
