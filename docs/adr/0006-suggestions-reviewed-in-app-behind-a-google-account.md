# Suggestions are reviewed in the app, behind a Google account

**Status:** accepted

**Supersedes** the parts of [ADR-0005](0005-suggestions-collected-in-the-app-and-accepted-by-a-commit.md)
that put "any in-app review or moderation UI" out of scope, and its statement that the Firebase
console is the only reader of `suggestions`. Everything else in 0005 stands, and the most important
thing in it is untouched: **accepting a Suggestion is still a commit.**

**The problem is judging an album, not fetching one.** `scripts/add-community-album.ts` already
lists the waiting Suggestions and accepts the one you pick, so the clerical work is gone. What a
terminal cannot do is show you the record — the artwork, who is on it, what it actually sounds like
— and deciding whether an album belongs in a music app on the strength of a 22-character id is not
deciding. A page can show it. That is the whole of why this exists.

**The gate is an account, not a token.** The obvious design — a password in `.env`, checked by the
page — cannot work here and would be worse than nothing for looking like it did. This is a static
Vite build on GitHub Pages: there is no server, so any value the bundle compares against is a value
every visitor has already downloaded. Vite injects every `VITE_*` variable into the client bundle,
which is the exact hazard `.env.example` already carries a warning about for the Spotify secret;
without the prefix the client cannot read it at all and the check is a no-op. So the credential is
one Firebase does not make us hold: **Google sign-in**, with `database.rules.json` naming the single
uid allowed to read `suggestions`. The secret is a Google password, kept by Google.

Three things follow, and they are the point rather than side effects. The uid is **committed in a
public repo**, because a uid is not a secret — knowing it does not let you become it. The screen
**ships to every visitor** and is simply empty for anyone else who finds it, so there is nothing to
hide and no build-time exclusion to get wrong. And **nothing in `src/` knows which uid is allowed**:
`useAdmin` subscribes and finds out, and its `denied` state is what `PERMISSION_DENIED` is called on
the way back. A uid compiled into the bundle would have to be kept in step with the copy that
actually decides; there is one copy.

Legacy Firebase **database secrets** were rejected outright. They still exist, and they grant full
admin read/write to the entire database through a query parameter — in a client bundle that is the
leaderboard handed to every visitor to delete. **Custom claims** (`auth.token.admin`) are the
textbook answer and were also rejected: minting one needs the Admin SDK, which needs a
service-account JSON on disk, which is the thing this whole design has kept off the machine. A
hardcoded uid in the rules reaches the same place with nothing to protect.

**Reject is a delete; accept is a clipboard.** These are not symmetrical and should not look it.
Rejecting is the one destructive write in the app, and it exists because ADR-0005 left a declined
Suggestion with nowhere to be recorded — it would sit in the queue for ever. It needs a **second**
`.write` branch on `suggestions/$id` for the admin uid; the players' create-only branch
(`auth != null && !data.exists()`) is untouched, so nothing a player can do has changed. Accepting
writes a file into the repo and ends in a commit, which no page on the internet gets to do, so the
button **copies the command** and the terminal does the rest. It takes two clicks to reject, armed
then committed, rather than a confirmation dialog: the app has no `Dialog`, `Modal` or `Snackbar`
anywhere, `design.md` is locked, and this is the shape the map already uses on touch to protect a
Guess.

**Album metadata comes from oEmbed.** The row needs a title and a cover, and the catalogue API needs
the Spotify client secret — the one thing in this repo that must never reach a browser. Spotify's
oEmbed endpoint is public, takes no credentials, and is already what `useSpotifyPlayer` reads a
Song's metadata from. A row whose album will not resolve keeps its country, its note and its link,
which is enough to judge it by.

**The screen is reached by `#admin` and by nothing else.** No menu button, no link, no control
anywhere in the app leads to it. This is the app's only piece of URL awareness — a bookmark, not
routing, read once at mount — and it is a **convenience, not a boundary**: the hash is guessable and
is meant to be irrelevant, because the rules are what decide. Leaving the screen clears the hash so a
reload lands on the menu.

**Consequences.** `Screen` gains a seventh value and the game reducer a `SHOW_ADMIN`, keeping
ADR-0003's single-router rule. `CommunityAlbum` gains `suggestion?`, the accepted push key — the only
field in the app nothing in `src/` reads for its own sake, and the only record of what has been dealt
with, since the database is still never written back to for that purpose. `src/music/library.ts`
gains `acceptedSuggestionKeys` so the screen asks the Library "have I dealt with this?" rather than
opening an album file itself. Testing adds **one** mocking boundary, `src/test/adminFake.ts`, which
stands in for the two things a test cannot have: a Google popup, and a rule on Firebase's side
deciding whether this account may read. The Google provider must be enabled in the Firebase console
and the uid pasted into `database.rules.json` and deployed — until then the screen denies everyone,
including its author, which is why the denied state **prints the uid it was refused for**: there is
no way to know your own uid before signing in once, so the first sign-in is always denied and has to
be the thing that bootstraps the rule.
