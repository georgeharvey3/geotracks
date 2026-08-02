# Suggestions are accepted in the app, with the reviewer's own Spotify

**Status:** accepted

**Supersedes** the last piece of
[ADR-0005](0005-suggestions-collected-in-the-app-and-accepted-by-a-commit.md) still standing — "the
app collects Suggestions; it does not act on them" — and ADR-0006's "reject is a delete; accept is a
clipboard", along with the claim in [ADR-0007](0007-community-albums-live-in-the-database.md) that
**a click in the review screen cannot accept an album**. That claim was correct about its premise and
wrong about its conclusion.

What survives untouched: the Folkways half is still bundled, `liveFrom` still gates Competition, an
album whose date has passed is still frozen, and the client secret still never reaches a browser.

## The blocker was never the write

Three ADRs in a row have said accepting cannot be a button, and each said it for a different reason.
ADR-0005 said it writes a file and ends in a commit — no longer true since ADR-0007, which moved the
album into the database. ADR-0007 then restated the blocker in its final form, and this is the one
that was actually load-bearing:

> accepting needs the album's full track list, which comes from Spotify's catalogue API, which needs
> the client secret. oEmbed gives a title and a cover and no tracks.

Every word of that is true. The conclusion drawn from it — that only a paid Cloud Function holding
the secret could get past it — assumed the token has to belong to **the app**. It does not.
**Authorization Code with PKCE** is the flow designed for clients that cannot keep a secret: the
reviewer signs in to their own Spotify account, the app proves itself with a one-time hash instead of
a credential, and the token that comes back reads the catalogue perfectly well. The client id is
public by design and always has been; the secret stays in the gitignored `.env`, read by the script
and by nothing in `src/`.

Reading an album needs **no scopes at all**, so the consent screen asks for nothing: not the
reviewer's library, not their playlists, not what they are listening to. It is the smallest possible
version of "prove you are a Spotify user".

## Two sign-ins, answering two different questions

The screen now asks for two accounts, and they are not redundant.

**Google says who may see the queue.** That is ADR-0006 and it is unchanged: `database.rules.json`
names one uid, Firebase enforces it, nothing in `src/` knows which uid it is.

**Spotify says nothing about permission at all.** It is not a second gate and must not be read as
one — it is how a page with no secret gets to ask what is on an album. Reading the queue, judging it
and rejecting all work with no Spotify connection whatever; only accepting needs one, and the strip
above the queue exists so that a disabled Accept button is never unexplained.

The rejected alternative was a **server-side proxy** — a Cloudflare Worker or a Blaze-tier Function
holding the secret and handing out track lists to an authenticated caller. It would need one sign-in
rather than two and no Spotify dashboard change. It was refused because it gives this repo something
it has never had: a deployed backend, with its own secret store, its own deploy step, its own
availability, and its own place to go wrong. GeoTracks is a static build on GitHub Pages, and the
whole reason a hardcoded uid in the rules beat custom claims in ADR-0006 was to keep it that way.

## The token is held in memory and nowhere else

Not `localStorage`, which `useDailyRun` is deliberately the app's only user of, and not
`sessionStorage` either. An access token is a credential; it lasts an hour; a reload costs one click
to replace because Spotify still has the session. The **refresh token is thrown away** for the same
reason — the alternative to keeping a long-lived credential in web storage is a button, and a button
is cheap.

Nothing about the sign-in survives the tab, which is the right lifetime for a thing used a few times
a month.

## A popup, because a redirect would tear the review down

Spotify redirects to a **registered** URI, and a registered URI cannot carry a fragment — so the
reply lands on the site's base URL, which is the app's own `index.html`. Two shapes were possible.

A **full-page redirect** would unmount the app mid-review, come back to a fresh menu with a code in
the address bar, and require the app to learn about a query parameter it otherwise has no business
reading. `#admin` is the app's one piece of URL awareness and ADR-0006 was explicit that it is a
convenience rather than routing; a second, load-bearing one is a worse trade than it looks.

So: a **popup**. It navigates to Spotify, comes back to the app's own address, and the very first
thing `index.tsx` does is ask whether this document is that popup — if it is, it posts the code to
its opener and closes without rendering anything. Otherwise a whole second GeoTracks would boot
inside a 520px window: a second map, a second Spotify embed, a second anonymous sign-in, thrown away
a moment later. The one document that reads the URL is the one that exists only to read it.

Two details that are easy to get wrong and are therefore written down. The popup is opened **inside
the click** and pointed at Spotify afterwards, because hashing the verifier is asynchronous and a
`window.open` on the far side of an `await` has lost its claim to have been asked for by a person.
And the reply is posted to **this origin** rather than `*`, and checked against the `state` that
requested it — an authorization code is not a thing to broadcast or to take on trust.

## What the rules now allow

`communityAlbums/` gains a write branch, which ADR-0007 explicitly gave it none of. It is as narrow
as the leaderboard's: the admin uid only, **create-only** (`!data.exists()`), and `.validate` on
every field — country and album name bounded, `liveFrom` matching `YYYY-MM-DD`, every track matching
a bare `https://open.spotify.com/track/{22}` URL, and no key the rule does not name.

Create-only is not incidental. It is the **freeze discipline** from ADR-0007 — an album whose
`liveFrom` has passed changes somebody's day if it is edited or deleted — expressed for the first
time as something a server enforces rather than something a person remembers. The script still
bypasses rules through the owner's CLI, so correcting a mistake is still possible; it is simply no
longer possible by accident from a browser.

Accepting is the same **atomic multi-path update** the script makes: the album lands in
`communityAlbums/` and the Suggestion is deleted in one write. There is no window in which one
happened and the other did not, and therefore still no "reviewed" flag to keep in step.

## The script stays

It is not a fallback that will rot. It does two things the screen deliberately does not: `--live-from`
for a date other than tomorrow, and adding an album **nobody suggested**. It also needs no browser
and no Spotify sign-in, and it is the only way to write a `communityAlbums` record that the create-only
rule would refuse. Each row keeps a small button that copies its command.

What both must agree on now lives in one import-free module, `src/music/acceptance.ts`: the `liveFrom`
default, the track-URL cleaning, the duplicate check and the record's shape. The ways these two could
have quietly disagreed are the ways that matter most — a duplicate one catches and the other does not
puts an album in the Library twice; a `liveFrom` defaulted differently lands an album in Competition
on a day the other would not have. Neither surfaces as an error anywhere.

## Consequences

Two hooks where there was one: `useSpotifyAuth` joins `useAdmin`, and `useAdmin` grows `accept`.
Putting the catalogue read and the database write behind **one** call is deliberate — a half-accept
is the failure worth designing out, and only one thing owning both halves can design it out. It also
keeps the screen at one fake in the tests, with `spotifyAuthFake` added beside `adminFake` for the
one thing a test can least have: a popup negotiating OAuth with a third party.

`accept` reports rather than throws, because every way it fails is something the reviewer is told and
can act on: an expired token, an album Spotify does not have, a track already in the Library and the
album holding it, a country code `countries.json` does not know, a refused write. The duplicate check
reads `communityAlbums` **fresh** rather than using the copy the app booted with — this is the one
moment where being a minute stale means writing the same album twice.

Accepting arms before it commits, as rejecting already did. They are symmetrical now in a way ADR-0006
said they should not look: both are real writes, and publishing an album that will shortly be frozen
deserves the same second click as deleting a record.

**Setup this needs, and it is not nothing.** A Spotify app with the site's base URL registered as a
Redirect URI — `https://georgeharvey3.github.io/geotracks/` — and `VITE_SPOTIFY_CLIENT_ID` set as a
repository **variable** (not a secret — it is neither) for the deployed build. Without it the screen
says so plainly and points at the terminal, which is a state worth having: the review screen ships to
every visitor, and a fork with no Spotify app of its own should degrade to exactly what it had before
this ADR.

**The whole screen cannot be exercised locally, and that is not a gap in the setup.** It is two
allowlists that disagree about what a development origin is, neither of which we own:

- **Firebase Auth** authorizes `localhost` by default and **rejects IP literals** outright — the
  console's own validator refuses `127.0.0.1` with "a valid domain name is required".
- **Spotify** refuses `localhost` as a redirect URI — "this redirect URI is not secure" — and
  requires the loopback IP, `http://127.0.0.1:5173/geotracks/`.

The Google gate and the Spotify sign-in are on the same page, so there is no origin where both work.
At `localhost` the queue reads and rejects and the Spotify popup dies; at `127.0.0.1` sign-in never
happens at all, so nothing else is reachable. An HTTPS dev server on a real hostname (mkcert, a name
both consoles accept) would satisfy both and is the escape hatch if reviewing ever becomes routine;
it is deliberately not set up, because it buys a browser tab at the cost of a TLS story in the repo.

So **development leaves `VITE_SPOTIFY_CLIENT_ID` unset**, which is why the unconfigured state was
built before it was needed. Locally the screen reads and rejects and says accepting is done from the
terminal, which is true and is exactly what the script is for. Accepting through the app is exercised
in production, where one origin satisfies both allowlists and always has.

Firebase's **authorized domains** are a second setup step nobody had needed until this ADR sent
somebody to a new origin, and they are worth naming because ADR-0006 shipped without them:
`georgeharvey3.github.io` has to be on that list or Google sign-in fails on the deployed screen, in
the same silent way as everything else this list governs.
