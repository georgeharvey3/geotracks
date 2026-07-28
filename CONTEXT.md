# GeoTracks

A music-geography guessing game: players hear a Spotify clip and name the country the music comes from. This glossary pins the ubiquitous language of the game and its new map interface (issue #2).

## Language

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

### Map interface

**Map**:
The interactive world map through which a player can commit a guess by clicking a country, as an alternative to typing its name. Both paths feed the same single guess pipeline, and the Map is a **unified board**: it reflects _every_ guess of the round regardless of which input committed it (a typed guess marks its country on the Map too).
_Avoid_: Globe (the map is a flat projection, not a globe).

**Answer reveal**:
What the Map shows when a round ends. On a correct guess the answered country gets a success fill; on exhausting all attempts the _answer_ country is highlighted (the spatial twin of the existing "Answer was: X" text). The Map then goes non-interactive until the next song.

**Country polygon**:
The clickable, hoverable filled shape of one country on the Map. Distinct from a country's _centroid_ (the single lat/lon point already used for distance/bearing maths).

**Commit-on-click**:
The Map's interaction rule: committing a guess directly from a country, with no separate confirm button. It adapts to the input device so the "see the name, then commit" guard always holds:

- **Pointer (mouse):** hover shows the country-name tooltip; a single click commits immediately.
- **Touch:** the first tap _arms_ a country (highlights it, shows its name label); a second tap on the same armed country commits; tapping a different country just moves the preview.

Applies equally to polygons and point-markers.

**Point-marker**:
A small clickable dot placed at a country's centroid, used for a _straggler_ — a country too small (or absent from the polygon set) to offer a usable clickable polygon. Behaves identically to a polygon: hover tooltip + commit-on-click. Guarantees every country is clickable, keeping map/text parity.

**Straggler**:
A country with no comfortably clickable polygon at the chosen map resolution (mostly micro-states and tiny island nations). Represented on the Map by a point-marker instead of a polygon.

**Proximity heat**:
The colour scale applied to a wrongly-guessed country on the Map — yellow = geographically close to the answer, deepening through orange to red as it gets further — accompanied by a directional arrow (along the bearing to the answer) and a km label. The map counterpart of the text geo-hint; shows the same information, never more.

**Wrong fill**:
The persistent marking left on a country once it has been guessed and found incorrect. With geo-hints **on** it is proximity heat + arrow + km; with geo-hints **off** it is a single flat desaturated red — the same for every wrong guess, with no arrow or distance — so the Map marks the country as tried without leaking proximity the player opted out of. Persists across all attempts of the round, so the Map accumulates the player's guess history.
