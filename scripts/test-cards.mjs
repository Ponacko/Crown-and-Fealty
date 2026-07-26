// M2b checks: Action, Character, and Claim cards are real moves, while
// crown-only cards remain safely in a duke's hand when rejected.
import { setup } from '../src/game/setup.js';
import { CARDS } from '../src/game/data.js';
import { CONFIG } from '../src/config.js';
import { runHarvest } from '../src/game/scoring.js';
import {
  actionMoves,
  warMoves,
  characterStrength,
  grantProvince,
  levyDuty,
} from '../src/game/moves.js';

const INVALID_MOVE = 'INVALID_MOVE';
const random = { Shuffle: (cards) => cards };
const context = (G, playerID) => ({ G, playerID });

function makeGame() {
  return setup({
    ctx: { numPlayers: 4, playOrder: ['0', '1', '2', '3'] },
    random,
  });
}

function addCard(G, seat, cardId, uid = `${cardId}_test`) {
  G.players[seat].hand.push({ uid, cardId });
  return uid;
}

function play(G, seat, cardId, ...args) {
  const uid = addCard(G, seat, cardId);
  G.players[seat].actionsLeft = 1;
  const result = actionMoves.playCard(context(G, seat), uid, ...args);
  if (result === INVALID_MOVE) throw new Error(`card ${cardId} was rejected`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const types = new Set(CARDS.map((card) => card.type));
assert(CARDS.length >= 30, `expected an expanded card list, got ${CARDS.length}`);
for (const type of ['action', 'scheme', 'character', 'claim', 'decree']) {
  assert(types.has(type), `missing ${type} card type`);
}

// Immediate Action effects.
const G = makeGame();
const startingGold = G.players['1'].gold;
play(G, '1', 'act_taxfarmers');
assert(G.players['1'].gold === startingGold + CONFIG.cards.taxFarmersGold, 'Tax Farmers failed');

G.players['1'].troops = 0;
play(G, '1', 'act_forcedlevy');
assert(G.players['1'].troops === CONFIG.cards.forcedLevyTroops, 'Forced Levy failed');
assert(G.players['1'].taxPenalty === CONFIG.cards.forcedLevyTaxPenalty, 'Forced Levy tax penalty missing');

const envoyTarget = G.foreignKingdoms.find((kingdom) => !kingdom.conquered);
const originalGarrison = envoyTarget.garrison;
play(G, '1', 'act_envoy', envoyTarget.id);
assert(envoyTarget.garrison === originalGarrison - CONFIG.cards.envoyGarrisonReduction, 'Envoy failed');
runHarvest(G);
assert(envoyTarget.garrison === envoyTarget.baseGarrison, 'Envoy did not expire at Harvest');

const prestigeBeforeTournament = G.players['0'].prestige;
play(G, '0', 'act_tourney', ['1', '2']);
assert(G.favor['1'] === 1 && G.favor['2'] === 1, 'Tournament favor failed');
assert(
  G.players['0'].prestige === prestigeBeforeTournament + CONFIG.cards.tournamentPrestige,
  'Tournament prestige failed'
);

const charterProvince = G.provinces.m1;
play(G, '0', 'act_charter', charterProvince.id, '3');
assert(charterProvince.owner === '3', 'Charter did not grant the province');

// Persistent Characters and their currently relevant passive effects.
const characterGame = makeGame();
play(characterGame, '1', 'chr_general');
assert(characterStrength(characterGame, '1') === CONFIG.cards.generalStrength, 'General bonus missing');
assert(characterGame.players['1'].characters.length === 1, 'Character was not placed');

const legateGame = makeGame();
play(legateGame, '1', 'chr_legate');
const prestigeBeforeLegateHarvest = legateGame.players['1'].prestige;
runHarvest(legateGame);
assert(
  legateGame.players['1'].prestige === prestigeBeforeLegateHarvest + CONFIG.cards.legatePrestige,
  'Legate yearly prestige missing'
);
legateGame.pendingWar = { kingdomId: 'fk_weak', commits: {} };
assert(levyDuty(legateGame, '1') > 0, 'levy duty should be positive');
assert(warMoves.commitTroops(context(legateGame, '1'), 0) === INVALID_MOVE,
  'Legate was allowed to under-commit');

// Crown-only cards are rejected for dukes and remain in hand.
const crownOnlyGame = makeGame();
const crownOnlyUid = addCard(crownOnlyGame, '1', 'act_tourney');
crownOnlyGame.players['1'].actionsLeft = 1;
assert(actionMoves.playCard(context(crownOnlyGame, '1'), crownOnlyUid) === INVALID_MOVE,
  'duke played a crown-only card');
assert(crownOnlyGame.players['1'].hand.some((held) => held.uid === crownOnlyUid),
  'rejected crown-only card left the hand');

// Claims are open, unique, and resolve through the shared grant seam.
const claimGame = makeGame();
play(claimGame, '1', 'clm_generic', 'b1');
assert(claimGame.players['1'].claims[0].provinceId === 'b1', 'Claim was not recorded');
assert(grantProvince(claimGame, 'b1', '3', 'test grant'), 'Claimed province was not granted');
assert(claimGame.provinces.b1.owner === '3', 'Claim grant changed the wrong owner');
assert(claimGame.favor['1'] === CONFIG.cards.claimFavorPenalty, 'Denied claim penalty missing');
assert(claimGame.players['1'].claims.length === 0, 'Resolved claim was not cleared');

console.log(`PASS: M2b card checks (${CARDS.length} definitions, ${CARDS.length * 4} physical cards).`);
