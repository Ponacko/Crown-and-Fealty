# Crown & Fealty

The ubiquitous language of a medieval-politics board game (1 King + 3–5 Dukes)
played as a rules-enforcing digital hotseat prototype. This file is a glossary
only — no rules math, no implementation. Balance numbers live in `src/config.js`;
the rules themselves live in `crown-and-fealty-design.md`.

## Roles & the throne

**Crown-holder**:
The single player who currently wears the Crown and collects crown rent. Starts as
the auction winner; changes only by a successful rebellion.
_Avoid_: monarch, sovereign (use "King" for the role, "Crown-holder" when precision matters).

**King**:
The role played by the Crown-holder. Always seat `0` in the current scaffold until
the crown is auctioned or usurped. There is exactly one at a time.

**Duke**:
Any non-Crown-holding player. A deposed King becomes a Duke. Dukes have a Favor track;
the King does not.
_Avoid_: lord, vassal, baron (a "vassal" is any Duke relative to the King, but "Duke" is the canonical player term).

**Reign**:
The span during which one Crown-holder wears the Crown. A new reign begins on
usurpation and resets every Favor marker to 0.

## Land

**Province**:
The atomic unit of land. Carries a Tax value (gold/year) and a Levy value (troop
capacity), and one building slot. Held by a player or neutral.

**Duchy**:
A named cluster of 3 provinces assigned to one Duke at setup.

**Crownlands**:
The King's starting domain (4 provinces + the Capital). Held by whoever is King.

**Capital**:
The single province (Kingsreach) that always travels with the Crown and can never
be granted away.

**Minor-lord province**:
A neutral, unowned province, grantable one at a time via Grant Charter.
_Avoid_: neutral land (fine informally, but "minor-lord province" is the term).

**Domain Limit**:
The maximum number of provinces the Crown-holder may personally hold (Capital
included). Surplus conquered land must be granted away or sacked.

## The opinion economy

**Favor**:
A public −3…+3 track measuring one Duke's relationship with the current King.
One track per Duke; resets to 0 for every Duke at the start of a new reign.
_Avoid_: loyalty, reputation, standing.

**Casus Belli**:
A grievance the King holds against a specific Duke, letting him issue a Revocation
without a Council vote. Modeled as a per-Duke boolean: an *earned* flag set when that
Duke refuses tax or under-commits a levy (cleared when spent on a Revocation), OR a
*standing* one conferred automatically while the Duke sits at Furious (−3) Favor
(recomputed, never "runs out" while at −3). One strike is the same as three.
_Avoid_: grievance, pretext, CB (spell it out in prose; `casusBelli` in code).

**Prestige**:
The victory-point currency. Every player scores it; most at end of Year 6 wins.
_Avoid_: points, score, VP.

**Heir**:
The Duke with the highest Favor at game end, scoring the loyal-path bonus. A failed
rebel's low Favor effectively bars this.

**Usurper**:
A Rebel Leader who wins a rebellion and takes the Crown, earning a one-time bonus.

## War & rebellion

**Levy value**:
The troop *capacity* printed on the provinces a player holds (raised by Castles). Caps
how many troop cubes they may Muster.

**Levy duty**:
The number of troops a Duke *owes* the King in an external war, a fraction of his
Levy value set by the Levy Law. Distinct from what he actually commits.

**Commitment**:
The troop cubes a player secretly dials in for a battle. Meeting or exceeding duty is
loyal; under-committing is branded disloyal (−1 Favor + Casus Belli).

**External war**:
A King-declared war against a Foreign Kingdom, resolved with secret commitments plus a
small near-deterministic modifier draw.

**Rebellion**:
A civil war a Duke (the **Rebel Leader**) starts against the King. Resolved by total
troops per side with no randomness. Other Dukes declare a **side**.

**Side**:
Each non-leader Duke's stance in a rebellion — **Loyalist**, **Rebel**, or **Neutral**.
Locks after one permitted change during the negotiation window.

**Revocation**:
The King's move to strip one province from a Duke. Prerogative if backed by a Casus
Belli; otherwise needs a Council vote. The target may Submit or Defy (→ rebellion).

## Court cards

**Action** / **Scheme** / **Character** / **Claim** / **Decree**:
The five Court-card types. Schemes are played face-down and resolve on a trigger;
Claims are placed openly on a province; Decrees need a Council vote to enact.

**Crown-only**:
A card playable only while holding the Crown. A Duke may draft and *hold* one (to
deny it, or to bank it against seizing the throne) but not play it.

**Reaction** _(deferred)_:
A held, unspent Action bankable into Phase 4. Not implemented in the first build;
passing simply ends your participation and forfeits unspent actions.
