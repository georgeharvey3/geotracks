# Suggestions are collected in the app and accepted by a commit

**Status:** accepted

A player should be able to suggest an album for the app to add (issue #40). The whole of this is one
decision seen from five sides, and split apart each half reads as arbitrary — `liveFrom` in
particular is only _explicable_ once you know that accepted albums arrive by deploy, which is only
true because review happens outside the app. So they are recorded together.

**What becomes dynamic is _collecting_ Suggestions, not the Library.** A Suggestion is a proposal:
the album on Spotify, the country the player says it belongs to, and optionally why. Accepting one is
a commit, a PR into `develop`, a release merge to `main` and a Pages deploy. There is no in-app
review UI, no moderation queue, and no notion of the Library changing without a deploy.

**Transport is a Firebase RTDB node, not email.** This is a static Vite build on GitHub Pages, and a
static page cannot send email. The one server-ish thing the app already has is RTDB, and the
leaderboard is already a public-write, anonymous-auth, append-only, strictly-`.validate`d node — a
suggestion box is the same shape of thing, with no new dependency and no third-party form vendor. It
is in fact _more_ locked down: the client **writes and never reads**. `suggestions` gets no `.read`
and so inherits `false` from the root, leaving the Firebase console — which bypasses rules — as the
only reader. There is deliberately **no email notification**: reviewing happens in batches, nothing
in this loop has a latency requirement, and attaching a billing card (Blaze) and an SMTP provider to
shave it is not worth it. The Firebase "Trigger Email" extension is the named follow-up if the box
ever fills faster than it gets checked.

**The record stores the album id and the alpha-2 country code, not a URL and not a name.** Every
share link Spotify's app produces carries a `?si=` tracking token; storing raw URLs would mean
holding a stranger's share-tracking token indefinitely for no benefit, since
`https://open.spotify.com/album/{id}` is trivially rebuilt. Extracting the id at submit time _is_ the
validation, and the rule can then check the stored form exactly — which it could never do for a
free-form URL. `"GB"` likewise: a Suggestion is a stored record with a lifetime and may sit
unreviewed for weeks, so it should be immune to any future renaming of a display string, and "is this
arbitrary string one of 246 names?" is not expressible in an RTDB rule. The name is one lookup away at
accept time. **`uid` is included** — anonymous auth already mints one for the write to happen at all,
and a public-write node with no attributable identity is one that can only be defended by deleting all
of it. **There is no contact field and no name:** an "email (optional)" box that never receives a
reply is worse than no box, and it would be the app's only piece of personal data in an app with no
privacy policy. The success copy is honest instead — read by a human, no reply, no timeline. Credit
can still be added to `community-albums.json` later, because that is our own file and the form never
had to ask.

**Abuse is met with an in-flight guard now and App Check later.** Two things make this node less
attractive than "public-write endpoint" sounds: `.read: false` means spam has no audience, and
`scores/` already carries exactly this exposure and has never been abused. One thing makes it worse —
`scores` holds a 10-character name and an integer, whereas `suggestions` holds 500 characters of
arbitrary text, the first place in the database where a stranger can store _content_, and both nodes
share one Spark-tier database with a 1 GB cap. Rules-based throttling was considered and rejected: it
costs real complexity in the one place where a mistake is a security hole, and it stops a person only
for as long as it takes them to clear site data and mint a new anonymous uid. **If junk appears, the
response is Firebase App Check (reCAPTCHA v3)** — decided now so that it is executed rather than
invented in a panic.

**Two files, one Library.** `albums.json` carries a claim with value, stated in both CLAUDE.md and
CONTEXT.md: every album in it came from the Smithsonian Folkways Archive, catalogued by hand from six
sheets. Appending Community albums to it would make that claim quietly false and unseparable forever.
**The filename is the provenance record**, and it costs one import. `src/music/library.ts` owns the
union and after this nothing else imports a raw album JSON — `gameReducer`, `exploreReducer` and the
tests each concatenating for themselves would be four places to keep in step, and the failure mode
when one is missed is Explore offering a country the game's pool has never heard of. **`Album` gains
no `source` field:** provenance is already recorded positionally by which file an entry sits in, and
adding it to the runtime type means every consumer of an Album — the daily seed, Explore's queue, the
Run summary's rows — gains an optional field it must decide to ignore. If a UI ever credits or badges
Community albums, `library.ts` is where that gets attached.

**A Community album enters Competition at the next local midnight (`liveFrom`).** This is the subtlest
thing here and the most likely to be deleted by someone who thinks it is dead weight.
`getDailySongs(albums)` seeds off the calendar date and then draws **by array index**, splicing as it
goes, and `createInitialState` derives `dailySongs` fresh on **every page load** from the current
pool. So adding one album anywhere changes every date's ten-song sequence, and a deploy mid-day breaks
two things: two players on the same calendar day, one loading before the deploy and one after, play
different Daily Songs onto the same leaderboard — the stated reason the seed exists stops holding for
that day; and a single player resuming an unfinished Run finds `RESUME_RUN` reading the _freshly
derived_ list, so their four completed turns come from the old sequence and the six ahead of them from
a new one, on a Run they only get one of per day. This is already true of any hand-edit to
`albums.json`; what changes is frequency, from rare-and-deliberate to routine. So every entry in
`community-albums.json` carries `liveFrom: "YYYY-MM-DD"` and `competitionAlbums(library, today)`
admits it only once the day has passed that date; Folkways entries carry no such field and are always
live. **`liveFrom` is a switch-on date, not a provenance date**, and is authored **ahead** of the
release — the day _after_ the intended one. If it were the acceptance date, a release landing three
days later would ship an album already past its date, which enters the pool the instant the deploy
completes: exactly the failure this prevents. `getDateSeed()` is device-local, so at any instant users
span three calendar dates; authoring it a day ahead means nobody has passed the switch-on date when
the deploy lands, and everyone crosses it at their own local midnight — the same boundary the Daily
Run already rolls over on. **Residual risk, accepted:** a release that slips past its intended date
leaves a few hours of exposure for players far east. That is a process slip, not a code bug, and no CI
check is practical — a rule like "must be ≥ the build date" would fail every unrelated re-deploy after
that date passes. `competitionAlbums` **takes the date as an argument** rather than reading the clock,
following `helpers/dailyRun.ts`: `vi.setSystemTime` moves the daily seed, and no test may assert which
Songs a day yields, so a pure function is testable with fixtures and one that read `new Date()`
internally could only be tested the forbidden way.

**A sixth screen, not a modal.** The app contains no `Dialog`, `Modal` or `Snackbar` anywhere, and
`design.md` is locked and has no pattern for either — a modal would mean designing one: scrim colour
on the night backdrop, focus trapping, dismissal, mobile behaviour, and its interaction with the FLIP
lockup animation. The system already has exactly one shape for "a page you go to from the menu that
isn't the map", and the scoreboard is it. So `Screen` gains `"suggest"`, the screen joins the
**content-page family** (night backdrop, `veil="settle"`, paper chrome), and the form sits inside an
MUI `Paper` card as the scoreboard's table does — load-bearing, not decoration, because `TextField` in
this app is cream and unwrapped on the night these would be input boxes floating on black with no
surface beneath them. **`screen` gains a value and a prefill, and nothing else about a Suggestion goes
in the game reducer:** the router is the one thing that decides what is on screen (ADR-0003), so the
page belongs there, but the form's own state — three fields, validity, in-flight/success/error — is
local and the write goes behind `useSuggestions`, alongside `useLeaderboard`.

**The Explore entry tells the panel; it does not navigate.** The moment a person most wants to suggest
music is not on the menu — it is in Explore, when they choose a country and find silence. But Explore
passes `armOnTouch={false}` deliberately, because "choosing a country in Explore costs nothing but the
Song now playing", and leaving Explore unmounts the player. If a non-playable country navigated
straight to the form, one stray tap on Chad while listening to Mali would cost both the song and the
screen — inverting the exact reasoning that made a single tap safe there. So clicking a silent country
selects it as the country being _asked about_: no navigation, no music stopped, nothing played. The
panel then offers the link, and going there is a deliberate second action — the same arm-then-commit
structure the touch rule already uses, applied to the thing that now has a cost. This costs a second
kind of selection in `exploreReducer` (the country being listened to, and the country being asked
about), makes non-playable countries **selectable** — a shift from "an absence of music is not an
absence of geography" toward "…is an invitation" — and sends a prefill across sibling reducers, as
`SHOW_SUGGEST`'s optional country code.

**The form asks only for what Spotify cannot tell you.** Given an album id the accept script fetches
the album name, the artist and every track URL; what it can never fetch is which country the music
belongs to, or why. So the form is a link, a country and a note, and it must **never ask for an album
name** — a field the submitter can get wrong about something the machine knows for certain. Track
links are rejected with a specific message, because a pasted `/track/` URL is the overwhelmingly
likely wrong paste and "invalid URL" is a useless thing to say about it; accepting them and resolving
to albums in the script was rejected because a track id and an album id are both 22 base62 characters,
so the stored record would gain an ambiguity no `.validate` rule could settle and that would sit in the
database for months. Free-text country entry is the single easiest way to break the name join ("Ivory
Coast", "USA"), so the picker is not optional — which forces `CountryInput` to split: it owns its own
`<form>`, clears itself on submit and ends in a Send button, so it is a _guess submitter_ rather than a
controlled field and cannot be dropped into a multi-field form. A controlled `CountryAutocomplete` is
extracted and `CountryInput` becomes a thin wrapper over it, keeping one picker in the app with one set
of arrow-key semantics; reaching for MUI's `Autocomplete` for the form alone would mean two.

**The accept script is a transcription tool, not a gatekeeper.** Hand-copying fifteen track URLs per
album is not acceptable, so `scripts/add-community-album.ts` is in scope. It uses the
client-credentials flow (no user login, free) with `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` in the
gitignored `.env`, **without** the `VITE_` prefix — the first genuine secrets this repo has ever held,
in a file otherwise full of things documented as explicitly _not_ secret, which is why the warning in
`.env.example` is load-bearing. **It reads the database and never writes to it.** Copying an id and an
alpha-2 code out of the console by hand is the same clerical work the script exists to abolish, so it
lists the waiting Suggestions itself and accepts the one that is picked. The read goes through the
**Firebase CLI** — already installed, already logged in as the owner (`firebase deploy --only database`
is how the rules got there), with `.firebaserc` naming the project — so it is the console's privilege
without an admin SDK or a service-account JSON on disk. What stays refused is the **write** back: there
is no "reviewed" flag to keep in sync, and an accepted Suggestion is recognised instead by the
`suggestion` push key recorded on `CommunityAlbum`, on our own side of the line. The cost is that a
Suggestion which is _declined_ has nowhere to be recorded and sits in the listing until it is deleted
in the console, which is what the console is still for. Duplicates are caught by **track URL** rather than album id,
because `albums.json` stores tracks and holds no album ids at all. Query parameters are stripped, the
country **name** is written (the join is by name), `liveFrom` defaults to tomorrow, and `--dry-run`
prints the entry it would write. Nothing here can verify that the country makes sense; that is the
human review step.

**Consequences.** CONTEXT.md gains Suggestion, Library and Community album, and its **Playable
country** entry changes: non-playable countries are no longer "not selectable". CLAUDE.md's Folkways
claim needs qualifying — "every Album in the app comes from the Smithsonian Folkways Archive" stops
being true the day the first Suggestion is accepted. `design.md` is locked and names the content-page
family as "Menu / Scoreboard"; a third joins them, so that edit ships in the same PR or the document is
wrong the moment this does. The menu gains a **second outlined secondary button** beside Scoreboard
rather than a fourth filled one, because `design.md`'s CTA voice has exactly two tiers and a fourth
primary would make suggesting an album a peer of Competition, Infinite and Explore. Testing adds
**one** mocking boundary — the RTDB write, behind `useSuggestions`, with `src/test/suggestionFake.ts`
beside `leaderboardFake.ts`; the form, the union and the `liveFrom` filter are pure and need nothing.
The script has no test, as `build-map-geometry.mjs` and `build-logo-assets.ts` have none: its one piece
of interesting logic is the shared, tested `extractAlbumId`.
