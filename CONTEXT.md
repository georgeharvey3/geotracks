# GeoTracks

A music-geography app built on one world map. In the game, players hear a Clip and name the country the music comes from; in Explore, they choose a country and listen to it. This glossary pins the ubiquitous language of both.

## Language

### Music

**Song**:
One recording a player hears, together with the country and the Album it comes from.
_Avoid_: Track, tune.

**Album**:
A record the app holds for one country, and the unit its music is catalogued in. A country may have many; a Song belongs to exactly one.
_Avoid_: Record, release.

**Clip**:
The capped excerpt of a Song heard during a round — long enough to place the music, short enough to keep the round moving. Explore is not a round and plays the whole Song.
_Avoid_: Snippet.

**Game mode**:
One of the two scored ways to play the game: Competition (a fixed number of turns ending in a submittable score) or Infinite (rounds without end). Explore is not a Game mode.

### Guessing

**Guess**:
A single named-country answer a player commits for the current song. Carries whether it was correct and, when geo-hints are on, the distance and compass direction to the correct country.

**Attempt**:
One of the (up to five) guesses a player may commit for a song before the round ends. Score decreases with each attempt used.

**Answer**:
The one correct country for the current song.
_Avoid_: Solution.

**Geo-hint**:
Feedback shown after an incorrect guess: how far (km) and in which compass direction the answer lies from the guessed country. Enabling it halves that round's score.

### The end of a Competition

**Run**:
One playthrough of Competition — the fixed set of turns from the first Song to the Run summary. Infinite has no Run: with no end, there is nothing to summarise.
_Avoid_: Test, session, game (a session may hold several Runs); attempt (an Attempt is one guess within a round, not a playthrough).

**Daily Run**:
The single Competition Run a browser profile may play on a given calendar day. It is spent the moment the player starts it, not when they finish it; left unfinished, it is resumed where it stood rather than restarted; once complete, it is seen again as its Run summary. It rolls over at device-local midnight, together with the day's seeded Songs.
_Avoid_: Daily challenge, daily attempt, one attempt per day.

**Daily Songs**:
The day's ten seeded Songs, the same for everyone who plays that calendar day, and the reason two Daily Run scores can be compared at all. They are the Daily Run's and no one else's: Infinite and the Song the menu opens on are drawn at random beside them, so nothing outside Competition can hand a player the day's answers early or spend one of its Songs.
_Avoid_: The daily set, today's playlist, the seed (the seed is what produces them).

**Turn result**:
What a Run keeps about one finished turn: the Song as it was heard, the Turn outcome, how many attempts it took, the points it contributed, and whether geo-hints were on. The turn's individual Guesses are _not_ kept — how the player got there stops mattering once the turn is over.

**Turn outcome**:
How a turn ended, in three states: the answer named on the first attempt, named on a later attempt, or missed. The one distinction both the Run summary's rows and its Map marking are drawn in.

**Run summary**:
The screen a completed Run ends on, and the only place a Run is ever seen whole: the score, each Turn result, the Map showing where the Run's music came from, and the one chance to put the score on the leaderboard. It answers two questions at once — how the player did, and _what that Song was_ — because a player who has just heard ten countries' music has earned the names of all ten. It outlives the session that produced it: once a Daily Run is complete, its summary is that Run's face until midnight.
_Avoid_: Scorecard, results screen (half its job is a music recap, not a report card).

### Map interface

**Map**:
The interactive world map: the app's primary surface for choosing a country, whether that choice is a Guess or a country to listen to in Explore. The Map itself knows only how a country is picked — what the choice _means_, which countries may be picked, and how they are marked afterwards belong to the surface using it.
_Avoid_: Globe (the map is a flat projection, not a globe).

**Unified board**:
The Map's role during a round: it reflects _every_ Guess of the round regardless of which input committed it, so a typed Guess marks its country on the Map too. Both inputs feed the same single guess pipeline.

**Answer reveal**:
What the Map shows when a round ends. On a correct guess the answered country gets a success fill; on exhausting all attempts the _answer_ country is highlighted (the spatial twin of the existing "Answer was: X" text). The Map then goes non-interactive until the next song.

**Country polygon**:
The clickable, hoverable filled shape of one country on the Map. Distinct from a country's _centroid_ (the single lat/lon point already used for distance/bearing maths).

**Commit-on-click**:
The Map's interaction rule: choosing a country directly from the Map, with no separate confirm button.

- **Pointer (mouse):** hover shows the country-name tooltip; a single click chooses immediately, on every surface.
- **Touch:** the guard scales to what a mistake costs. A Guess is irreversible, so the first tap _arms_ a country (highlights it, shows its name label) and a second tap on the same country commits; tapping elsewhere just moves the preview. Choosing a country in Explore costs nothing but the Song now playing, so a single tap is enough.

Applies equally to polygons and point-markers.

**Point-marker**:
A small clickable dot placed at a country's centroid, used for a _straggler_ — a country too small (or absent from the polygon set) to offer a usable clickable polygon. Behaves identically to a polygon: hover tooltip + commit-on-click. Guarantees every country is clickable, keeping map/text parity.

**Straggler**:
A country with no comfortably clickable polygon at the chosen map resolution (mostly micro-states and tiny island nations). Represented on the Map by a point-marker instead of a polygon.

**Proximity heat**:
The colour scale applied to a wrongly-guessed country on the Map — yellow = geographically close to the answer, deepening through orange to red as it gets further — accompanied by a directional arrow (along the bearing to the answer) and a km label. The map counterpart of the text geo-hint; shows the same information, never more.

**Wrong fill**:
The persistent marking left on a country once it has been guessed and found incorrect (a guessing-surface marking; the Map itself carries no such state). With geo-hints **on** it is proximity heat + arrow + km; with geo-hints **off** it is a single flat desaturated red — the same for every wrong guess, with no arrow or distance — so the Map marks the country as tried without leaking proximity the player opted out of. Persists across all attempts of the round, so the Map accumulates the player's guess history.

### Explore

**Explore**:
The surface where a player chooses a country in order to listen to it, rather than being asked to name one. Nothing is scored, there are no rounds and no Guesses — the only thing a player can be wrong about is what they feel like hearing.
_Avoid_: Explore mode (it is not a Game mode), free play, jukebox.

**Playable country**:
A country the app holds at least one Album for, and so one a player may choose in Explore. The rest are non-playable: still drawn on the Map and still named on hover, but not selectable — an absence of music is not an absence of geography.
_Avoid_: Unlocked, available, greyed-out, disabled.

**Country queue**:
The order a Playable country's Songs are heard in: drawn afresh, and exhausted before any Song repeats. A player who leaves a country and comes back picks up where they left off rather than starting the country over.
_Avoid_: Playlist, station.

**Skip**:
Moving to the next Song of the country being listened to, without waiting for the present one to end. Distinct from the game's _next song_, which ends a round rather than moving within a country.
