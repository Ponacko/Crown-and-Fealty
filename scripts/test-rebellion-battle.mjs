// M4.2 checks: civil-war strength uses all troops, coalition-owned castles,
// the Marshal's side, revealed Schemes, and defender-favoring ties.
import { setup } from '../src/game/setup.js';
import { warMoves } from '../src/game/moves.js';
import { CONFIG } from '../src/config.js';

const random = { Shuffle: (cards) => cards, Number: () => 0 };

function makeGame() {
  const G = setup({
    ctx: { numPlayers: 4, playOrder: ['0', '1', '2', '3'] },
    random,
  });
  G.activeRebellion = {
    leader: '1',
    sides: { '2': 'loyal', '3': 'neutral' },
    step: 'locked',
  };
  return G;
}

function context(G, playerID = '0') {
  return { G, playerID };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Rebel strength: leader's all-in troop pool (committed is deliberately stale)
// + rebel Marshal + rebel castle + rebel Ambush. Loyalist strength gets its
// own troop pool, castle, and Ambush. Neutral troops and castles do not count.
const strengthGame = makeGame();
strengthGame.players['0'].troops = 2;
strengthGame.players['1'].troops = 5;
strengthGame.players['1'].committed = 0;
strengthGame.players['2'].troops = 1;
strengthGame.players['3'].troops = 20;
strengthGame.offices.marshal = '1';
strengthGame.provinces.a1.building = 'castle';
strengthGame.provinces.cr1.building = 'castle';
strengthGame.provinces.c1.building = 'castle';
strengthGame.players['1'].schemes.push({ uid: 'ambush-rebel', cardId: 'sch_ambush' });
strengthGame.players['2'].schemes.push({ uid: 'ambush-loyal', cardId: 'sch_ambush' });
warMoves.resolveRebellion(context(strengthGame));
assert(strengthGame.crownHolder === '1',
  'all-troop coalition strength, castles, Marshal, or Schemes were not counted');
assert(strengthGame.log.some((line) => line === 'REBELLION STRENGTH: rebels 11, king 7.'),
  'rebellion strength totals were not recorded correctly');
assert(!strengthGame.players['1'].schemes.length && !strengthGame.players['2'].schemes.length,
  'rebellion Schemes were not revealed and consumed');

// Exact ties stay with the defender, even when the rebel has the larger raw
// troop pool, because the Marshal belongs to the King in this case.
const tieGame = makeGame();
tieGame.players['0'].troops = 5;
tieGame.players['1'].troops = 7;
tieGame.players['2'].troops = 0;
tieGame.players['3'].troops = 0;
tieGame.offices.marshal = '0';
warMoves.resolveRebellion(context(tieGame));
assert(tieGame.crownHolder === '0', 'an exact rebellion tie removed the King');
assert(tieGame.log.some((line) => line === 'REBELLION STRENGTH: rebels 7, king 7.'),
  'exact-tie rebellion totals were not recorded correctly');
assert(tieGame.players['1'].prestige === CONFIG.prestige.failedRebelLeader,
  'the tie did not take the King-win branch');

console.log('PASS: M4.2 rebellion battle checks.');
