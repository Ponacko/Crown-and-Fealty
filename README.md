# Crown &amp; Fealty — playtest harness

A rules-enforcing digital scaffold for the medieval-politics board game, built on
[boardgame.io](https://boardgame.io) + React + Vite. It is deliberately ugly: the
UI is a debug harness, not a product. All the value is in the game logic and the
single tuning file.

## Run it

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. On the right edge is the **boardgame.io debug
panel** — use it to switch which seat you're acting as (seat `0` is the King),
inspect the full state tree, and manually fire events. In local/hotseat mode the
whole state is visible, which is exactly what you want while tuning.

## The one file you'll touch most

`src/config.js` — **every balance number lives here.** Crown rent, Domain Limit,
prestige values, favor swings, law amounts, casualty rates, garrisons. Change a
number, save, and the running game picks it up. Never chase constants through the
rules code.

## What works vs. what's stubbed

**Fully wired (the vertical slice that proves the loop):**
- The full Year cycle: Council → Draft → Actions → War/Rebellion → Harvest → next year, ending at Year 6.
- Economy: gold income, mustering, building (Markets/Castles), gifts.
- Favor tracks with law/gift/grant consequences.
- **Scoring spine:** crown rent per year, office prestige, "just rule", end-game land + Heir bonus, winner declaration.
- Offices with scarcity (Marshal is the king's; only 2 civilian seats).
- A basic external war and a basic rebellion (troop totals → outcome, crown transfer, usurper/failed-rebel prestige, favor reset on a new reign).
- Revocation: Royal Prerogative when the King holds a Casus Belli (or the target is Furious), else a Council vote; the target Submits or Defies into the rebellion flow.

**Stubbed, with `TODO(...)` markers in code — your vibecoding targets:**
- `setup.js` → **auction the crown** (currently seat 0 is just king).
- `moves.js` (council) → Council law/decree voting and Revocation are wired.
- `moves.js` (draft) → **Inis-style pick-and-pass** (currently a straight deal).
- `moves.js` (war) → **levy-duty calc, conquest distribution honoring Domain Limit, border occupation on loss, reparations borrowing**.
- `moves.js` (rebellion) → **side-picking (loyalist/rebel/neutral), binding offers, castle/marshal/scheme bonuses, land stripping**.
- `moves.js` (cards) → Schemes resolve in M2c; Decrees enact via the Council
  vote in M2d; the Action, Character, and Claim cards from M2b are wired
  through `playCard`.
- `game.js` → network-safe `playerView` redacts other seats' hands, gold,
  face-down schemes, draft packs, the undealt deck, and unrevealed war dials.

## Codebase map

```
src/
  config.js        ← ALL tunable constants (start here)
  main.jsx         ← mounts the Client (numPlayers, debug panel)
  game/
    data.js        ← provinces, duchies, foreign kingdoms, card deck
    setup.js       ← builds initial state
    scoring.js     ← prestige math + favor helpers + harvest/final scoring
    moves.js       ← all player moves, grouped by phase
    game.js        ← Game object: phases, turn model, endIf
  ui/
    Board.jsx      ← the ugly debug harness
```

## Suggested first playtest

Ignore the stubs. Click through 6 years as the King (use the debug panel to act
as dukes for their gifts/musters), declare one war, trigger one rebellion, and
watch the final scores. You're not testing bluffing or card play yet — you're
checking whether the **five prestige numbers** in `config.js` put king, usurper,
and loyalist in the same ballpark. Retune and repeat. Only build out the stubs
once that core loop feels right.

## Networked / multi-device play (later)

boardgame.io ships a server for real multiplayer with hidden info. The game
state now has a network-safe `playerView`; wiring a server and multi-device
client can wait until the loop is fun. Until then, hotseat on one screen is
the fastest iteration.
```
