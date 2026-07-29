# Share the Map through a surface-neutral base component, and keep Explore's state out of the game reducer

**Status:** accepted

Explore needs everything the Map is made of — the Equal Earth projection, panning bounded to the
world, the `1/zoom` counter-scale that keeps furniture the same size on screen, the rAF-positioned
hover tooltip, straggler point-markers, commit-on-click — and none of what the Map currently _says_.
It has no Guess, no Attempt, no Answer, no geo-hint. This records the two structural calls taken
while designing it.

**The Map splits into a base and one wrapper per surface.** The base owns how a country is picked and
nothing about what picking means: callers supply the fill for a country, whether it may be picked,
what the tooltip says, the touch rule, and any overlay drawn on top. The guessing wrapper supplies
guess fills and hint marks; the Explore wrapper supplies playable/non-playable/now-playing fills and
no overlay at all. This is the same seam CONTEXT.md now draws around **Map**: the Map knows how a
country is chosen, the surface knows what the choice means.

Rejected: a `mode` prop on the existing map, which makes one component fluent in two vocabularies and
grows a third when the next surface arrives; and duplicating the component, which would put the
panning bounds, the counter-scale and the tooltip's deliberate bypass of React state in two places —
each of them a bug already fixed once (#36).

**Explore's state lives outside the game reducer, with routing left inside it.** `screen` stays the
single router in the game reducer, so there remains one place that decides what is on screen. Explore
owns its own reducer and provider mounted alongside the game's, holding the selected country and each
country's queue. The obvious alternative — a third Game mode — was rejected because Explore shares
none of the game's invariants, and folding it in would add fields that are dead on every other screen
while inviting scoring and guessing logic to leak into a surface that has neither. CONTEXT.md pins
this: Explore is not a Game mode.

**Consequences.** The base component must stay state-agnostic; the moment it grows a branch on what
kind of surface is calling it, the split has failed and the `mode` prop has been rebuilt by
accident. Touch behaviour becomes a parameter rather than a property of the Map, because the
arm-then-commit guard exists to protect an irreversible Guess and Explore has nothing irreversible to
protect. Two providers now sit above the app; they are siblings, not a hierarchy — neither reads the
other. The existing map and app test suites are the regression guard on the extraction and should
need no edits to pass; if they do, the base is not behaviour-neutral.
