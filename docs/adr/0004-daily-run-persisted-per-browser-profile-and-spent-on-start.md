# The Daily Run is persisted per browser profile and spent on start

**Status:** accepted

Competition should be playable once a day, so that the day's seeded ten Songs mean the same thing for
everyone who plays them (issue #1). Every answer below reads as arbitrary from the outside, and each
had a live alternative, so they are recorded together. This also introduces the app's first device
storage — there was none anywhere in `src/` before it.

**Starting a Run spends the day, and an unfinished Run resumes.** The kinder rule — the day is spent
when the Run is _finished_ — is not a rule at all here. State is rebuilt from `createInitialState` on
every load and the song seed is the calendar date, so a reload hands the player the same ten Songs
from turn 1 again: play three turns, meet a country you don't know, reload, and today is replayable
indefinitely with foreknowledge. Spending the day on start is the only version a reload cannot
rewind. Its cost — that a mis-tap or a backgrounded tab would otherwise destroy the day's play — is
paid off by resuming rather than forfeiting, which is why the two are one decision and not two. The
resumed state must include the **current round in flight** (guesses so far, geo-hints, whether it is
finished), not just completed turns: restoring to a clean turn boundary would let two wrong guesses
plus a reload buy a fresh 150-point first attempt, rebuilding the exploit one turn at a time.

**The day is device-local, matching the seed.** `getDateSeed()` reads `new Date()`'s local
year/month/day, so today's Songs already change at local midnight. A UTC lockout would tear the two
apart — a player at UTC+13 would be shown a new ten and locked out of it for thirteen hours. Moving
_both_ to UTC is coherent and was rejected: it changes when the Songs change for everyone currently
playing, in order to defend against timezone-hopping, which is strictly more effort than clearing
site data and therefore not the weak link. Any date mismatch unlocks, including a stored date in the
_future_; refusing to unlock until the stored date is strictly past would permanently brick the mode
for anyone whose clock was briefly wrong, which is a worse failure than a determined cheat
succeeding.

**It is a ritual, not an enforcement mechanism, and nothing server-side backs it.** Clearing site
data resets it, a private window resets it, and a second browser profile on the same machine is a
second "device" — which is why CONTEXT.md says browser profile and not device. The obvious
server-side move, keying the day by the Firebase anonymous UID we already mint and making it
create-only in the rules, buys almost nothing: **that UID also lives in `localStorage`**, so the same
clear wipes the identity we would be enforcing against. It would raise the bar from "clear site data"
to "clear site data", at the price of a rules change, a per-day score path and a migration. Nothing
should be built on this limit that needs it to be true — a _daily leaderboard_ in particular is a
different feature with a different data shape, and the existing all-time board is untouched.

**What is stored is a narrow versioned day record, not a snapshot of `GameState`.** Stored data is a
contract with the past and cannot be redeployed away, whereas `GameState` is refactored freely;
`JSON.stringify(state)` would mean any renamed field silently invalidates every device holding
yesterday's record. The record holds the date, status, turn index, score, daily song index, whether
the score was submitted, the completed Turn results and the round in flight — with explicit mapping
functions either way, so a field that matters to persistence cannot be changed without walking past
them. Derived data stays out: the album pool is not stored, because the daily song index re-derives
the Run's sequence. The one derived-looking exception is the **Song metadata inside the Turn
results** (title, artist, thumbnail), which is fetched from oEmbed at play time; dropping it would
make every reopened summary read "Unknown Track" until ten network calls land, and never recover
offline. A record that fails to parse, or carries an unrecognised version, is **discarded and the
player gets a fresh Run** — failing open, because a serialization bug of ours should not be
indistinguishable from a punishment, and failing closed means one bad deploy locks the whole
userbase out of the mode with no recourse.

**Consequences.** The Run summary now outlives its session, which retires the "lives only as long as
the player stays on it" line in CONTEXT.md and in CLAUDE.md; `scoreSubmitted` therefore has to be
part of the record, or reopening a finished summary offers the name box again and puts one score on
the append-only leaderboard repeatedly. A player who closed the tab before submitting can still
submit on return. The menu's Competition button gains three states — start, resume, view today's Run
— which is why the reducer gains three named actions rather than branching inside `SET_MODE`, and
why a resumed Run arrives as an _action carrying a record_ rather than through `createInitialState`:
the player always lands on the menu, so all the menu needs is the day's status, and no
Explore-only or Infinite-only player should have a storage read on their path. The reducer stays
pure; the `localStorage` touch lives in a hook beside `useLeaderboard`, over a pure module that takes
the date as an argument. Tests use jsdom's real `localStorage` (cleared in `beforeEach` — load-bearing
in `App.test.tsx`, which plays a Run to completion) and fake the clock instead; because
`vi.setSystemTime` moves the seed as well, no test may assert which Songs a given day yields. There
is deliberately **no reset query parameter or debug button** — a shipped bypass is discoverable and
shareable, and clearing one key in the Application tab costs a developer a click.
