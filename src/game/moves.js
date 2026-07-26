// ==========================================================================
// MOVES — grouped by phase. The economic/scoring spine is fully implemented;
// war and rebellion RESOLUTION is deliberately simplified and marked TODO so
// you can vibecode the real §7/§10 logic against a running skeleton.
//
// Move signature (boardgame.io >=0.50): (context, ...args) where
//   context = { G, ctx, playerID, events, random, log }
// Mutate G directly (immer). Return INVALID_MOVE to reject.
// ==========================================================================
// Use the explicit ESM file so the same game module works in Vite and in the
// Node-based reducer tests on Node 20 (the package's directory subpath is not
// a valid Node ESM import).
import { INVALID_MOVE } from 'boardgame.io/dist/esm/core.js';
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

export function hasCharacter(G, seat, effect) {
  return G.players[seat].characters.some((cardId) => {
    const definition = card(cardId);
    return definition && definition.effect === effect;
  });
}

// Exposed for the upcoming war/rebellion milestones: Character strength is a
// passive modifier, not a new troop pool (§9).
export function characterStrength(G, seat) {
  return hasCharacter(G, seat, 'general') ? CONFIG.cards.generalStrength : 0;
}

export function levyValue(G, seat) {
  return Object.values(G.provinces)
    .filter((province) => province.owner === seat)
    .reduce((total, province) => total + province.levy, 0);
}

export function levyDuty(G, seat) {
  return Math.floor(levyValue(G, seat) * CONFIG.levyLaw[G.levyLaw]);
}

function claimOn(G, provinceId) {
  for (const [seat, player] of Object.entries(G.players)) {
    const claim = player.claims.find((entry) => entry.provinceId === provinceId);
    if (claim) return { seat, claim };
  }
  return null;
}

// Reveal face-down cards at their public trigger. A real Scheme resolves once
// and is discarded; a bluffed non-Scheme is revealed as a dud at a battle.
// The returned bonuses keep the trigger-specific rules out of the battle
// reducers while leaving the hidden card identity in player.schemes until now.
export function resolveSchemes(G, trigger, details = {}) {
  const result = {
    attackBonus: 0,
    attackBonusBySeat: {},
    garrisonBonus: 0,
  };

  for (const [seat, player] of Object.entries(G.players)) {
    const remaining = [];
    for (const scheme of player.schemes) {
      const definition = card(scheme.cardId);
      const effect = definition?.effect;
      const isBluff = definition?.type !== 'scheme';
      let resolves = false;

      if (trigger === 'externalWar') {
        resolves = isBluff || ['ambush', 'bribe', 'poison'].includes(effect);
        if (effect === 'ambush') {
          result.attackBonus += CONFIG.cards.ambushStrength;
          result.attackBonusBySeat[seat] =
            (result.attackBonusBySeat[seat] || 0) + CONFIG.cards.ambushStrength;
        } else if (effect === 'poison') {
          result.garrisonBonus += CONFIG.cards.poisonGarrison;
        } else if (effect === 'bribe') {
          const target = scheme.targetSeat && scheme.targetSeat !== seat
            ? scheme.targetSeat
            : Object.keys(G.pendingWar?.commits || {}).find((candidate) => candidate !== seat);
          if (target && target in (G.pendingWar?.commits || {})) {
            const desertions = Math.min(CONFIG.cards.bribedCaptainsCubes,
              G.pendingWar.commits[target]);
            G.pendingWar.commits[target] -= desertions;
            G.players[target].committed = G.pendingWar.commits[target];
            G.log.push(`Bribed Captains: ${desertions} cubes desert from seat ${target}.`);
          }
        }
      } else if (trigger === 'rebellionDeclared') {
        resolves = effect === 'forgedLetters';
        if (effect === 'forgedLetters') {
          const target = scheme.targetSeat && scheme.targetSeat !== seat
            ? scheme.targetSeat
            : Object.keys(G.favor).find((candidate) => candidate !== seat);
          if (target && target in G.favor) {
            adjustFavor(G, target, CONFIG.cards.forgedLettersFavor,
              `Forged Letters from seat ${seat}`);
          }
        }
      } else if (trigger === 'rebellionBattle') {
        resolves = effect === 'ambush';
        if (effect === 'ambush') {
          result.attackBonusBySeat[seat] =
            (result.attackBonusBySeat[seat] || 0) + CONFIG.cards.ambushStrength;
        }
      }

      if (resolves) {
        G.discard.push({ uid: scheme.uid, cardId: scheme.cardId });
        G.log.push(`${definition ? definition.name : 'Bluff'} revealed by seat ${seat}.`);
      } else {
        remaining.push(scheme);
      }
    }
    player.schemes = remaining;
  }

  return result;
}

// Central grant seam for Charter now and war/rebellion distribution later.
// A claimed province defaults to its claimant when no recipient is supplied;
// awarding it elsewhere resolves the claim with the §9 Favor penalty.
export function grantProvince(G, provinceId, requestedRecipient, reason = 'grant') {
  const province = G.provinces[provinceId];
  if (!province || province.owner === requestedRecipient) return false;

  const claim = claimOn(G, provinceId);
  const recipient = requestedRecipient ?? claim?.seat;
  if (!recipient || !(recipient in G.players)) return false;

  if (claim && claim.seat !== recipient) {
    adjustFavor(G, claim.seat, CONFIG.cards.claimFavorPenalty,
      `${reason}: claim on ${provinceId} awarded elsewhere`);
  }

  province.owner = recipient;
  if (recipient in G.favor) {
    adjustFavor(G, recipient, CONFIG.favor.onGrantProvince, `${reason}: ${provinceId}`);
  }

  for (const player of Object.values(G.players)) {
    player.claims = player.claims.filter((entry) => entry.provinceId !== provinceId);
  }
  return true;
}

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

  // Play a card from hand. Schemes are stored face-down; the optional
  // `{ faceDown: true }` form lets any card be played as a bluff (§9).
  playCard({ G, playerID }, uid, ...args) {
    const p = G.players[playerID];
    if (p.actionsLeft <= 0) return INVALID_MOVE;
    const idx = p.hand.findIndex((h) => h.uid === uid);
    if (idx < 0) return INVALID_MOVE;
    const held = p.hand[idx];
    const def = card(held.cardId);
    if (!def) return INVALID_MOVE;
  const bluff = args[0] && typeof args[0] === 'object' && args[0].faceDown;
  if (def.crownOnly && !isKing(G, playerID) && !bluff) {
      // A duke may hold crown-only cards (bank for a coup) but not play them.
      return INVALID_MOVE;
    }

    if (def.type === 'scheme' || bluff) {
      const targetSeat = def.type === 'scheme'
        ? args[0]
        : args[0].targetSeat;
      if (targetSeat !== undefined &&
        (!(targetSeat in G.players) || targetSeat === playerID)) return INVALID_MOVE;
      p.schemes.push({ uid: held.uid, cardId: held.cardId, targetSeat });
      p.hand.splice(idx, 1);
      p.actionsLeft -= 1;
      G.log.push(`Seat ${playerID} plays a card face down.`);
      return;
    }

    const dukes = Object.keys(G.favor);
    const firstNeutralMinor = () => Object.values(G.provinces).find((province) =>
      province.owner == null && province.region === 'minor'
    );
    const addFreeTroops = (amount) => {
      const capacity = levyValue(G, playerID) - p.troops;
      const added = Math.min(amount, Math.max(0, capacity));
      if (added <= 0) return false;
      p.troops += added;
      return true;
    };

    // Invalid targets are rejected before the card leaves the hand.
    switch (def.effect) {
      case 'gold3':
        p.gold += CONFIG.cards.taxFarmersGold;
        break;
      case 'gold2':
        p.gold += CONFIG.cards.marketDayGold;
        break;
      case 'forcedLevy':
        if (!addFreeTroops(CONFIG.cards.forcedLevyTroops)) return INVALID_MOVE;
        p.taxPenalty = (p.taxPenalty || 0) + CONFIG.cards.forcedLevyTaxPenalty;
        break;
      case 'muster2':
        if (!addFreeTroops(CONFIG.cards.mercenaryTroops)) return INVALID_MOVE;
        break;
      case 'envoy': {
        const kingdomId = args[0] ?? G.foreignKingdoms.find((kingdom) => !kingdom.conquered)?.id;
        const kingdom = G.foreignKingdoms.find((entry) =>
          entry.id === kingdomId && !entry.conquered
        );
        if (!kingdom) return INVALID_MOVE;
        kingdom.garrison = Math.max(0,
          kingdom.garrison - CONFIG.cards.envoyGarrisonReduction);
        G.log.push(`Diplomatic Envoy reduces ${kingdom.name}'s garrison to ${kingdom.garrison}.`);
        break;
      }
      case 'tournament': {
        const requested = Array.isArray(args[0]) ? args[0] : args.filter(Boolean);
        const targets = (requested.length ? requested : dukes.slice(0, 2))
          .filter((seat, index, list) => seat in G.favor && list.indexOf(seat) === index);
        if (targets.length !== 2) return INVALID_MOVE;
        for (const duke of targets) adjustFavor(G, duke, CONFIG.cards.tournamentFavor, 'Royal Tournament');
        p.prestige += CONFIG.cards.tournamentPrestige;
        break;
      }
      case 'charter': {
        const provinceId = args[0] ?? firstNeutralMinor()?.id;
        const province = provinceId && G.provinces[provinceId];
        if (!province || province.owner != null || province.region !== 'minor') return INVALID_MOVE;
        const recipient = args[1] ?? claimOn(G, provinceId)?.seat ?? dukes[0];
        if (!(recipient in G.favor)) return INVALID_MOVE;
        if (!grantProvince(G, provinceId, recipient, 'Grant Charter')) return INVALID_MOVE;
        break;
      }
      case 'favor1': {
        const recipient = isKing(G, playerID) ? (args[0] ?? dukes[0]) : playerID;
        if (!(recipient in G.favor)) return INVALID_MOVE;
        adjustFavor(G, recipient, CONFIG.cards.honoraryTitleFavor, 'Pious Gift');
        break;
      }
      case 'title': {
        const recipient = args[0] ?? playerID;
        if (!(recipient in G.favor)) return INVALID_MOVE;
        adjustFavor(G, recipient, CONFIG.cards.honoraryTitleFavor, 'Honorary Title');
        G.players[recipient].prestige += CONFIG.cards.honoraryTitlePrestige;
        break;
      }
      case 'claim': {
        const provinceId = args[0];
        const province = provinceId && G.provinces[provinceId];
        if (!province || province.owner === playerID) return INVALID_MOVE;
        if (claimOn(G, provinceId)) return INVALID_MOVE;
        p.claims.push({ cardId: held.cardId, provinceId });
        G.log.push(`Seat ${playerID} claims ${province.name}.`);
        break;
      }
      case 'general':
      case 'legate':
        if (p.characters.length >= CONFIG.cards.characterSlots) return INVALID_MOVE;
        p.characters.push(held.cardId);
        G.log.push(`Seat ${playerID} appoints ${def.name}.`);
        p.hand.splice(idx, 1);
        p.actionsLeft -= 1;
        return;
      case 'ambush':
      case 'bribe':
      case 'poison':
      case 'forgedLetters':
        return INVALID_MOVE;
      case 'magnaCarta':
      case 'standingArmy':
      case 'trialByCombat':
        // M2d routes Decrees through the Council vote.
        return INVALID_MOVE;
      default:
        return INVALID_MOVE;
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
    // §9: a Papal Legate forbids deliberately falling short of levy duty.
    if (hasCharacter(G, playerID, 'legate') && count < levyDuty(G, playerID)) {
      return INVALID_MOVE;
    }
    G.pendingWar.commits[playerID] = count;
    G.players[playerID].committed = count;
  },

  // Resolve the external war. SIMPLIFIED (§7): sum commits + a modifier vs
  // garrison. Winner keeps/distributes provinces (distribution is TODO).
  resolveWar({ G, playerID, random }, modifierIndex) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    if (!G.pendingWar) return INVALID_MOVE;
    const fk = G.foreignKingdoms.find((k) => k.id === G.pendingWar.kingdomId);
    const revealed = resolveSchemes(G, 'externalWar');
    const committed = Object.values(G.pendingWar.commits).reduce((a, b) => a + b, 0);
    // Near-deterministic swing (§7.4). If no index passed, pick randomly.
    const deck = CONFIG.warModifierDeck;
    const mod = deck[
      typeof modifierIndex === 'number'
        ? Math.max(0, Math.min(modifierIndex, deck.length - 1))
        : Math.floor((random ? random.Number() : Math.random()) * deck.length)
    ];
    const attack = committed + revealed.attackBonus;
    const defense = fk.garrison + mod + revealed.garrisonBonus;
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
    resolveSchemes(G, 'rebellionDeclared');
    G.log.push(`Seat ${playerID} raises the banner of rebellion!`);
  },

  // Resolve rebellion. SIMPLIFIED: rebel leader's troops vs king's troops.
  resolveRebellion({ G, playerID }) {
    if (!isKing(G, playerID)) return INVALID_MOVE;
    if (!G.activeRebellion) return INVALID_MOVE;
    const rebel = G.activeRebellion.leader;
    const P = CONFIG.prestige;
    const revealed = resolveSchemes(G, 'rebellionBattle');
    const rebelForce = G.players[rebel].troops +
      (revealed.attackBonusBySeat[rebel] || 0);
    const kingForce =
      G.players[G.crownHolder].troops + CONFIG.marshalBattleBonus +
      (revealed.attackBonusBySeat[G.crownHolder] || 0);

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
