# Tickets: Crown & Fealty core loop

Breaks `PRD.md`'s milestones (M0–M8) into vertical-slice tickets. Each ticket is
independently demoable/verifiable and small enough for a single fresh context
window. Work the **frontier**: any ticket whose blockers are all done can start.

Rule references (§N) point at `crown-and-fealty-design.md`. Guardrails from
`PRD.md` §3 (config-driven constants, boardgame.io conventions, don't break
`scoring.js`, small commits with rule-cited messages) apply to every ticket
below and aren't repeated per-ticket.

If any rule is ambiguous while implementing a ticket, stop and ask rather than
guessing — see `PRD.md` §7 for known-open design questions.

## M0 — Baseline & safety net

**What to build:** Confirm the current build runs end-to-end, and lock in an
automated check that catches scoring regressions before any other milestone
touches `setup.js`, `scoring.js`, or `config.js`.

**Blocked by:** None — can start immediately

- [x] `npm install && npm run dev` boots clean
- [x] A full 6-year game, played via the debug panel, reaches "Game over" with a winner declared (verified headlessly via `scripts/smoke-full-game.mjs` driving the real boardgame.io reducer — this also caught and fixed a crash where `endIf` mutated frozen state)
- [x] An automated test (Node script or Vitest) imports `setup` + `scoring`, simulates 6 harvests, and asserts king/duke prestige and final scores land in expected ranges (see `PRD.md` §6 for baseline numbers)
- [x] Wired as `npm test`; it passes

## M1 — Real turn structure & phase flow

**What to build:** Replace `activePlayers: ALL` with real per-phase turn
control so players can only act on their own turn, in the right phase, on
legal moves. This is the PRD's highest-priority milestone — see design §5.

**Blocked by:** M0

- [x] Council: only the crown-holder is active; other seats cannot act
- [x] Actions: sequential turns clockwise starting from the king; each player gets up to `CONFIG.actionsPerTurn` actions, then passes; passing ends the turn (holding actions as reactions can come later)
- [x] `Board.jsx` shows controls for a seat only when that seat is active, with a clear "waiting for seat N" state
- [x] You can no longer take a duke action during the king's council
- [x] In Actions, turns visibly pass player-to-player and stop each player at 3 actions
- [x] A full game still completes

## M2a — Draft: Inis-style pick-and-pass

**What to build:** Replace the straight deal with a real draft: deal 5, each
player picks 1 and passes the rest, repeat until each holds 4. Design §9,
§5 Phase 2.

**Blocked by:** M1

- [x] All players are active simultaneously for each pick step
- [x] Initial shuffle/deal uses the `random` plugin
- [x] Leftover cards are discarded after the final pass
- [x] A real draft occurs every year (deck reshuffles from discard when thin)

## M2b — Card effects: Actions, Characters & Claims + deck expansion

**What to build:** Expand the deck and implement the `effect` switch for
every Action, Character, and Claim card. Design §9.

**Blocked by:** M1

- [x] `CARDS` in `data.js` expanded from 2 implemented effects toward ~30–40 cards with several copies, balanced across types, keeping the `{ type, name, crownOnly, effect, text }` shape
- [x] Every Action card does what its text says (gold, muster, garrison reduction, tournament, charter, etc.)
- [x] `crownOnly` cards are unplayable by a duke (`playCard` returns `INVALID_MOVE`) but remain in hand
- [x] Character cards are placed in `player.characters` and apply their passive modifiers where relevant now (e.g. `legate` +1 prestige/year in `runHarvest`); modifiers that plug into battle (e.g. `general` +1 strength) are exposed for M3 to read
- [x] Claim cards are played openly onto a province id (`player.claims`) and enforce the §9 grant-or-favor-penalty payoff through the shared province-grant seam

## M2c — Card effects: Schemes

**What to build:** Implement Scheme cards as face-down plays that resolve via
a hook invoked from the existing War/Rebellion resolution. Design §9.

**Blocked by:** M1

- [x] Scheme cards are stored face-down in `player.schemes` when played
- [x] A reveal/resolution hook exists and is invoked from the current (basic) `resolveWar`/`resolveRebellion` at the right trigger (battle declared, dial revealed, rebellion declared)
- [x] At least Ambush, Poison the Wells, and Bribed Captains resolve correctly through the hook

## M2d — Card effects: Decrees

**What to build:** Implement Decree cards, which require a council vote to
enact. Design §9.

**Blocked by:** M5.1

- [ ] Decree cards can be held by any seat but enacted only by the crown-holder
- [ ] Enacting a decree routes through the M5.1 voting mechanic — no direct-set path
- [ ] Every decree in the deck does what its text says once enacted

## M3.1 — War: levy duty, secret commitment & resolution

**What to build:** Finish the core external-war resolution loop. Design §7.
Builds on the existing `commitTroops`/`resolveWar`.

**Blocked by:** M1

- [x] Each duke's owed troops computed from `CONFIG.levyLaw[G.levyLaw]` × their total levy value (floored)
- [x] Committing ≥ duty: no penalty. Exceeding duty: +1 favor. Under duty: −1 favor **and** a Casus Belli placed (`G.casusBelli[duke]++`); branded in the log
- [x] During the Phase 4 war step, all participants set a dial simultaneously; a `revealWar` step reveals together, wired to invoke the M2c scheme-reveal hook (Ambush, Poison the Wells, Bribed Captains)
- [x] Resolution compares committed strength (+ Marshal +2 if fighting, + relevant schemes/characters) vs. `garrison + CONFIG.warModifierDeck` draw (via `random`)
- [x] Casualties applied per §7.5
- [x] Dukes are scored/branded correctly by their commitment vs. duty

## M3.2 — War: consequences (victory distribution + defeat)

**What to build:** Apply the full consequences of a resolved external war in
both branches. Design §7.6–§7.7.

**Blocked by:** M3.1

- [x] Victory: king keeps up to `CONFIG.domainLimit` provinces (Capital counts); surplus must be granted to dukes (+2 favor each) before the phase ends; any province the king can't keep and won't grant is sacked (removed, −1 favor with everyone)
- [x] The phase cannot end while the king is over Domain Limit
- [x] Defeat: double casualties on the losing side; king pays `CONFIG.warReparationsGold`, borrowing from dukes if short (a simple prompt/loan record); enemy occupies 1 border province of the king's choice (`faceUp=false`); king −2 prestige, −1 favor with every duke; `warLostThisYear` set
- [x] A won war forces legal distribution and cannot be left over-limit
- [x] A lost war applies all penalties and occupies a province

## M4.1 — Rebellion: side-picking & negotiation

**What to build:** Implement side declaration and the negotiation window
that precedes rebellion battle resolution. Design §10.

**Blocked by:** M1

- [x] A duke can declare a rebellion at the start of Phase 4 (one per year, already enforced)
- [x] Going around the table from the rebel, each other duke declares Loyalist / Rebel / Neutral, stored in `G.activeRebellion.sides`
- [x] Negotiation window: the king may make binding offers (gold transferred immediately; promises are not enforced — Junta rule)
- [x] Each player may change their declaration once during the window, then it locks
- [x] Dukes can pick sides and renegotiate exactly once

## M4.2 — Rebellion: battle resolution

**What to build:** Compute total side strength and determine the rebellion's
winner. Design §10.

**Blocked by:** M4.1, M2c

- [x] Total **all** troops per side (civil war is total, not committed subsets)
- [x] + Marshal (+2, on the king's side unless granted away)
- [x] + Castles (+1 per castle on a defender-side province)
- [x] + revealed Schemes (via the M2c hook)
- [x] Larger total wins; no randomness in civil wars
- [x] Totals include castles/Marshal/schemes correctly in a test case

## M4.3 — Rebellion: consequences

**What to build:** Apply the full consequences of a resolved rebellion in
both branches, plus the neutral-seat penalty. Design §10.

**Blocked by:** M4.2

- [ ] Rebels win: rebel leader takes the Crown (+`usurperBonus`), Capital transfers, favor resets to 0 for the new reign; new king may strip up to 2 provinces from each Loyalist and auto-trims the deposed king to duke size; stripped land distributed to the winning coalition honoring Domain Limit
- [ ] King wins: rebel leader −3 prestige; king strips 2 provinces from the leader + 1 from each other rebel; stripped land goes to Loyalists first (+2 favor) then the king up to limit; all rebels (not just the leader) drop to the favor floor with the `rebellionCooldownYears` cooldown
- [ ] Neutral: the winner marks each Neutral seat −1 favor (or starts them at −1 under a new king)
- [ ] Both win/lose branches transfer land and prestige per §10
- [ ] A new king starts with a blank favor ledger

## M5.1 — Council voting

**What to build:** Require a vote to change laws/decrees instead of the king
setting them directly. Design §5 Council.

**Blocked by:** M1

- [ ] One vote per player; Chancellor's vote counts double (`CONFIG.chancellorVoteWeight`); king breaks ties
- [ ] Open bribery allowed — cash transfers are legal moves during the vote
- [ ] §5 favor consequences applied (raising a law angers dissenters; lowering pleases all)
- [ ] Laws/decrees only change via a resolved vote
- [ ] Chancellor double-vote and king tiebreak work correctly

## M5.2 — Revocation

**What to build:** Let the king target a duke for Revocation, with a
submit-or-defy response that routes into the rebellion flow. Design §11.

**Blocked by:** M5.1, M4.1

- [ ] King targets a duke; prerogative (no vote needed) if the king holds a Casus Belli on them or they're at favor floor, else requires an M5.1 vote
- [ ] Target chooses Submit (lose 1 province of their choice, −2 favor, spends the Casus Belli) or Defy (immediate rebellion with them as leader, entering the M4 flow)
- [ ] Revocation offers submit-or-rebel and routes Defy into the rebellion flow correctly

## M6 — Auction the crown (setup)

**What to build:** Replace the fixed seat-0 king with the design's §4
auction. Independent of the turn/card/war/council work above — touches only
setup — so it can be picked up any time after M0.

**Blocked by:** M0

- [ ] A pre-game phase where players bid in negative starting prestige
- [ ] Highest bidder becomes King and starts at −(bid) prestige
- [ ] Remaining seats are assigned duchies
- [ ] The king is determined by auction; starting prestige reflects the winning bid; rest of setup (duchies, gold, troops) still holds

## M7 — Hidden information

**What to build:** Implement `playerView` in `game.js` to redact hidden state
per seat, unblocking future networked play. Local hotseat won't invoke it,
but it needs the final shape of every hidden field introduced by the
gameplay milestones.

**Blocked by:** M2b, M2c, M2d, M3.1, M4.1, M6

- [ ] Other players' hands redacted
- [ ] Gold redacted where the design calls for hidden treasuries (if any)
- [ ] Face-down schemes redacted before reveal
- [ ] Secret war dials redacted before reveal
- [ ] A client for seat N cannot see seat M's hidden fields in the state it receives

## M8 — UI legibility pass

**What to build:** Make the debug harness UI readable for real players —
function over form, no visual design investment. Needs the final turn/phase/
action surface from every prior ticket.

**Blocked by:** M1, M2a, M2b, M2c, M2d, M3.1, M3.2, M4.1, M4.2, M4.3, M5.1, M5.2, M6, M7

- [ ] Clear phase/turn banner
- [ ] Whose turn it is, shown plainly
- [ ] Only available actions are shown/enabled
- [ ] Favor/prestige visible at a glance
- [ ] A readable log
- [ ] A new player can tell whose turn it is, what they can do, and the current scores without reading the code
