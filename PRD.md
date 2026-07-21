# Crown & Fealty — Implementation PRD

**Audience:** an AI coding agent (Claude Code) finishing a partially-built board-game
prototype. **Human owner is a JS beginner**, so favor clarity, small commits, and
leaving the app runnable at every step over cleverness.

---

## 0. How to use this document

1. Read, in this order: `crown-and-fealty-design.md` (the game's rules — the *what*),
   this PRD (the build plan — the *how* and *in what order*), then `README.md`
   (run instructions + file map).
2. **Put `crown-and-fealty-design.md` in the repo root** if it isn't already, so you
   can reference rule sections (§) directly. If it's missing, ask the owner for it —
   do not invent rules.
3. Work **one milestone at a time, in order**. After each, run `npm run dev`, confirm
   the acceptance criteria, and `git commit`. The app must stay runnable after every
   milestone — never leave it in a broken state between sessions.
4. When a rule is ambiguous or underspecified, **stop and ask** rather than guessing.
   Several design questions are genuinely unresolved (see §7). Do not silently pick.

---

## 1. Goal

Turn the current skeleton into a **playable hotseat prototype** of the full core loop:
real phase structure and turn-taking, working card play, and complete War and
Rebellion resolution — enough to sit 4–6 people around one screen and play a full
6-year game where the rules are enforced by the app, not by the players' memory.

Out of scope for now: networked multiplayer, art, animation, AI opponents, the
optional modules (dynasty, duchy wars). Those come after the core loop is fun.

---

## 2. Current state (ground truth — verify against the code, don't trust this blindly)

**Working:**
- Full year cycle as boardgame.io phases: `council → draft → actions → warAndRebellion → harvest → council`, ending at Year 6 (`src/game/game.js`, `endIf`).
- Economy: income, muster, build (market/castle), gifts (`src/game/moves.js`).
- Favor tracks + consequences; scoring spine (crown rent, offices, just-rule, end-game land + Heir) in `src/game/scoring.js`. This is verified to produce sane numbers — **do not regress it.**
- Offices with scarcity (Marshal = king's by default; 2 civilian seats).
- Basic War and Rebellion resolution (troop totals → outcome, crown transfer, favor reset on new reign, failed-rebel penalty).

**Stubbed / missing (the work):**
- **Turn model** is `activePlayers: ALL` — any seat acts anytime. This is the #1 reason it doesn't feel like a game.
- **Draft** is a straight deal, not Inis-style pick-and-pass.
- **Card effects**: only `gold3` and `forcedLevy` are implemented in `playCard`; the rest just log. Schemes/claims/characters/decrees are not really playable.
- **War**: no levy-duty calc, no conquest distribution honoring Domain Limit, no border occupation on loss, no reparations borrowing.
- **Rebellion**: no side-picking (loyalist/rebel/neutral), no negotiation window, no castle/marshal/scheme bonuses, no land-stripping distribution.
- **Council voting**: laws are set directly by the king; no vote.
- **Crown auction** at setup (seat 0 is simply king).
- **Hidden info** (`playerView` returns full state).

Search the codebase for `TODO(` — every stub is tagged.

---

## 3. Guardrails (read before touching code)

- **Config-driven.** Every balance number lives in `src/config.js`. Never hard-code a
  number in rules logic; add it to `CONFIG` and read it. If you introduce a new tunable,
  put it in `CONFIG` with a comment.
- **Don't break the scoring spine.** `scoring.js` is verified. If you change it, re-run
  the dry-run check in §6 and confirm numbers still make sense.
- **boardgame.io conventions** (v0.50+):
  - Move signature: `myMove({ G, ctx, playerID, events, random }, ...args)`. Mutate `G`
    directly (immer is on). Return `INVALID_MOVE` (from `boardgame.io/core`) to reject.
  - Use `events.endTurn()`, `events.endPhase()`, `events.endStage()` for flow — never
    mutate `ctx`.
  - Randomness must go through the `random` plugin (`random.Shuffle`, `random.Die`,
    `random.Number`), never `Math.random()`, or multiplayer/replay will desync.
  - Phase-scoped moves live in that phase's `moves`. Stage-scoped moves live in
    `turn.stages.<name>.moves`.
- **Keep it runnable.** After each milestone the app boots and a full game is playable
  to completion. Prefer a working partial feature over a broken complete one.
- **Small commits**, one per task where practical, with messages like
  `feat(war): implement conquest distribution (§7.6)`.
- **Comment with rule references.** When you implement a rule, cite its section, e.g.
  `// §10: crushed rebel drops to favor floor with cooldown`.

---

## 4. Milestones (do in order)

### M0 — Baseline & safety net
**Goal:** confirm the current build runs and lock in a way to verify you haven't broken scoring.
- Run `npm install && npm run dev`; play one full 6-year game via the debug panel; confirm a winner is declared.
- Add a minimal test: a Node script (or Vitest if you set it up) that imports `setup` + `scoring`, simulates 6 harvests, and asserts the king's prestige and final scores are in expected ranges. Wire it as `npm test`.
- **Acceptance:** `npm run dev` boots clean; a game reaches "Game over" with scores; `npm test` passes.

### M1 — Real turn structure & phase flow  ← **highest priority; this is what makes it a game**
**Goal:** replace `activePlayers: ALL` with proper per-phase turn control so players act only when it's their turn and only on legal moves. Follow design §5.
- **Council:** only the crown-holder is active. Other seats cannot act. (Set active player = `G.crownHolder` via phase `onBegin` + `turn.activePlayers`, or a single-player turn whose current player is forced to the king.)
- **Draft:** all players active simultaneously for the pick step (see M2).
- **Actions (§5 Phase 3):** sequential turns **clockwise starting from the king**. Each player takes **up to `CONFIG.actionsPerTurn` (3)** actions, then their turn passes. A player may **pass** to hold remaining actions as **reactions** usable during Phase 4 (model held actions as a counter on the player; reactions can come later — at minimum implement pass-ends-turn and the 3-action cap enforced by turn flow, not just the `actionsLeft` counter).
- **War & Rebellion (§5 Phase 4):** see M3/M4 for who's active when.
- **Harvest:** automatic; no player input except the king advancing (or auto-advance).
- Update `Board.jsx` so controls for a seat are only shown/enabled when that seat is active. Show a clear "waiting for seat N" state.
- **Acceptance:** you can no longer take a duke action during the king's council; in Actions, turns visibly pass player-to-player and stop each player at 3 actions; a full game still completes.

### M2 — Cards: drafting + effects
**Goal:** make cards a real system. Design §9.
- **Draft (§5 Phase 2, Inis-style):** deal 5, each player picks 1 and passes the rest, repeat until each holds 4. Implement pick-and-pass with the `random` plugin for the initial shuffle/deal. Discard leftovers.
- **Deck:** expand `CARDS` in `data.js` toward the real spread (§9 lists ~110 across 5 types; start by fleshing out to ~30–40 with several copies, balanced across types). Keep the `{ type, name, crownOnly, effect, text }` shape.
- **`playCard` effects:** implement the `effect` switch for every card in the deck. Categories:
  - **Actions:** immediate effects (gold, muster, garrison reduction, tournament, charter). `crownOnly` cards playable only by the crown-holder; a duke may *hold* them (bank for a coup) but `playCard` returns `INVALID_MOVE` — keep that rule.
  - **Schemes:** played **face-down** (already stored in `player.schemes`); resolve on a trigger (battle declared, dial revealed, rebellion declared). Implement a reveal/resolution hook invoked from War/Rebellion resolution.
  - **Characters:** persistent; place in `player.characters` and apply their passive modifiers where relevant (e.g. `general` +1 strength in battles, `legate` +1 prestige/year in `runHarvest` + a no-under-commit constraint).
  - **Claims:** played openly onto a province id (`player.claims`); enforce the §9 payoff (king must grant or take −1 favor; claim on a crushed rebel's province is grantable to the claimant).
  - **Decrees:** require a council vote (M5) to enact; `crownOnly` to enact but any seat may hold.
- **Acceptance:** a real draft occurs each year; every card in the deck does what its text says when played; crown-only cards are unplayable by dukes but stay in hand; face-down schemes resolve at the right trigger.

### M3 — External War, complete
**Goal:** finish §7. Build on the existing `commitTroops`/`resolveWar`.
- **Levy duty:** compute each duke's owed troops from `CONFIG.levyLaw[G.levyLaw]` × that duke's total levy value (floor). Committing ≥ duty is fine; **exceeding** it → +1 favor; **under** → −1 favor **and** place a Casus Belli (`G.casusBelli[duke]++`). Brand it in the log.
- **Secret commitment:** during Phase 4 war step, all participants are active and set a dial simultaneously; reveal together (a `revealWar` step). Wire scheme reveals here (Ambush, Poison the Wells, Bribed Captains).
- **Resolution:** committed strength (+ Marshal +2 if fighting, + relevant schemes/characters) vs `garrison + CONFIG.warModifierDeck` draw (via `random`). Keep casualties (§7.5).
- **Victory distribution (§7.6):** king keeps up to `CONFIG.domainLimit` provinces (Capital counts); **surplus must be granted to dukes** (+2 favor each) before the phase ends; any province he can't keep and won't grant is **sacked** (removed, −1 favor with everyone). Enforce that the phase cannot end while the king is over his Domain Limit.
- **Defeat (§7.7):** double casualties on the losing side; king pays `CONFIG.warReparationsGold` (implement **borrowing from dukes** if short — a simple prompt/loan record); enemy **occupies 1 border province** of the king's choice (flip `faceUp=false`); king −2 prestige, −1 favor with **every** duke; set `warLostThisYear`.
- **Acceptance:** dukes are scored/branded correctly by their commitment vs duty; a won war forces legal distribution and cannot be left over-limit; a lost war applies all penalties and occupies a province.

### M4 — Rebellion, complete  ← **the design's centerpiece; get side-picking right**
**Goal:** finish §10. Build on `declareRebellion`/`resolveRebellion`.
- **Trigger:** a duke declares at the start of Phase 4, **or** as a reaction to a Revocation (M5). One rebellion per year (already enforced).
- **Side-picking:** going around the table from the rebel, each other duke declares **Loyalist / Rebel / Neutral** (store `G.activeRebellion.sides`). Then a **negotiation window**: the king may make **binding** offers (gold now, transferred immediately; promises are not enforced — Junta rule). A player may change their declaration **once** during this window, then it locks.
- **Battle (§10):** total **all** troops per side (civil war is total, not committed subsets) + Marshal (+2, on the king's side unless granted away) + Castles (+1 per castle on a defender-side province) + revealed Schemes. Larger total wins; **no randomness** in civil wars.
- **Rebels win:** rebel leader takes Crown (+`usurperBonus`), Capital transfers, favor resets to 0 for the new reign; new king may **strip up to 2 provinces from each Loyalist** and auto-trim the deposed king to duke size; stripped land distributed to the winning coalition honoring Domain Limit.
- **King wins:** rebel leader −3 prestige, king strips 2 provinces from leader + 1 from each other rebel; stripped land to Loyalists first (+2 favor) then king up to limit; all rebels drop to favor floor with the `rebellionCooldownYears` cooldown (already partly implemented — extend to all rebels, not just the leader).
- **Neutral:** winner marks each Neutral −1 favor (or starts them at −1 under a new king).
- **Acceptance:** dukes can pick sides and renegotiate once; totals include castles/marshal/schemes; both win/lose branches transfer land and prestige per §10; a new king starts with a blank favor ledger.

### M5 — Council voting & Revocation
**Goal:** finish §5 Council and §11.
- **Voting:** law changes and decrees require a vote — one vote per player, **Chancellor's counts double** (`CONFIG.chancellorVoteWeight`), **king breaks ties**. Open bribery allowed (cash transfers are legal moves during the vote). Apply the §5 favor consequences (raising a law angers dissenters; lowering pleases all).
- **Revocation (§11):** king targets a duke; **prerogative if the king holds a Casus Belli** on them (or they're at favor floor), else needs a vote. Target chooses **Submit** (lose 1 province of their choice, −2 favor, spend the CB) or **Defy** (immediate rebellion with them as leader, → M4).
- **Acceptance:** laws/decrees only change via a resolved vote; Chancellor double-vote and king tiebreak work; Revocation offers submit-or-rebel and routes Defy into the rebellion flow.

### M6 — Auction the crown (setup)
**Goal:** replace fixed seat-0 king with the §4 auction.
- Add a pre-game phase: players bid in **negative starting prestige**; highest bid becomes King and starts at −(bid) prestige. Assign duchies to the remaining seats.
- **Acceptance:** the king is determined by auction; their starting prestige reflects the winning bid; the rest of setup (duchies, gold, troops) still holds.

### M7 — Hidden information (prep for multiplayer)
**Goal:** implement `playerView` in `game.js` to redact, for each seat: other players' hands, gold, face-down schemes, and secret war dials before reveal. (Local hotseat won't use it, but it unblocks networked play and prevents accidental info leaks in the UI.)
- **Acceptance:** with `playerView` active, a client for seat N cannot see seat M's hidden fields in the state it receives.

### M8 — UI legibility pass (last, and keep it modest)
**Goal:** make the harness *readable* for real players — not pretty. Clear phase/turn banner, whose turn it is, available actions only, favor/prestige at a glance, a readable log. Do **not** invest in visual design; the owner explicitly wants function over form until the loop is proven fun.
- **Acceptance:** a new player can tell whose turn it is, what they can do, and the current scores without reading the code.

---

## 5. Definition of done (for the whole PRD)

A group can play a full 6-year game hotseat where: turns pass correctly per phase;
cards are drafted and played with real effects; external wars and rebellions resolve
fully per §7/§10 including land redistribution; laws change only by vote; the crown is
auctioned at start; and the app enforces all of this without players tracking anything
by hand. Scoring spine unchanged and verified.

---

## 6. How to verify you haven't broken scoring

Run this after any change to `setup.js`, `scoring.js`, or `config.js`:

```bash
node --input-type=module -e "
import { setup } from './src/game/setup.js';
import { runHarvest, finalScores } from './src/game/scoring.js';
const G = setup({ ctx: { numPlayers: 4, playOrder: ['0','1','2','3'] } });
G.offices.steward='1';
for (let y=1;y<=6;y++){ runHarvest(G); G.year++; }
console.log('prestige', Object.fromEntries(Object.keys(G.players).map(s=>[s,G.players[s].prestige])));
console.log('final', finalScores(G));
"
```
Baseline (unchallenged king, one office to duke 1): king ≈ 30 pre-final / 35 final;
duke 1 ≈ 14 final; other dukes ≈ 3. Large deviations mean you changed the spine —
intended only if you meant to.

---

## 7. Unresolved design questions — DO NOT silently decide these

Flag these to the owner when you reach them; they affect balance, not just code:
1. **Loyal-victory path:** keep the single **Heir** bonus (highest favor at end, +5) or
   switch to a cumulative **Service track** (loyal acts bank small prestige all game)?
   The design doc leaves this open. Implement Heir for now (it's coded); leave a clear
   seam to swap in a Service track. Ask before removing Heir.
2. **Year-6 kingmaking:** a hopeless duke deciding the final civil war. Partial
   mitigations exist (Neutral option, locked favor). Surface if playtests show abuse.
3. **Crown-rent scaling:** fixed 3/year, or `numPlayers − 2`? Leave in `CONFIG`; ask
   before changing the default.
4. **Ties** (Heir favor tie, equal battle totals): current code breaks ties by lowest
   seat number arbitrarily. Confirm desired tie-breaks with the owner.

---

## 8. File map (see README for detail)

```
src/config.js        ← ALL tunable constants
src/game/data.js     ← provinces, duchies, foreign kingdoms, CARDS
src/game/setup.js    ← initial state (auction stub)
src/game/scoring.js  ← prestige + favor + harvest/final (verified — careful)
src/game/moves.js    ← all moves by phase (most stubs live here)
src/game/game.js     ← Game object: phases, turn model, endIf, playerView
src/ui/Board.jsx     ← debug harness UI
src/main.jsx         ← Client mount (debug panel on)
```
