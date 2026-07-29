# Pass 4 — Blind Spot Pass

**Date:** 2026-07-28
**Mode:** DIAL: REVIEW + PROPOSE (read-only; this document is the only output of Phase 1)
**Inputs:** the full Art Direction Contract including all four addenda, the Pass 1/1R/3 audit records, the Batch 0–2.5 capture manifests, a code-level survey of every public page and shared visual component, and a first live look at the running mock app.

This document is not an audit. It names what the project's own artifacts suggest you don't know you don't know — assumptions the contract has stopped questioning, categories of visual thinking absent from every batch so far, things the reference anchors do that were never named, and vocabulary that would let you direct this work more precisely. Findings with captures belong to Phase 2; this is the map of the territory Phase 2 should be suspicious of.

---

## 1. The contract governs elements. Nothing governs the screen.

**The vocabulary you're missing: *composition* vs. *decoration*, and the *focal point*.**

Read the contract cold and notice what kind of rule it contains: badge geometry, rail widths, chip opacity, token names, motif placement, type sizes. Every rule is about an **element**. There is no rule — and there has never been an audit question — about the **screen**: where the eye should land first on Standings, what the single most important thing on the Schedule is, what a visitor should absorb in the first 500ms of Home.

This matters because "competent template" — the phrase you keep reaching for — is almost never an element problem. Batch 2's standings rows are individually correct; the 4px gold rail is contract-perfect. A page can be built entirely of correct elements and still have no *thesis*. Reference-tier work is recognizable because each screen has one deliberate focal point and a designed order in which you read everything else (designers call this the **scan path**). Your audits ask "is this element compliant/visible?" — a question about parts. The question that distinguishes tiers is "what does this screen want me to look at first, and did it succeed?" — a question about the whole.

**What knowing this unlocks:** you can start rejecting work with the sentence "this screen has no focal point" instead of asking for bigger chips — which is exactly the icon-sizes-and-padding failure mode you said you fear.

## 2. You have audited *screens*; you have never audited *moments*.

**The vocabulary: *session choreography* — what the app feels like at the times people actually open it.**

Every batch and every audit treats the app as a set of pages at rest. But a rec-league app is opened at maybe five distinct moments: the night before a game ("when/where do we play?"), standing on the field ("which field? who's up?"), minutes after a final ("did we win? what's my line?"), mid-week ("where do we sit now?"), and the playoff week. The visual work has never once been evaluated *as one of those moments*. There is no "game day" state on Home — the hero is the same static band on a Tuesday morning as it is ten minutes before your kickoff. Nothing anywhere says "TODAY."

This is also where the contract's cinematic 10% quietly evaporated. The motion vocabulary (settle, shift-weight, reveal) is assigned to *state transitions* — a game settling into FINAL, a clinch. But state changes happen in the database between visits; no spectator is ever looking at the screen when a game becomes final. As currently distributed, the 10% is spent on moments with no audience. The moments that *do* have an audience — opening the app on game day, the first load after your game went final — have no designed arrival.

**What knowing this unlocks:** the highest-value motion/cinematic budget isn't transition animation, it's **arrival states**: what Home does differently on game day, how a fresh final presents itself on first load. That is choreography the audience is guaranteed to see.

## 3. A dark-only canvas, used at noon on a field.

**The vocabulary: *environmental legibility*.**

The contract locks "dark neutral canonical surface" and no artifact in the repository ever questions it. But your own one-line product description — checked on a phone, mid-season, often standing on a field — describes the single worst environment for a dark UI: full Albuquerque sun, maximum screen brightness, polarized sunglasses. Dark surfaces under glare lose contrast far faster than light ones; every hairline border and 60%-opacity treatment the app leans on disappears first. The broadcast look that feels premium on a couch at night is measurably the hardest to read in the environment the app was built for.

I am not proposing a light theme here — that's a genuine direction decision with real cost, and it would REQUIRE CONTRACT AMENDMENT. The blind spot is that the tradeoff was never *priced*. The dark canvas was chosen on aesthetic grounds (correctly — it's distinctive and the palette is built on it) without anyone testing a phone outdoors, and the contract now treats it as physics rather than a decision.

**What knowing this unlocks:** at minimum, a "sunlight pass" becomes a named audit dimension (are the load-bearing signals — score, W/L, field number — carried by high-contrast elements, or by hairlines and low-opacity washes that die in glare?). At maximum, it motivates a future high-contrast/outdoor variant for the two surfaces people use standing on grass: Schedule and Game Detail.

## 4. The identity system is fragmenting as it spreads — and nothing owns coherence.

**The vocabulary: *identity grammar* vs. *identity instances*; *system entropy*.**

The octagon-plus-offset badge is the contract's answer to "what does a team look like?" Today, the same team is rendered as: an octagon badge (Home, Game Detail, Schedule rows, Standings rows, Leaderboards), a bespoke flat rounded-square initials tile (Team page header — the page most *about* the team), a 10px color dot (GameCard metadata, Game Detail box-score headers, Playoffs — in two different dot sizes on the same page), and players as plain circular avatars everywhere except Leaderboards. The `StatStrip` primitive Batch 0 built is dead code; Team and Profile each rolled their own stat tiles instead. The playoff page — the gold-stage surface — is the only game surface with no `StageBanner` and no structural motif at all.

None of this is any batch's *mistake*. It's what happens when identity is systemized surface-by-surface with no artifact that owns the cross-surface rule. The batches each honored the contract locally; the product now speaks the identity language with a different accent on every page. Reference-tier products are recognizable precisely because one grammar survives everywhere — that's most of what "feels designed" means.

**What knowing this unlocks:** a one-page **identity ledger** (entity × surface × device: "a team is *always* the octagon at these five sizes; a player is *always* X") turns coherence from an accident into a checkable contract line. Phase 2 will enumerate the current divergences with captures.

## 5. Team color is your most underused identity asset.

**The vocabulary: *ambient theming* — identity as environment, not ornament.**

Look at what Anchor A actually does that you've never named: Apple Sports doesn't *show* team colors, it *bathes surfaces in them* — a game between two teams renders as two color fields meeting at the score. The color isn't a dot or a 3px outline; it's the environment the data sits in. In CVF, `logo_color` — a real, per-team, already-in-the-schema asset — is spent on: a 22-alpha header tint, dots, and the badge outline. The Game Detail page for Bosque Blitz vs Mesa Mavericks is visually identical to any other matchup except for initials.

This is also the honest answer to the photography question. The contract's fallback-first rule was the right call, but it quietly became "identity zones are logo marks on washes forever." Team color used *ambiently* — at real saturation, in big fields, composed like broadcast graphics — is the fallback that doesn't read as a fallback. It's how a matchup becomes instantly recognizable in a cold screenshot without a single photo.

**What knowing this unlocks:** "make the matchup feel like *these two teams*" becomes a concrete, cheap direction (two color fields + octagon badges + big score) instead of a vague wish for photography that isn't coming this season.

## 6. Every register on the anchor sites is built around a number. Yours are built around rows.

**The vocabulary: *numerals as typography* — tabular figures, size grading, and the score as the unit of composition.**

The anchors treat numbers as the product: WC2026's monumental scores, OT7's 56px category-leader values, Apple Sports' score-first rows. The batches absorbed the *sizes* (44/56/64px ladders are in the manifests) but not the *craft*: CVF sets scores in three different faces depending on surface (`font-display` on Home's featured card, `font-mono-score` on Game Detail and stat tiles, display-tabular in competition rows), the Standings page — a numbers table — has no number larger than body text, and nothing anywhere uses optical alignment or weight contrast to make a figure feel *set* rather than *printed*. Meanwhile the R2 additions introduced 10px text on form chips, below the token system's own 11px hard floor — a sign that numbers-as-afterthought is the default posture when new data arrives.

**What knowing this unlocks:** "one score face, one ladder, everywhere" is a small, checkable rule with outsized template-smell reduction. And it gives you the right lens for Standings: its problem isn't chip size, it's that the page's *biggest number is 14px*.

## 7. "Mobile-first" has been practiced as "mobile-safe."

**The vocabulary: *content parity* vs. *responsive subtraction*.**

R2-A added form (LAST 5), streak, and tie ranks to Standings. All of it is `hidden sm:block` — at 375px, the primary viewport, none of it exists. The features you shipped to make standings feel alive are desktop-only in a product whose users are overwhelmingly on phones. The one logged VISUALLY INSUFFICIENT finding (16px chips under-register on desktop) is downstream of a bigger unexamined decision: mobile responds to new data by *deleting it* rather than *re-composing for it* (e.g., form belongs inside the expanded row, or as the leader-row's story, or as a second line — anything but gone).

The same posture shows up as batch-era layouts receiving R2 data as appended rows and buttons: calendar buttons styled as generic outline buttons stacked into Team and Schedule, venue lines appended to metadata. All correct; none *composed*. Your hypothesis that R2-on-batch seams are where the findings live is right, and this is the mechanism: R2 shipped features into layouts that were finished before those features existed, and no pass has ever re-composed the layouts around them.

**What knowing this unlocks:** for every future data addition, the question is "where does this live at 375px?" *first*, not "which desktop column does it get?"

## 8. The app has no voice, and copy is a visual material.

**The vocabulary: *editorial voice*; *copy register*.**

The status language (FINAL, UPCOMING, playoff banners) is locked and good. Everything else the app *says* is default-component dialect: "No games found / Try adjusting your filters." "No stats yet." "Results appear after the first games wrap." A broadcast-editorial product — 70% of your stated balance — is largely *made* of voice: section eyebrows, empty states, the way a blowout or a comeback gets named. OT7 (your own anchor) gets much of its personality from copy sitting inside otherwise ordinary modules. This category has never appeared in any audit, batch, or contract line. It is also the cheapest identity layer you own: rewriting twenty strings touches no layout, no tokens, no tests beyond snapshots.

**What knowing this unlocks:** empty states become editorial moments ("Season opens June 14. Rosters lock June 7.") instead of apologies, and the 20% Albuquerque layer gets a channel that isn't another line motif.

## 9. The real cold-screenshot test happens in a group chat.

**The vocabulary: the *social object* — the unit of the product that gets shared.**

The cold-screenshot test is in the contract, but it's been applied to *your* screenshots. The ones that matter are the players': someone screenshots their box score or the standings into the team group chat. That screenshot is the product's only marketing. Today it carries no wordmark, no URL, no sport, no season — outside Home, nothing in a captured viewport identifies the app. There is one static site-wide og-image; a shared standings link and a shared player profile unfurl identically. The player-experience program's "shareable stat card" proposal gestured at this, but as a feature — the blind spot is that *every public surface is already a share surface* and none has been composed as one.

**What knowing this unlocks:** a quiet, consistent page signature (wordmark + season, small, in the capture zone) and per-entity OG cards are cheap, and they aim the identity work at the only audience that grows the league.

## 10. Red is reserved for LIVE, and LIVE never happens.

**The vocabulary: *state inventory* — designing for the states the product actually produces.**

The state language dedicates the most aggressive color in the palette to live games. But the public product has no live state: scores enter after games end (aggregate flow), and the ledger runtime is admin-only. Zia red currently exists as destructive-action styling in admin. Meanwhile states the product *does* produce constantly — "today," "this week," "your next game," "final, entered minutes ago" — have no visual identity at all. The palette's emphasis budget is allocated to a future that isn't scheduled (public live scoring is not on any approved roadmap), while the actually-occurring temporal states go unmarked.

**What knowing this unlocks:** either a TODAY treatment earns a place in the state language (contract addendum), or live-entry becomes a real product goal for the flag-football pilot — but the decision becomes explicit instead of red sitting idle by default.

## 11. The anti-pattern list bans decorative charts — and with them, data storytelling.

**The vocabulary: *data graphics* vs. *chart decoration*; *sparklines*; the *score worm*.**

"Decorative charts where a list or table communicates faster" is a good ban. But it has functioned as a ban on *all* graphic representation of data, which is a different thing. A five-game form strip, a season W/L sparkline on a team page, a point-differential bar in standings, a bracket path — these are data *graphics*: they communicate trend and shape faster than the table does, which is exactly the test the anti-pattern sets. WC2026 — your Standings anchor — is entirely data graphics. The batches never once reached for one; the closest thing (form chips) arrived from R2 as text-in-boxes. Nothing in the contract distinguishes "chart as wallpaper" (banned, rightly) from "the shape of the season, drawn" (the anchor's whole method).

**What knowing this unlocks:** Standings and Team stop being tables-plus-labels and get access to the anchor's actual toolkit — while the ban keeps doing its job against dashboard-wallpaper.

## 12. Smaller blind spots, named briefly

- **Loading/skeleton choreography** has never been designed; in hosted mode, pages will pop in on real latency. First impressions are a designed surface in every reference product.
- **The app's own identity** (navbar wordmark, favicon-scale mark, PWA icon/splash) predates the visual system and has never been in any batch's scope — the brand's most-seen pixels are the least-designed.
- **Eyebrow/label grammar** ("LATEST FINAL", "UP NEXT") is the strongest editorial device currently in the product and it's confined to Home; no one has noticed it *is* a device that could carry other surfaces.
- **Empty states as identity:** the Playoffs empty state (a generic trophy in a large field) was flagged in Pass 1R, proposed as a structural-line bracket silhouette, and the proposal has silently aged out of every batch since. It remains the single most-seen "not designed yet" moment in the product.
- **Focus/press states** satisfy accessibility but use one generic teal outline everywhere; reference products make selection feel physical (Apple Sports' segmented control). This is the cheapest slice of the motion budget and it's unspent.

---

## The prompting vocabulary, consolidated

Words you can use in future direction prompts, with the question each one asks:

| Term | The question it lets you ask |
|---|---|
| **Focal point / scan path** | What should I see first on this screen? Second? Did it work? |
| **Composition (vs. decoration)** | Is this a whole-screen decision or an element decision? |
| **Register** | Which density/voice mode is this surface in — editorial, data, operational? |
| **Session choreography / arrival state** | What does this screen do differently at the moments people actually open it? |
| **Environmental legibility** | Does this survive sunlight, glare, distance, motion? |
| **Identity grammar / ledger** | Is this entity drawn the same way everywhere? Who checks? |
| **Ambient theming** | Is identity the environment of the surface, or a sticker on it? |
| **Numerals as typography** | Is the number set (face, weight, alignment, size grade) or merely printed? |
| **Content parity** | What happens to this feature at 375px — recomposed, or deleted? |
| **Editorial voice / copy register** | Does the app say this the way *this* league would say it? |
| **Social object** | What does this look like screenshotted into a group chat? |
| **State inventory** | Which states does the product actually produce, and which have designed identities? |
| **Data graphics (vs. chart decoration)** | Does drawing this communicate faster than listing it? |

---

*Phase 2 (the capture-based audit) tests these suspicions against the rendered product. Where a blind spot above turns out to be already-handled or immaterial on screen, the audit will say so rather than defend this document.*
