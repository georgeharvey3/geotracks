# A cut the embed will not play is swapped for another of its album

**Status:** accepted

On 17 September 2026 Competition was dead for the whole day, for everyone. The day's first Song —
track 4 of _Mariachi Music of Mexico (1954)_ — loaded into the Spotify embed, cleared the spinner,
showed a play button, and did nothing when it was pressed: no playback, no report, no error the app
could see. Infinite played normally, because Infinite draws a fresh random track each round and the
odds of landing on that one were 1 in 12,000. Competition draws the same seeded ten for every player
all day, so the mode was not flaky; it was closed.

The embed's own console said why: `No valid solution has been found to play this item`. Spotify's
embed plays a listener who is not signed in the track's **preview**, and a track that has no preview
in that listener's market loads to a working-looking player with nothing behind the button. The same
track plays perfectly in Spotify itself, where the listener is signed in — which is how "the track is
playable" and "nothing plays" were both true at once, and why the bug read as one game mode's.

## What was decided

**The round moves to another cut of the same album.** A Song is one track of an Album, and the
Album's country is what the player is guessing. Every other cut of that Album is therefore the same
question with a different recording, so the swap changes nothing the Run is owed: not the day's ten
(they are Albums, chosen by index), not the answer, not the scoring, not the leaderboard's meaning.
Two players may hear different cuts of _Mariachi Music of Mexico_ on the same day, and both are
being asked "Mexico?".

The walk is forward from the cut that refused, wrapping, skipping any already refused, until one
starts or the Album runs out. Running out is the Album's problem and not a track's — a whole record
missing from a market — and the panel then says so and leaves the guess standing: the map still
takes it, the round can still be finished, and nothing is silently forfeited.

**The signal is silence.** The IFrame API has `ready`, `playback_update` and `playback_started`, and
nothing for "cannot". A playable track answers a play request within the second, if only to say it
is buffering; an unplayable one answers with nothing, or with the same idle report it sent on load.
So `useSpotifyPlayer` starts a clock on every play request — button, keyboard, the replay after a
finished Clip — and stops it on the first sign of life, `!isPaused || isBuffering`. Three seconds
of nothing and the Song is reported as one the embed would not start, by link, so a verdict that
outlived its Song is dropped the way stale metadata is.

Three seconds is generous on purpose, and the cost of being wrong is small in both directions: too
short and a slow phone hears a different cut of the same record; too long and a player waits a
moment longer before the swap. Neither loses a turn.

**The verdict is not stored.** A reload of a Run in flight hands back the day's own cut from the
seed, and if the embed still refuses it the swap simply happens again. Adding the swapped link to the
day record would mean a new record version for a three-second cost paid only by a player who
reloads mid-turn on a day like this one.

**The swapped cut starts by itself.** The player already pressed play; what they pressed it for
changed underneath them through no fault of theirs. The game screen starts the new cut on ready, on
every device, and the panel says quietly why the Song changed. Explore needs none of this: it has a
queue, and a Song the embed will not start is skipped as a Song that ended would be.

## What was rejected

**Auditing the catalogue for previews.** Spotify's Web API no longer returns `preview_url` to
applications registered after November 2024, so the one source that could say in advance which of
12,111 tracks will play is closed, and availability is per market in any case. A list would be wrong
somewhere the day it was written.

**Skipping the turn.** A turn skipped is a Run of nine, on a leaderboard of tens. A turn scored zero
punishes the player for a licensing gap. Both would also have needed a new Turn outcome, in the Run
summary's rows and the map's fills. Another cut of the same Album needs neither.

**Waiting for the embed to say so.** It does not, and the error it throws is inside its own iframe,
where the app cannot hear it.

## What it touches

- `src/hooks/useSpotifyPlayer.ts` — the play watch and `unplayableLink`.
- `src/state/gameReducer.ts` — `library` kept whole beside the shrinking pool, `SONG_UNPLAYABLE`,
  and the round's `unplayableLinks` / `albumUnplayable`.
- `src/Components/GameScreen/GameScreen.tsx` — the dispatch, and the unasked play of the new cut.
- `src/Components/ExploreScreen/ExploreScreen.tsx` — the skip.
- `src/Components/ControlPanel/ControlPanel.tsx`, `PlayerControls.tsx` — what the player is told.
