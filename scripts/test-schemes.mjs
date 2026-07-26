// M2c checks: schemes are hidden while held, then resolve once at their
// battle trigger. Non-scheme cards may be bluffs and are discarded as duds.
import { setup } from '../src/game/setup.js';
import { CONFIG } from '../src/config.js';
import { actionMoves, warMoves } from '../src/game/moves.js';

const INVALID_MOVE = 'INVALID_MOVE';
const random = { Shuffle: (cards) => cards, Number: () => 0 };
const context = (G, playerID) => ({ G, playerID });

function makeGame() {
  return setup({
    ctx: { numPlayers: 4, playOrder: ['0', '1', '2', '3'] },
    random,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function playScheme(G, seat, cardId, ...args) {
  const uid = `${cardId}_${seat}_test`;
  G.players[seat].hand.push({ uid, cardId });
  G.players[seat].actionsLeft = 1;
  const definitionIsScheme = cardId.startsWith('sch_');
  const result = actionMoves.playCard(
    context(G, seat), uid, ...(definitionIsScheme ? args : [{ faceDown: true, ...args[0] }])
  );
  assert(result !== INVALID_MOVE, `${cardId} was rejected`);
  return uid;
}

// A scheme leaves the hand without exposing its identity through the public
// placement shape, and is not put in the discard pile until it resolves.
const storageGame = makeGame();
playScheme(storageGame, '1', 'sch_ambush');
assert(storageGame.players['1'].hand.length === 0, 'scheme stayed in hand');
assert(storageGame.players['1'].schemes.length === 1, 'scheme was not stored');
assert(storageGame.players['1'].schemes[0].cardId === 'sch_ambush', 'wrong scheme stored');
assert(storageGame.discard.length === 0, 'scheme was discarded before its trigger');

// Ambush adds +3 to the owner's external-war attack.
const ambushGame = makeGame();
ambushGame.players['1'].troops = 6;
playScheme(ambushGame, '1', 'sch_ambush');
ambushGame.pendingWar = { kingdomId: 'fk_weak', commits: { '1': 6 }, revealed: true };
warMoves.resolveWar({ G: ambushGame, playerID: '0', random }, 1);
assert(ambushGame.foreignKingdoms.find((k) => k.id === 'fk_weak').conquered,
  'Ambush did not add strength to the war');
assert(ambushGame.players['1'].schemes.length === 0, 'Ambush was not consumed');

// Poison adds +3 to the foreign garrison for this war only.
const poisonGame = makeGame();
poisonGame.players['1'].troops = 9;
playScheme(poisonGame, '1', 'sch_poison');
poisonGame.pendingWar = { kingdomId: 'fk_weak', commits: { '1': 9 }, revealed: true };
warMoves.resolveWar({ G: poisonGame, playerID: '0', random }, 1);
const poisonedKingdom = poisonGame.foreignKingdoms.find((k) => k.id === 'fk_weak');
assert(!poisonedKingdom.conquered, 'Poison did not strengthen the garrison');
assert(poisonedKingdom.garrison === poisonedKingdom.baseGarrison,
  'Poison permanently changed the kingdom garrison');

// Bribed Captains targets the declared opponent and removes two cubes before
// attack strength is counted.
const bribeGame = makeGame();
bribeGame.players['0'].troops = 2;
bribeGame.players['1'].troops = 7;
playScheme(bribeGame, '1', 'sch_bribe', '0');
bribeGame.pendingWar = {
  kingdomId: 'fk_weak', commits: { '0': 2, '1': 7 }, revealed: true,
};
warMoves.resolveWar({ G: bribeGame, playerID: '0', random }, 1);
assert(!bribeGame.foreignKingdoms.find((k) => k.id === 'fk_weak').conquered,
  'Bribed Captains did not desert opposing cubes');
assert(bribeGame.players['0'].committed === null, 'bribed dial was not cleared');

// A genuine Ambush also contributes to its owner's side in the current basic
// rebellion resolver.
const rebellionGame = makeGame();
rebellionGame.players['0'].troops = 5;
rebellionGame.players['1'].troops = 5;
playScheme(rebellionGame, '1', 'sch_ambush');
rebellionGame.activeRebellion = { leader: '1', step: 'locked' };
warMoves.resolveRebellion({ G: rebellionGame, playerID: '0' });
assert(rebellionGame.crownHolder === '1', 'Ambush did not affect rebellion strength');

// Any card can be a face-down bluff; it is revealed as a dud and discarded.
const bluffGame = makeGame();
playScheme(bluffGame, '1', 'act_taxfarmers');
bluffGame.pendingWar = { kingdomId: 'fk_weak', commits: { '1': 0 }, revealed: true };
warMoves.resolveWar({ G: bluffGame, playerID: '0', random }, 1);
assert(bluffGame.players['1'].schemes.length === 0, 'bluff was not consumed');
assert(bluffGame.discard.some((held) => held.cardId === 'act_taxfarmers'),
  'bluff dud was not discarded');

// Crown-only cards remain unplayable by dukes even when the caller requests a
// face-down bluff.
const crownBluffGame = makeGame();
const crownBluffUid = `${'act_tourney'}_bluff_test`;
crownBluffGame.players['1'].hand.push({ uid: crownBluffUid, cardId: 'act_tourney' });
crownBluffGame.players['1'].actionsLeft = 1;
assert(actionMoves.playCard(context(crownBluffGame, '1'), crownBluffUid, { faceDown: true }) === INVALID_MOVE,
  'duke played a crown-only bluff');
assert(crownBluffGame.players['1'].hand.some((held) => held.uid === crownBluffUid),
  'rejected crown-only bluff left the hand');

console.log('PASS: M2c scheme checks.');
