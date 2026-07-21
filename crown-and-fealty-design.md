# CROWN & FEALTY
*A game of medieval internal politics for 4–6 players (1 King + 3–5 Dukes)*

**Design document v0.2 — working draft**
*(v0.2 changes: crown auction moved to core setup; offices restructured for scarcity at all player counts; "duke-only" cards eliminated in favor of self-policing "Crown-only" cards; failed-rebellion Favor lock replaced with a one-year cooldown; duchy wars explicitly deferred post-launch.)*

> **v0.3 — implementation rulings.** Inline `Resolved v0.3:` notes below settle
> questions the doc previously left silent or ambiguous, so the rules text agrees with
> the code being built. Rationale for the load-bearing ones lives in `docs/adr/`;
> project vocabulary lives in `CONTEXT.md`.

---

## 1. Design Pillars

1. **Land = Power.** Provinces produce tax and levies. Everything — war, favor, rebellion — flows from who holds which land.
2. **Loyalty is a choice, and both loyalty and treason must be winnable.** A duke who never rebels should have a real path to victory, otherwise every game degenerates into "gang up on the king in round 2."
3. **The crown is a burden and a prize.** Wearing it earns you points every round, but it paints a target on your back and saddles you with obligations.
4. **Timing is the game.** The core skill for dukes is reading *when* to strike (or when to double down on loyalty). The core skill for the king is keeping the dukes divided just long enough.
5. **Not everything is war.** Taxes, offices, marriages, gifts, and schemes matter as much as armies.

---

## 2. How Players Win (the answer to your open question)

This borrows the single best idea from **Oath: Chronicles of Empire and Exile**, adapted to a shorter euro-style structure, and combines it with **El Grande / Inis**-style per-round scoring.

**Everyone scores Prestige. Most Prestige at the end of Year 6 wins.** But Prestige sources are asymmetric:

### The Crown pays rent
At the end of every Year, **whoever wears the Crown scores 3 Prestige**. This is the single biggest recurring income in the game. It means:

- The king doesn't need a separate win condition — he just needs to *survive*. Every year he keeps the crown, he pulls ahead.
- A usurper who takes the crown in Year 4 starts collecting that rent for Years 4–6 *and* gets a one-time **+4 Prestige "Usurper" bonus**. Rebelling early is tempting but hard to hold; rebelling late may not leave enough years of rent to catch up. This creates the timing tension automatically.

### The loyal path: the Heir
At the end of the game, the **King designates his Heir**: the duke with the highest Favor (see §6). The Heir scores **+5 Prestige**. A failed rebel can never be Heir (rebellion locks your Favor at the bottom).

> **Resolved v0.3:** on a Favor tie for Heir, break it deterministically — most
> provinces held, then lowest seat number. No end-game player choice (avoids a
> kingmaker moment at the finish).

This is the crucial piece: it makes "be the king's best friend" a genuine competing strategy, and it makes the dukes compete *with each other* for the king's affection instead of forming an automatic anti-king bloc. It also gives the king a carrot to dangle in negotiations ("support me in this war and I'll remember it").

### Other Prestige sources (both roles)
| Source | Prestige |
|---|---|
| Holding the Crown, per year | +3 |
| Usurping the Crown (one-time) | +4 |
| Being Heir at game end | +5 |
| Each province you hold at game end | +1 |
| Holding a Great Office, per year (§8) | +1 |
| Winning an external war (king +2; each duke who met or exceeded his levy duty +1) | +2 / +1 |
| Kingdom at peace all year, no rebellion (king only — "just rule") | +1 |
| Certain Court cards (tournaments, cathedrals, royal weddings) | +1 to +2 |
| Failed rebellion (the rebel leader) | **−3** |
| Losing an external war (king) | **−2** |

Rough math check (6-year game): a king who holds the crown all game with a mid-size domain lands around 3×6 + offices/wars + ~6 land ≈ 26–30. A successful Year-4 usurper: pre-rebellion income + 4 + 3×3 + land ≈ comparable. A maxed-out loyal Heir with granted lands and an office: ≈ comparable. Tune the constants in playtesting, but the *structure* guarantees all three archetypes are in the same band.

### Game end
Fixed at the end of **Year 6** (5 years for a faster game). No early-end trigger — a fixed horizon is what makes end-game rebellion math readable, and the last-year "do I strike now?" crescendo is the finale you want.

---

## 3. Components

- **Map board** of the Kingdom: ~20 home provinces grouped into 5–6 duchies plus the **Crownlands** (the king's starting domain, containing the Capital). Each province shows **Tax value (1–3 gold)** and **Levy value (1–3 troops)** and one **building slot**.
- **3 Foreign Kingdom boards** (small, placed at the map edges): each a column of 4–5 face-down province tiles with a printed **Garrison strength** on the stack. These are the conquest targets.
- **~110 Court cards** (the shared draft deck — actions, schemes, characters, decrees; §9).
- **Player screens** (one per player — you have hidden gold and hidden troop commitments).
- **Troop cubes** (~25 per player color) and a bag of **gold coins**.
- **Crown token** (physical, chunky, passes between players — this should feel great to take).
- **4 Great Office tokens:** Marshal, Steward, Chancellor, Spymaster.
- **Favor board:** one column per duke, a track from **−3 (Furious)** to **+3 (Devoted)**, with a marker per duke. Public information.
- **Casus Belli tokens** (small red seals the king places on a duke's Favor column).
- **Prestige track** around the board edge (score openly, El Grande-style).
- **Year track** (1–6) with a phase reminder strip.
- **Building tokens:** Markets (+1 Tax) and Castles (+1 Levy, +1 defense in that province).
- **Battle dial or commitment cards 0–10** per player (for secret simultaneous troop commitment, GoT-style).

---

## 4. Setup

1. **Auction the Crown.** Players bid in **negative starting Prestige** (i.e. how big a Prestige debt you'll accept to begin as King). Highest bid wins the throne and begins the game at −(bid) Prestige.
   > **Resolved v0.3:** the auction is an **open ascending (English) auction** —
   > players raise the Prestige-debt bid in turn until all but one pass; the last
   > bidder is crowned at −(bid). No hidden info needed, fits the shared screen. This is self-balancing: the crown always sells for what it's currently worth, and it establishes from turn zero that the throne is a priced asset, not a gift. The winner becomes **King**, takes the Crown, the Crownlands (4 provinces + Capital; Capital is Tax 3 / Levy 2, always travels with the Crown, and can never be granted away), and 6 gold.
2. Each duke takes one duchy of **3 provinces** and 4 gold. Any duchies not taken by a player are ruled by **minor lords**: their provinces are neutral and can be handed out one at a time via the **Grant Charter** action (a slow trickle of patronage even in peacetime).
3. Everyone places troop cubes equal to half their total Levy value (round up) — standing armies start small.
4. All Favor markers start at **0**.
5. The King does **not** pre-appoint offices. Offices are granted live during play (see §8) — the Marshal is the King's by default; only the civilian offices are grantable. Granting one mid-game is a public act of favoritism that lands when it stings.
6. Shuffle the Court deck.

---

## 5. The Year (round structure)

Each Year has five phases:

### Phase 1 — Council
The King may put up to **2 Proposals** to the council. Some things are **Royal Prerogative** (no vote needed), some require a **Council Vote**:

| Royal Prerogative (king just does it) | Council Vote required |
|---|---|
| Declare external war | Change the Tax Law (low/medium/high) |
| Grant a province / office / title | Change the Levy Law (low/medium/high) |
| Designate favorites, host tournament | Royal Revocation *with* a Casus Belli is prerogative; *without* one it needs a vote |
| | Special decrees from Court cards |

**Voting:** one vote per player. The **Chancellor's vote counts double**. The **King breaks ties**. Votes are cast openly, and open bribery is not just allowed but expected (**Junta** is the patron saint of this phase — deals, payments, and promises are all legal; only payments made *right now* are binding).

> **Resolved v0.3:** the King **casts a normal vote AND breaks ties** — uniformly, on
> *every* vote including a Revocation without a Casus Belli (ADR-0002). This leans
> king-favorable (with 3 dukes, King + Chancellor beats the other two), and makes the
> Casus Belli a *convenience* rather than a hard gate on taking land. Binding bribery
> is a bare `transferGold` between players (no Favor effect); only cash moved now
> counts (ADR-0004).

- **Raising the Tax or Levy Law:** −1 Favor from every duke who voted against it and lost.
- **Lowering it:** +1 Favor from every duke.

### Phase 2 — Draft
Deal each player **5 Court cards**. Pick 1, pass the rest left; repeat until everyone has 4 (**Inis**-style). This is your "not fully random cards" requirement: you shape your hand, you gain hidden information about what you passed and what never came back around, and watching the king snap up *Mercenary Company* tells everyone something.

### Phase 3 — Actions
Going clockwise from the King, players take turns doing **one action at a time** until everyone has taken **3 actions** (pass to hold actions in reserve — held actions can be used as *reactions* during Phase 4, which makes passing early a threat rather than a forfeit).

> **Resolved v0.3:** the loop is **round-robin, one action per turn**, clockwise from
> the King, until each seat has spent 3 actions or declared **done** (ADR-0001). In the
> first build, "pass" means **done for the phase** and unspent actions are **forfeited** —
> the *reactions-into-Phase-4* mechanic is deferred to a later milestone (a `heldActions`
> seam is left in state, unused).

**Basic actions (always available):**
- **Muster:** pay 1 gold per troop, add troops up to your total Levy cap.
- **Build:** pay 3 gold, place a Market or Castle on an empty slot in your province.
- **Send Gift:** pay 2 gold to the King (or, as King, to a duke): +1 Favor on that track. (Diminishing: max +1 Favor from gifts per relationship per year.)
- **Petition / Hold Court:** draw 2 Court cards, keep 1.
- **Play a Court card** from your hand (most cards are actions).
- **Scheme:** play a Scheme-type card **face down** in front of you. It resolves when its trigger occurs (e.g., *"Reveal when a battle is declared: +3 to your side"*). Face-down cards are the paranoia engine. The **Spymaster** may peek.

### Phase 4 — Wars & Rebellion
Resolve, in order: (a) the external war if one was declared, (b) any **Rebellion**, which any duke may declare at the start of this phase (or as a reaction to a Revocation). Details in §7 and §10.

### Phase 5 — Harvest
- Every player collects **Tax gold** from their provinces.
- Every duke pays the crown per the **Tax Law**: Low = 1 gold per duke, Medium = 1 gold per 2 provinces held, High = 1 gold per province. A duke **may refuse to pay** (openly): −1 Favor and the King places a **Casus Belli** on him.
  > **Resolved v0.3:** refusing is an **explicit choice** each Duke makes at Harvest
  > (Harvest is no longer fully king-automatic). Refuse = keep your gold, −1 Favor +
  > the King gains a Casus Belli. A Duke who *wants* to pay but is simply too poor pays
  > what he can with **no penalty** — poverty is not treason.
- Score yearly Prestige: Crown +3, Offices +1 each, "just rule" +1 if applicable.
- Advance the Year marker. Discard down to 2 cards in hand.

---

## 6. Favor (the opinion tracker)

One public track per duke, −3 to +3, measuring the *relationship* between that duke and the current king. It moves when either side acts:

**Up:** gifts (+1, max +1 from gifts per relationship per year), land grants (+2 per province), being granted an office (+1), *exceeding* your levy duty in a war (+1). Voting is its own reward/punishment via the law changes below, so keep vote-buying to gold rather than Favor.

**Down:** refusing taxes (−1), under-committing levies (−1), voting down raised while... (covered above), king revokes your province (−2), king loses an external war (**−1 with every duke** — nothing erodes loyalty like a weak king), king grants a province you formally Claimed (§9) to someone else (−1).

**What Favor does mechanically:**
- **+3 (Devoted):** this duke's troops add +1 strength per 3 cubes when fighting *for* the king (élan).
- **−3 (Furious):** the king gains a permanent Casus Belli against this duke; this duke pays **no Favor penalty** for joining a rebellion.

> **Resolved v0.3:** a Casus Belli is a **binary flag** per Duke (one strike is the
> same as three). It is set as an *earned* flag by tax-refusal or under-committing a
> levy — cleared when spent on a Revocation — or conferred as a *standing* flag while
> the Duke sits at −3 (recomputed, so a Furious Duke stays permanently revocable even
> after a Revocation drops him deeper).
- **Highest Favor at game end = Heir** (+5 Prestige).
- **When the crown changes heads, all Favor markers reset to 0** — the new king starts with a blank ledger, which is exactly why usurping late is risky for *him* too (no time to build a loyal court).

---

## 7. External War

1. **Declaration (Phase 1, prerogative):** King picks a Foreign Kingdom and announces the war. The target's **Garrison strength** is printed and public (e.g., Kingdom of the Vends: strength 12, provinces worth ~9 tax/levy total).
2. **The Call to Arms:** each duke owes troops per the **Levy Law**: Low = ⅓ of his Levy value, Medium = ½, High = all (round down). 
3. **Secret commitment (Phase 4):** everyone — king included — secretly sets a number on their dial: how many of their actual troop cubes they send. Reveal simultaneously (**GoT: The Board Game**'s best trick). 
   - Committed ≥ duty → fine; committed *more* than duty → +1 Favor.
   - Committed less → **−1 Favor + Casus Belli**, publicly branded disloyal.
   > **Resolved v0.3:** duty = `floor(levyLaw × your provinces' Levy value)`. You are
   > branded only if you **held cubes back** and still fell short — committing **every
   > cube you own** always counts as dutiful, even if the number is below duty
   > (ADR-0003). Everyone, King included, commits secretly and reveals together.
4. **Resolution:** total committed troops + revealed Schemes/war cards vs. Garrison strength (+ its own event modifier card, drawn from a tiny deck of −1/0/+1/+2 so the outcome is *nearly* deterministic but a razor-thin war can still go wrong — punishes arrogance, not planning).
   > **Resolved v0.3:** the modifier deck is `[-1, 0, 1, 2]` (config `warModifierDeck`).
   > **Ties go to the defender** — the attacker must beat the garrison *outright*
   > (`committed > garrison + modifier`) to win (ADR-0003).
5. **Victory:** flip the foreign provinces face up; they join the map. Casualties: every participant loses **1 cube per 4 committed** (round down) — war is never free. King +2 Prestige, dutiful dukes +1 each.
6. **Distribution — the heart of your design:** The King has a **Domain Limit = 5 provinces** (6 with the Steward in his own... no — Steward is a duke's office; the king's Domain Limit is a flat 5, Capital included). Conquered provinces beyond his limit **must all be granted to dukes before the end of Phase 5**, +2 Favor per grant. He chooses freely — rewarding loyalists, buying off threats, or (dangerously) making one duke mighty. Any province he *cannot* legally keep and *refuses* to grant is sacked: removed from the game and −1 Favor with everyone (nobody respects a miser).
7. **Defeat:** all committed troops on the losing side take **double casualties (1 per 2 cubes)**; the king pays **3 gold reparations** (borrowing from dukes at their price if he can't — a delicious negotiation); the enemy **occupies 1 border province of the king's choice from his own domain** (flip it face-down; it can be re-conquered later); King −2 Prestige and **−1 Favor with every duke**. A lost war is the classic rebellion window — exactly as it should be.
   > **Resolved v0.3:** "borrowing" is not a tracked loan — a King short on reparations
   > simply goes into **negative gold** (a visible debt paid down by later Harvests); a
   > Duke may cover it with a bare `transferGold`, but repayment terms are table-trust
   > the app never enforces (ADR-0004).

The dukes' dilemma writes itself: fully backing the king's war strengthens the realm and earns Favor and Prestige, but every cube you send is a cube not defending you, and a victorious king with fresh land to grant gets *stronger*. Sandbagging keeps you strong but brands you — and hands the king a legal pretext.

---

## 8. Great Offices & Titles

The king's non-land patronage currency — and deliberately scarce, so that *someone* is always left out. There are four offices, but the **Marshal is the King's by default** (he commands his own host), leaving only **the three civilian offices as grantable**, of which the king may seat at most **two per game** unless he gives up the Marshal himself. Net effect: at 3 dukes one duke is always excluded; at 5 dukes three are. The tension isn't "will I get an office" — it's "will I get *the good one*, and who did he snub to give it away." Each seated office gives its holder +1 Prestige/year, plus:

- **Marshal (King's by default):** +2 strength to any side he fights on; may Muster at half cost. The King *may* grant it to a duke to buy a third loyalty — but then his own wars and his own defense in a rebellion lose that +2. Handing a rival command of the army is the loaded choice that replaces the old setup-appointment moment.
- **Steward:** collects +1 gold per year per 3 provinces he holds; his refusal to pay taxes costs no Favor once per game ("creative accounting").
- **Chancellor:** vote counts double; once per year may move any one Favor marker ±1 (whispers at court).
- **Spymaster:** may look at one face-down Scheme per year; and once per year may force one player to reveal their war dial *before* others commit.

Offices are granted **live during play** (Council phase, prerogative), never pre-assigned at setup — the slight lands mid-game when it hurts. The king may **reshuffle** them, but stripping an office is **−2 Favor** with the ex-holder. Offices let the king keep a powerful duke happy *without* feeding him land — the safe patronage. **Honorary titles** (cards: *Defender of the Faith*, *Warden of the East*...) are one-shot +1 Favor, +1 Prestige grants — small change for small debts.

> **Resolved v0.3:** all office **active** abilities are in scope for the first build —
> Marshal +2 (both battle types) + half-cost muster; Steward gold + one free tax
> refusal/game; Chancellor double-vote + move a Favor marker ±1 once/year; Spymaster
> peek a face-down Scheme + force one war-dial reveal, each once/year.

---

## 9. Court Cards (the deck, ~110 cards)

Five card types, ~evenly mixed so drafts always offer real choices. **There are no "duke-only" cards** — a king is a landholder too and can do anything a duke can. A handful of cards are **Crown-only: playable only while you hold the Crown.** A duke who drafts one is either *hate-drafting* to keep it out of the king's hand, or **banking it against the day he seizes the throne** — hoarding royal decrees while he waits. This keeps the deck shared and self-policing: no draw is ever wasted, and nothing needs separate decks. A few cards also carry **split text** ("if you hold the Crown: X; otherwise: Y") so they still do something useful in a duke's hand.

1. **Actions** (~35): *Forced Levy* (muster 3 free troops, but it angers your peasants: lose 1 tax next Harvest), *Royal Tournament* (**Crown-only**: +1 Favor with two dukes of the king's choice, +1 Prestige — *split text:* a duke plays it as a local Feast, +1 Favor with the king only), *Grant Charter* (**Crown-only**: grant one neutral minor-lord province), *Tax Farmers* (+3 gold), *Diplomatic Envoy* (reduce a Foreign Kingdom's garrison by 2 this year).
2. **Schemes** (~25, played face-down): *Ambush* (+3 to your side in one battle), *Bribed Captains* (when an opponent reveals their dial, 2 of their cubes desert), *Poison the Wells* (a war's garrison +3 — playable by a duke who wants the king to *lose*!), *Forged Letters* (move any Favor marker −2 when a rebellion is declared).
   > **Resolved v0.3:** bluffing is **allowed** — *any* hand card may be played
   > face-down as a "scheme". On its trigger it resolves only if it is a genuine
   > Scheme; a bluffed non-scheme is revealed as a dud and discarded. This makes the
   > Spymaster's peek genuinely valuable (it pierces bluffs).
3. **Characters** (~25): persistent advisors placed by your board, one slot each (a **dynasty-lite** system — see §12.1 for the full module). *The Old General* (+1 strength always), *The Papal Legate* (+1 Prestige/year, but you may never under-commit levies), *The Ambitious Bride* (marriage: pick another player; you may never fight on opposite sides of a war while both characters live — a mini-alliance, breakable only by an *Annulment* card).
4. **Claims** (~15): played openly on a specific province you don't hold. If that province is ever distributed, the king grants it to you or takes −1 Favor with you; if you ever hold a Claim on a rebel's province when a rebellion is crushed, you may ask the king to award it to you. Claims are how dukes tell the king what they want — and how the king learns who is hungry.
5. **Decrees** (~10, **Crown-only to *enact***, but any player may draft and hold them): powerful, require a Council Vote. *Magna Carta* (Tax Law can never be High again — the dukes' favorite), *Royal Standing Army* (king's Domain Limit +1), *Trial by Combat* (rebellions resolve with +2 to the smaller side). A duke holding a Decree is holding a bill he can only pass once he's king.

---

## 10. Rebellion (the centerpiece)

**Who & when:** any duke, at the start of Phase 4, or as an immediate reaction when the king plays a Revocation on him. He becomes the **Rebel Leader**. Only one rebellion per year.

**Picking sides:** going around the table, every other duke declares: **Loyalist**, **Rebel**, or **Neutral**. Then negotiation happens *before* battle — the king may make binding offers (gold now, promises later are not binding — Junta rules), dukes may extort. A player may change their declaration once during this bargaining window; then it locks.

> **Resolved v0.3:** the flow is two explicit steps — (1) each Duke declares a side in
> order, then (2) one **renegotiation pass** in which a Duke may switch side **at most
> once** and the King may `transferGold`, after which every side **locks** and the
> battle resolves. Binding offers are cash-now only (ADR-0004).

**The battle:** total troops on each side (all troops, not committed subsets — civil war is total) + Marshal + Schemes + Castles (each Castle on a defender-side province +1). Larger total wins. No randomness in civil wars — regicide should never come down to a die.

> **Resolved v0.3:** on an **exact tie the King (defender) holds** — the rebel must
> *exceed* the crown's total to win (ADR-0003). Each **Castle adds +1 to its owner's
> coalition** (Loyalist castles help the King, Rebel castles help the rebels;
> Neutral-owned castles count for no one), overriding the literal "defender-side"
> wording. The **Marshal's +2** goes to whichever side its holder fights on; a Neutral
> Marshal contributes nothing.

**If the Rebels win:**
- Rebel Leader takes the Crown (+4 Prestige, starts collecting crown rent). All Favor resets to 0.
- The new king may **strip up to 2 provinces from each Loyalist** duke and 1 from the deposed king (who keeps his Capital-less rump — the Capital transfers with the Crown, actually cleaner: **the Capital province always belongs to the crowned player**; deposed king keeps his other domain provinces up to the duke-size of 3, excess is stripped automatically).
- Stripped provinces **must be distributed among the winning coalition** (Domain Limit still applies). Rebellion allies who get stiffed remember it — the knife you rode in on cuts both ways.
- Everyone loses 1 troop cube per 4 (civil wars bleed the realm).

**If the King wins:**
- Rebel Leader: −3 Prestige, king strips **2 provinces** from him. Other rebels: king strips **1 province** each. Stripped land goes to Loyalists first (+2 Favor each), then to the king up to his limit.
- All rebels' Favor drops to **−3**, with a **one-year cooldown**: it stays at −3 through the *next* Harvest and cannot be raised until then, after which it recovers normally (~+1/year via gifts). No permanent lock and no Heir bar — a crushed rebel *can* claw back into favor and, in principle, even become Heir, but the climb from −3 plus the −3 Prestige hit makes it a long, costly road, not a free reset. The door is open, barely.

**Neutrality:** you lose nothing and gain nothing in the battle — but the *winner* marks each Neutral duke **−1 Favor** (if the old king wins) or starts them at −1 instead of 0 (if a new king is crowned). Sitting out is safe, never free.

**Anti-dogpile / anti-snowball levers** (your balance worry, answered):
- The Heir prize means at least one duke usually profits more from the king *surviving*.
- Favor reset on usurpation means a new king has no loyal base — he's immediately as vulnerable as the man he toppled.
- The Domain Limit means no king, old or new, can hoard the map.
- The −3 Prestige hit plus the Favor collapse and one-year cooldown make speculative early rebellions genuinely bad bets, not free rolls.

---

## 11. Revocation (the king's knife)

Royal Prerogative **if** the king holds a Casus Belli on that duke (from refused taxes, under-committed levies, or −3 Favor); otherwise it needs a Council Vote (and dukes rarely vote to let kings take land — that's the point).

Target duke chooses:
1. **Submit:** the king takes 1 province of the duke's choice from him (min tax value... no: of the *duke's* choice — you comply, but you pick which finger to lose). Spend the Casus Belli. −2 Favor.
2. **Defy:** immediate Rebellion with this duke as Rebel Leader (§10).

> **Resolved v0.3:** with the uniform king-favorable vote (§5, ADR-0002), a Revocation
> *without* a Casus Belli can still often pass by vote — so the CB's real value is
> skipping the vote (prerogative), not being the only path to taking land.

The Revocation is the king's tool for cutting an over-mighty vassal down *before* he's ready — and the vassal's chance to start the war on his own terms. Both sides get to force the timing question. This is the single most Crusader Kings moment in the game.

---

## 12. Optional Modules

### 12.1 Dynasty module (full)
Each player's Characters form a small family tableau: a Ruler card plus up to 3 kin. Each Year-end, roll... no dice — each Year-end, reveal the top card of a small **Chronicle deck** (births, deaths, plagues, scandals) affecting the *oldest* character in each tableau by seniority rules printed on the card. Marriages between player dynasties create the non-aggression bond from §9. If your Ruler dies with no kin, you draft a successor Character but lose 2 Prestige (succession crisis). **Recommendation: ship as a module, not core.** It's superb flavor but adds a full subsystem; your instinct that it might overcomplicate is right. The Character cards in the core deck give you 70% of the flavor for 10% of the rules.

### 12.2 Duchy wars — *deferred: do not add until the base game works without it*
A duke may declare war on a *neighboring* duke during Phase 1 by petitioning the king, who rules **Permitted** (they fight in Phase 4 with secret commitments; winner takes 1 border province; both belligerents cost the king his "just rule" +1 that year) or **Forbidden** (+1 Favor with the defender, −1 with the petitioner; attacking anyway is an automatic Casus Belli against the petitioner). Gives the king a Solomon role and dukes a second aggression outlet. **This is explicitly a post-launch add-on.** The core loop — king vs. dukes, external war, rebellion — must prove balanced and fun on its own first; duke-vs-duke war multiplies the interaction space and could mask base-game problems during early testing. Revisit only once the base game is solid.

### 12.3 The Automa King (your fallback)
Only if human-king balance fails in testing: the AI King follows a priority chart — always declares war in odd years, always grants conquests to the *highest-Favor* duke first, revokes from any duke at −3, raises taxes after a lost war. Dukes compete purely on Prestige; game ends when the AI King is overthrown or Year 6 ends. **Recommendation: build this only as a 2–3 player variant.** The human king is the soul of the design — Oath, Junta, and GoT all prove asymmetric thrones are balanceable, and your Heir mechanic is the balancing tool they lacked.

### 12.4 *(moved to core)*
Auctioning the Crown is now part of base setup (§4, step 1) rather than a variant.

---

## 13. Prototype Numbers (first playtest targets)

- 6 Years; 20 home provinces (Crownlands 5 incl. Capital, four duchies of 3, 3 minor-lord provinces); province values: eight 1s, eight 2s, four 3s per stat, distributed so no starting duchy exceeds 6 total tax or 6 total levy.
- Foreign Kingdoms: Weak (garrison 8, four provinces), Middle (12, four), Rich (16, five, high values).
- Starting gold: King 6, dukes 4. Troop cost 1g. Building 3g. Gift 2g.
- Crown rent 3 / Usurper 4 / Heir 5 / province 1 / office 1 — tune these five numbers before anything else; they *are* the game balance.
- Target play time: 90–150 minutes.

## 14. Known Open Questions (for playtesting)

1. **Kingmaking in Year 6.** A hopeless duke can decide the final civil war. Partial mitigations already in: Neutral option, locked-Favor rebels still want *someone specific* to win. Watch it.
2. **Does the king have enough to *do* in Phases 2–3**, or is he purely reactive? Possible fix: king gets a 4th action.
3. **Is 3 Prestige/year crown rent right for 4 vs 6 players?** May need to scale: rent = players − 2.
4. **Politics of exactly 2 dukes** (4p... 3p total) is thin — likely set minimum at 1 king + 3 dukes.
5. **Should Schemes be bluffable** (play any card face-down as a fake Scheme)? Probably yes — cheap poker.

## 15. Inspiration Ledger (what was stolen, and from where)

| Problem | Solved by | Borrowed |
|---|---|---|
| Asymmetric ruler vs. subjects who can win loyally *or* by usurping | **Oath** | Crown-holder scoring + Heir/successor victory |
| Ruler distributes spoils, others coup | **Junta** | Binding-cash-only negotiation, coup rhythm |
| When to switch loyalty | **Pax Pamir 2e** | Betrayal-timing as the core skill |
| Hidden military commitment | **A Game of Thrones: TBG** | Secret simultaneous dials |
| Cards with agency, hidden info from drafting | **Inis** | Pick-and-pass draft each round |
| Holding power scores per-round | **El Grande / Inis** | Yearly crown rent instead of end-only scoring |
| Voting with open bribery | **Junta / Republic of Rome** | Council phase |
| Land = engine | **every 4X ever** | Tax/levy printed on provinces |
