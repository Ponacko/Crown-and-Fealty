// ==========================================================================
// MOVES — grouped by phase. The economic/scoring spine is fully implemented;
// war and rebellion RESOLUTION is deliberately simplified and marked TODO so
// you can vibecode the real §7/§10 logic against a running skeleton.
//
// Move signature (boardgame.io >=0.50): (context, ...args) where
//   context = { G, ctx, playerID, events, random, log }
// Mutate G directly (immer). Return INVALID_MOVE to reject.
// ==========================================================================
import { INVALID_MOVE } from 'boardgame.io/core';
import { CONFIG } from '../config.js';
import { CARDS } from './data.js';
import {
  provinceCount,
  adjustFavor,
  runHarvest,
  finalScores,
} from './scoring.js';

const isKing = (G, playerID) => playerID === G.crownHolder;
const card = (cardId) => CARDS.find((c) => c.id === cardId);

// ---------------------------------------------------------------------------
// PHASE 1 — COUNCIL (king proposes; laws voted; war declared; offices granted)
// ---------------------------------------------------------------------------
export const councilMoves = {
  // King changes a law. Real rules require a council vote (§5); here it's a
  // direct set with the favor consequence applied. TODO(vote): add voting.
  setLaw({ G, playerID }, which, value) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    if (which !== 'taxLaw' && which !== 'levyLaw') return INVALID_MOVE;
    const levels = ['low', 'medium', 'high'];
    if (!levels.includes(value)) return INVALID_MOVE;
    const raised = levels.indexOf(value) > levels.indexOf(G[which]);
    G[which] = value;
    // §5: raising angers dukes, lowering pleases them.
    for (const duke of Object.keys(G.favor)) {
      adjustFavor(G, duke, raised ? -1 : 1, `${which} -> ${value}`);
    }
    G.log.push(`King sets ${which} = ${value}.`);
  },

  // King grants a civilian office (scarcity enforced by grantableSeats).
  grantOffice({ G, playerID }, office, dukeSeat) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    if (!CONFIG.grantableOffices.includes(office)) return INVALID_MOVE;
    if (!(dukeSeat in G.favor)) return INVALID_MOVE;
    const seated = CONFIG.grantableOffices.filter((o) => G.offices[o] != null).length;
    if (G.offices[office] == null && seated >= CONFIG.grantableSeats) {
      return INVALID_MOVE; // no seats left
    }
    G.offices[office] = dukeSeat;
    adjustFavor(G, dukeSeat, CONFIG.favor.onGrantOffice, `granted ${office}`);
    G.log.push(`King grants ${office} to seat ${dukeSeat}.`);
  },

  // King declares an external war; resolved in Phase 4.
  declareWar({ G, playerID }, kingdomId) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    const fk = G.foreignKingdoms.find((k) => k.id === kingdomId && !k.conquered);
    if (!fk) return INVALID_MOVE;
    G.pendingWar = { kingdomId, commits: {} };
    G.log.push(`King declares war on ${fk.name} (garrison ${fk.garrison}).`);
  },

  endCouncil({ G, playerID, events }) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    events.endPhase();
  },
};

// ---------------------------------------------------------------------------
// PHASE 2 — DRAFT (§9 Phase 2: Inis-style pick-and-pass)
// Deal every seat a pack of CONFIG.draftPackSize cards; each round every
// seat keeps one, then packs pass left; repeat for CONFIG.draftPicksPerYear
// rounds and discard whatever's left in each pack.
// ---------------------------------------------------------------------------

// Called from game.js's draft phase onBegin. Returns true once the draft is
// already fully resolved (e.g. the shared deck was too depleted to deal
// anything), so the caller knows to end the phase immediately.
export function dealDraftPacks(G, ctx, random) {
  const seats = ctx.playOrder;

  // §9: "a real draft occurs every year" — reshuffle the discard pile back
  // into the deck if it can't cover a full deal, rather than letting the
  // draft quietly run dry over a 6-year game.
  const needed = seats.length * CONFIG.draftPackSize;
  if (G.deck.length < needed && G.discard.length > 0) {
    G.deck.push(...random.Shuffle(G.discard));
    G.discard = [];
    G.log.push('Deck depleted — reshuffled the discard pile back in.');
  }

  G.draftRound = 1;
  G.draftPicksThisRound = {};
  G.draftPacks = {};
  for (const seat of seats) {
    G.draftPacks[seat] = G.deck.splice(0, Math.min(CONFIG.draftPackSize, G.deck.length));
  }
  G.log.push(`Draft begins: each seat dealt a ${CONFIG.draftPackSize}-card pack.`);
  return settleDraftRound(G, seats);
}

// Once every seat has either picked this round or has nothing left to pick,
// pass packs left (in seating order) and start the next round — or, past
// the final round, discard the leftovers and end the draft. Loops so a
// thin/exhausted deck (packs empty for everyone) cascades straight through
// to the end instead of stalling. Returns true once the draft has ended.
function settleDraftRound(G, seats) {
  for (;;) {
    for (const seat of seats) {
      if (G.draftPacks[seat].length === 0) G.draftPicksThisRound[seat] = true;
    }
    if (!seats.every((s) => G.draftPicksThisRound[s])) return false;

    if (G.draftRound >= CONFIG.draftPicksPerYear) {
      for (const seat of seats) G.discard.push(...G.draftPacks[seat]);
      G.draftPacks = null;
      G.log.push('Draft complete; leftover cards discarded.');
      return true;
    }

    const n = seats.length;
    const rotated = {};
    for (let i = 0; i < n; i++) rotated[seats[(i + 1) % n]] = G.draftPacks[seats[i]];
    G.draftPacks = rotated;
    G.draftRound += 1;
    G.draftPicksThisRound = {};
    G.log.push(`Draft round ${G.draftRound} begins.`);
  }
}

export const draftMoves = {
  pickCard({ G, ctx, playerID, events }, uid) {
    const pack = G.draftPacks && G.draftPacks[playerID];
    if (!pack || G.draftPicksThisRound[playerID]) return INVALID_MOVE;
    const idx = pack.findIndex((c) => c.uid === uid);
    if (idx < 0) return INVALID_MOVE;
    const [picked] = pack.splice(idx, 1);
    G.players[playerID].hand.push(picked);
    G.draftPicksThisRound[playerID] = true;
    G.log.push(`Seat ${playerID} drafts ${card(picked.cardId).name}.`);
    if (settleDraftRound(G, ctx.playOrder)) events.endPhase();
  },
};

// ---------------------------------------------------------------------------
// PHASE 3 — ACTIONS (§5 Phase 3: sequential turns, clockwise from the king;
// each seat's actionsLeft is seeded by turn.onBegin and the phase auto-
// advances once everyone has had their turn — see game.js)
// ---------------------------------------------------------------------------
export const actionMoves = {
  muster({ G, playerID }, count) {
    const p = G.players[playerID];
    if (p.actionsLeft <= 0) return INVALID_MOVE;
    const cap = Object.values(G.provinces)
      .filter((pr) => pr.owner === playerID)
      .reduce((s, pr) => s + pr.levy, 0);
    count = Math.max(1, Math.min(count | 0, cap - p.troops));
    const cost = count * CONFIG.troopCost;
    if (count <= 0 || p.gold < cost) return INVALID_MOVE;
    p.gold -= cost;
    p.troops += count;
    p.actionsLeft -= 1;
    G.log.push(`Seat ${playerID} musters ${count} troops (-${cost}g).`);
  },

  build({ G, playerID }, provinceId, kind) {
    const p = G.players[playerID];
    if (p.actionsLeft <= 0) return INVALID_MOVE;
    const prov = G.provinces[provinceId];
    if (!prov || prov.owner !== playerID || prov.building) return INVALID_MOVE;
    if (kind !== 'market' && kind !== 'castle') return INVALID_MOVE;
    if (p.gold < CONFIG.buildCost) return INVALID_MOVE;
    p.gold -= CONFIG.buildCost;
    prov.building = kind;
    if (kind === 'market') prov.tax += 1;
    if (kind === 'castle') prov.levy += 1;
    p.actionsLeft -= 1;
    G.log.push(`Seat ${playerID} builds a ${kind} in ${prov.name}.`);
  },

  sendGift({ G, playerID }, toSeat) {
    const p = G.players[playerID];
    if (p.actionsLeft <= 0) return INVALID_MOVE;
    if (p.gold < CONFIG.giftCost) return INVALID_MOVE;
    // Duke -> king raises that duke's favor; king -> duke raises that duke's favor.
    const dukeSeat = isKing(G, playerID) ? toSeat : playerID;
    if (!(dukeSeat in G.favor)) return INVALID_MOVE;
    p.gold -= CONFIG.giftCost;
    adjustFavor(G, dukeSeat, CONFIG.favor.onGift, 'gift');
    p.actionsLeft -= 1;
  },

  holdCourt({ G, playerID }) {
    const p = G.players[playerID];
    if (p.actionsLeft <= 0) return INVALID_MOVE;
    // Draw 2, keep 1 (simplified: keep first, discard second).
    if (G.deck.length) p.hand.push(G.deck.shift());
    if (G.deck.length) G.discard.push(G.deck.shift());
    p.actionsLeft -= 1;
    G.log.push(`Seat ${playerID} holds court (draw 2, keep 1).`);
  },

  // Play a card from hand. TODO(cards): implement each `effect`. Only a couple
  // are wired; the rest just log and discard so the loop keeps running.
  playCard({ G, playerID }, uid) {
    const p = G.players[playerID];
    if (p.actionsLeft <= 0) return INVALID_MOVE;
    const idx = p.hand.findIndex((h) => h.uid === uid);
    if (idx < 0) return INVALID_MOVE;
    const held = p.hand[idx];
    const def = card(held.cardId);
    if (def.crownOnly && !isKing(G, playerID)) {
      // A duke may hold crown-only cards (bank for a coup) but not play them.
      return INVALID_MOVE;
    }
    switch (def.effect) {
      case 'gold3':
        p.gold += 3;
        break;
      case 'forcedLevy':
        p.troops += 3; // TODO: -1 tax next harvest
        break;
      // TODO(cards): ambush, poison, tournament, charter, decrees, claims, etc.
      default:
        G.log.push(`(stub) effect "${def.effect}" not yet implemented.`);
    }
    p.hand.splice(idx, 1);
    G.discard.push(held);
    p.actionsLeft -= 1;
    G.log.push(`Seat ${playerID} plays ${def.name}.`);
  },

  // Voluntarily end a turn early, forfeiting any unspent actions (§5:
  // "passing ends the turn"; holding actions as reactions is a later
  // milestone). turn.endIf (game.js) ends the turn once actionsLeft <= 0,
  // and automatically advances the phase once everyone has gone once.
  pass({ G, playerID }) {
    G.players[playerID].actionsLeft = 0;
    G.log.push(`Seat ${playerID} passes.`);
  },
};

// ---------------------------------------------------------------------------
// PHASE 4 — WAR & REBELLION
// ---------------------------------------------------------------------------
export const warMoves = {
  // Secret troop commitment (dial). Stored per seat; revealed on resolveWar.
  commitTroops({ G, playerID }, count) {
    if (!G.pendingWar) return INVALID_MOVE;
    count = Math.max(0, Math.min(count | 0, G.players[playerID].troops));
    G.pendingWar.commits[playerID] = count;
    G.players[playerID].committed = count;
  },

  // Resolve the external war. SIMPLIFIED (§7): sum commits + a modifier vs
  // garrison. Winner keeps/distributes provinces (distribution is TODO).
  resolveWar({ G, playerID, random }, modifierIndex) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    if (!G.pendingWar) return INVALID_MOVE;
    const fk = G.foreignKingdoms.find((k) => k.id === G.pendingWar.kingdomId);
    const committed = Object.values(G.pendingWar.commits).reduce((a, b) => a + b, 0);
    // Near-deterministic swing (§7.4). If no index passed, pick randomly.
    const deck = CONFIG.warModifierDeck;
    const mod = deck[
      typeof modifierIndex === 'number'
        ? Math.max(0, Math.min(modifierIndex, deck.length - 1))
        : Math.floor((random ? random.Number() : Math.random()) * deck.length)
    ];
    const attack = committed;
    const defense = fk.garrison + mod;
    const P = CONFIG.prestige;

    if (attack > defense) {
      fk.conquered = true;
      G.players[G.crownHolder].prestige += P.warWinKing;
      // Dutiful dukes (committed >= their levy duty) +1. TODO: compute duty.
      for (const duke of Object.keys(G.favor)) {
        if ((G.pendingWar.commits[duke] || 0) > 0) {
          G.players[duke].prestige += P.warWinDutifulDuke;
        }
      }
      G.log.push(`WAR WON vs ${fk.name} (${attack} > ${defense}).`);
      // TODO(distribution §7.6): honor domainLimit, grant surplus to dukes
      // (+2 favor each), sack undistributable provinces (-1 favor all).
    } else {
      G.warLostThisYear = true;
      G.players[G.crownHolder].prestige += P.warLossKing;
      G.players[G.crownHolder].gold -= CONFIG.warReparationsGold; // may go negative -> TODO borrow
      for (const duke of Object.keys(G.favor)) {
        adjustFavor(G, duke, CONFIG.favor.onKingWarLoss, 'king lost a war');
      }
      G.log.push(`WAR LOST vs ${fk.name} (${attack} <= ${defense}).`);
      // TODO(§7.7): occupy one border province of the king's domain.
    }

    // Casualties (§7.5). Winning side per winPerN, losing side per losePerN.
    const won = attack > defense;
    const per = won ? CONFIG.casualties.winPerN : CONFIG.casualties.losePerN;
    for (const [seat, c] of Object.entries(G.pendingWar.commits)) {
      const dead = Math.floor(c / per);
      G.players[seat].troops = Math.max(0, G.players[seat].troops - dead);
      G.players[seat].committed = null;
    }
    G.pendingWar = null;
  },

  // A duke declares rebellion. SIMPLIFIED (§10): total troops per side, no
  // side-picking negotiation yet. TODO: implement loyalist/rebel/neutral
  // declarations, binding offers, castle bonuses, marshal bonus.
  declareRebellion({ G, playerID }) {
    if (isKing(G, playerID)) return INVALID_MOVE;
    if (G.activeRebellion) return INVALID_MOVE;
    G.activeRebellion = { leader: playerID };
    G.rebellionThisYear = true;
    G.log.push(`Seat ${playerID} raises the banner of rebellion!`);
  },

  // Resolve rebellion. SIMPLIFIED: rebel leader's troops vs king's troops.
  resolveRebellion({ G, playerID }) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    if (!G.activeRebellion) return INVALID_MOVE;
    const rebel = G.activeRebellion.leader;
    const P = CONFIG.prestige;
    const rebelForce = G.players[rebel].troops; // TODO: + allies + schemes
    const kingForce =
      G.players[G.crownHolder].troops + CONFIG.marshalBattleBonus; // marshal is king's

    if (rebelForce > kingForce) {
      // Usurpation: crown changes hands (§10). Capital travels with the crown.
      G.players[rebel].prestige += P.usurperBonus;
      const oldKing = G.crownHolder;
      // Move capital ownership.
      for (const prov of Object.values(G.provinces)) {
        if (prov.capital) prov.owner = rebel;
      }
      G.crownHolder = rebel;
      G.offices.marshal = rebel;
      // Favor resets on a new reign; rebuild tracks around the new king.
      const newDukes = Object.keys(G.players).filter((s) => s !== rebel);
      G.favor = {};
      for (const s of newDukes) G.favor[s] = 0;
      G.log.push(`REBELLION SUCCEEDS. Seat ${rebel} is crowned (+${P.usurperBonus}).`);
      // TODO(§10): new king strips up to 2 provinces from each loyalist.
    } else {
      // Crushed. -3 prestige, favor to floor with cooldown, strip land (TODO).
      G.players[rebel].prestige += P.failedRebelLeader;
      G.favor[rebel] = CONFIG.rebellionFavorFloor;
      G.players[rebel].rebelCooldownUntilYear = G.year + CONFIG.rebellionCooldownYears;
      G.log.push(`REBELLION CRUSHED. Seat ${rebel} ${P.failedRebelLeader} prestige, favor -> floor.`);
      // TODO(§10): strip 2 provinces from leader, 1 from each other rebel.
    }
    G.activeRebellion = null;
  },

  endWarPhase({ G, playerID, events }) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    events.endPhase();
  },
};

// ---------------------------------------------------------------------------
// PHASE 5 — HARVEST (income, crown rent, office prestige, advance year)
// ---------------------------------------------------------------------------
export const harvestMoves = {
  endHarvest({ G, playerID, events }) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    runHarvest(G);
    G.year += 1;
    if (G.year > CONFIG.years) {
      // Land + Heir bonuses must be applied here (a move, where mutating G
      // is legal) rather than in game.js's endIf, which boardgame.io treats
      // as a pure/read-only check and freezes G against mutation.
      G.finalScores = finalScores(G);
      G.log.push('Game over.');
    } else {
      G.log.push(`--- Year ${G.year} ---`);
    }
    events.endPhase(); // wraps to 'council' via phase.next
  },
};

export { finalScores };
