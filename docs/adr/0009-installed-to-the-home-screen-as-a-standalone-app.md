# Installed to the home screen as a standalone app

**Status:** accepted

GeoTracks already shipped a manifest, a favicon and two PNGs, which was enough for a browser tab and
not enough for an iPhone. Adding it to the home screen produced an app whose icon was a yellow pin on
a black tile, whose wordmark sat behind the Dynamic Island, and whose whole interface rubber-banded
when a pan missed the map. This records what was changed and, more usefully, the four things that
were decided rather than typed.

Nothing about the game changed. Every decision here is about the frame the game is shown in.

## The mark is drawn twice, because a tab strip and a home screen want opposites

`design.md` already insists there is one mark and one geometry, and `scripts/build-logo-assets.ts`
already drew every committed asset from it. That stays true — what the script now draws is **two
families** of the same drawing:

|                   | favicon family                   | installed family              |
| ----------------- | -------------------------------- | ----------------------------- |
| ground            | transparent                      | opaque cream                  |
| framing           | full-bleed                       | inset                         |
| who composites it | the browser, onto its own chrome | the OS, then masks the result |

The favicon family cannot be padded: a favicon that pads itself looks smaller than every other one in
the tab strip. The installed family cannot be transparent: **iOS fills transparency with black** and
then cuts a squircle out of what it gets, so a transparent full-bleed pin becomes a clipped pin on a
black tile — which is precisely the icon this ADR exists to stop shipping.

The ground is **cream** rather than night because cream is the ground the mark is _designed_ on. The
ink outline around the pin exists because pear is 1.4:1 on paper (`design.md` § The brand), so an
icon on cream is the mark exactly as the app draws it, outline and all, rather than a second
treatment invented for the home screen.

The inset is **fitted to the mark's ink, not its bounding box**. A maskable icon promises that
anything inside the circle of 80% diameter survives any launcher's mask; bounding the mark's
_diagonal_ would shrink it to 69% of the canvas to protect two corners a map pin has nothing in.
Measuring the drawing instead puts it at 77%, with the furthest inked pixel at 0.92 of the safe
radius. The numbers live next to their reasoning in the script.

**There are no `apple-touch-startup-image` files.** A full set is roughly twenty media-query'd PNGs,
one per device and orientation, that must be regenerated whenever Apple ships a new screen size —
and since iOS 15.4 Safari builds the launch screen itself from the manifest's icon and
`background_color`. Twenty files to slightly out-perform something the platform now does for free is
not a trade this repo should take, and the failure mode of not having them is a launch screen that is
merely plain.

## Two grounds mean the status bar cannot have one colour

This is the decision the rest of the change hangs on. Installed, there is no browser chrome between
the status bar and the page: the OS paints that strip with the theme colour, directly against the top
of the screen. And this app has **two grounds** — a content page's top is the night backdrop, a map
surface's top is the cream chrome scrim. Any single theme colour is therefore wrong on half the
screens, and a cream bar capping a near-black menu is exactly the seam that reads as "web page".

So `useThemeColor` rewrites the meta tag on every screen change. It takes the **family**, not the
screen (`isMapSurface`, which `App.tsx` had already computed for the layout), because a per-screen
map inside the hook would be a second place that decides what a screen is — the same rule ADR-0003
applies to the router.

The corollary is that `apple-mobile-web-app-status-bar-style` is **`default` and deliberately not
`black-translucent`**. The translucent style is the one most PWA guides reach for, and it pins the
status bar's glyphs to white: right over the menu's night, invisible over the game's cream. A fixed
glyph colour is the same mistake as a fixed bar colour, one layer up.

`background_color` stays **cream** even though the app opens on the night menu, because it describes
the ground the _document_ paints before React mounts, and the body is cream. Setting it to night
would trade one transition (splash → menu) for two (splash → cream body → menu).

## The ground reaches the edges; everything on it does not

`viewport-fit=cover` is what lets the app fill an iPhone instead of sitting in a letterboxed safe
rectangle, and it is also what gives `env(safe-area-inset-*)` a value at all — without it every such
expression resolves to 0, which is why the one the repo already had (the panel tray's bottom padding)
had never done anything.

The rule applied everywhere: **the map runs under the notch and the home indicator, and nothing
placed on the map does.** A ground that stopped short of the hardware would show a cream band along
the top of the phone, which is worse than the thing it avoids. So each piece of floating chrome adds
the inset of the edge it is pinned to, through one helper in `src/layout.ts` so the expression is
written once.

They are **additive rather than a branch**: `env()` is 0 on every desktop browser and on any iOS that
insets the web view itself, so the layout is unchanged everywhere that isn't a notched phone held in
standalone. The fallback argument (`env(…, 0px)`) is load-bearing in the other direction — an engine
that has never heard of `env()` drops the entire declaration, taking the spacing the design wanted
with it.

## Two web-page tells, removed at the root

`overscroll-behavior: none` and a transparent `-webkit-tap-highlight-color`, both on `html, body`.

The first matters because a map surface is a fixed, non-scrolling viewport: a drag the map does not
take is a drag on the document, and the whole app bouncing under a failed pan is the loudest "this is
Safari" moment the game has. The second is a design-system point rather than a polish one —
`design.md` § Microinteractions stance says a button's press _is_ its feedback, and a system
rectangle drawn over the top of it is a second, uninvited answer to the same question. On the map it
is drawn around a country's bounding box rather than its shape, which is worse still.

For the same reason the map now refuses text selection and the long-press callout: on touch the first
tap only _arms_ a country, so the press that arms it is held for a moment by design — which is
exactly the gesture iOS reads as "select this".

## What this does not do

- **No service worker, and so no offline.** The app is a Spotify client; the thing a player came for
  does not work offline, and a cache that served a stale bundle would be a new way for the Daily Run
  to disagree with itself across tabs. `display: standalone` needs no service worker on iOS.
- **No orientation lock.** The layout has a considered answer in both (`src/layout.ts`), and locking
  would throw away the better half of it.
- **No install prompt.** `beforeinstallprompt` does not exist on iOS, where this was asked for, and a
  banner that appears only on Android would be a feature for the platform that needed it least.
