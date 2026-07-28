// M2d checks: decree cards may be held by any seat, but only the King can
// enact them through a resolved Council vote; each decree changes the rules.
import { setup, crownKing } from '../src/game/setup.js';
import { CONFIG } from '../src/config.js';
import { councilMoves, kingDomainLimit, warMoves } from '../src/game/moves.js';

const INVALID_MOVE = 'INVALID_MOVE';
const random = { Shuffle: (cards) => cards };
const context = (G, playerID) => ({ G, playerID });
const ctx = { numPlayers: 4, playOrder: ['0', '1', '2', '3'] };

// §4: this script exercises decree enactment, not the Crown auction — crown
// seat 0 directly at the old scaffold's default (no starting Prestige debt).
function makeGame() {
  const G = setup({ ctx, random });
  crownKing(G, ctx, '0', 0);
  return G;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Enact a decree held by `holder` through the King's proposal + a unanimous
// Council vote, asserting it lands in enactedDecrees and is consumed.
function enact(G, holder, cardId) {
  const uid = `${cardId}_test`;
  G.players[holder].hand.push({ uid, cardId });
  assert(councilMoves.proposeDecree(context(G, '0'), uid) !== INVALID_MOVE,
    `${cardId} was not proposed by the King from seat ${holder}'s hand`);
  for (const seat of ['0', '1', '2', '3']) {
    assert(councilMoves.vote(context(G, seat), true) !== INVALID_MOVE,
      `seat ${seat} could not vote on ${cardId}`);
  }
  assert(G.enactedDecrees.includes(cardId), `${cardId} was not enacted`);
  assert(G.discard.some((held) => held.uid === uid), `${cardId} was not consumed`);
}

// A duke cannot enact a decree even when they hold it: only the King proposes.
const accessGame = makeGame();
accessGame.players['2'].hand.push({ uid: 'dec_magna_access', cardId: 'dec_magna' });
assert(councilMoves.proposeDecree(context(accessGame, '2'), 'dec_magna_access') === INVALID_MOVE,
  'a duke enacted a decree');
// ...but the King may enact a decree a duke is holding (held by any seat).
assert(councilMoves.proposeDecree(context(accessGame, '0'), 'dec_magna_access') !== INVALID_MOVE,
  'King could not propose a decree held by a duke');

// Magna Carta permanently prevents a High Tax Law proposal after enactment.
const magnaGame = makeGame();
assert(councilMoves.proposeLaw(context(magnaGame, '0'), 'taxLaw', 'high') !== INVALID_MOVE,
  'High Tax Law was blocked before Magna Carta');
magnaGame.pendingVote = null; // discard that proposal without resolving it
magnaGame.councilProposals = 0;
enact(magnaGame, '2', 'dec_magna');
assert(councilMoves.proposeLaw(context(magnaGame, '0'), 'taxLaw', 'high') === INVALID_MOVE,
  'Magna Carta did not prevent High Tax Law');

// Magna Carta cannot be enacted while Tax Law is already High (contradiction).
const magnaConflictGame = makeGame();
magnaConflictGame.taxLaw = 'high';
magnaConflictGame.players['1'].hand.push({ uid: 'dec_magna_conflict', cardId: 'dec_magna' });
assert(councilMoves.proposeDecree(context(magnaConflictGame, '0'), 'dec_magna_conflict') === INVALID_MOVE,
  'Magna Carta was enactable while Tax Law was High');

// Standing Army raises every Crown Domain Limit check, not CONFIG itself.
const armyGame = makeGame();
assert(kingDomainLimit(armyGame) === CONFIG.domainLimit,
  'base Domain Limit changed unexpectedly');
enact(armyGame, '3', 'dec_army');
assert(kingDomainLimit(armyGame) === CONFIG.domainLimit + CONFIG.decrees.standingArmyDomainBonus,
  'Standing Army did not raise the effective Domain Limit');
// A king sitting exactly at the raised limit can still end the War phase.
armyGame.provinces.a1.owner = '0';
let phaseEnded = false;
assert(warMoves.endWarPhase({
  G: armyGame,
  playerID: '0',
  events: { endPhase: () => { phaseEnded = true; } },
}) !== INVALID_MOVE && phaseEnded,
  'Standing Army did not raise the Domain Limit phase gate');

// Trial by Combat gives the smaller rebellion force its configured bonus,
// flipping a battle the larger side would otherwise win.
const combatGame = makeGame();
enact(combatGame, '1', 'dec_combat');
combatGame.players['0'].troops = 3;
combatGame.players['1'].troops = 2;
combatGame.players['2'].troops = 0;
combatGame.players['3'].troops = 0;
combatGame.offices.marshal = null;
combatGame.activeRebellion = {
  leader: '1',
  sides: { '2': 'loyal', '3': 'loyal' },
  step: 'locked',
};
warMoves.resolveRebellion(context(combatGame, '0'));
assert(combatGame.crownHolder === '1',
  'Trial by Combat did not let the smaller rebellion side win');

// Without Trial by Combat the same battle goes to the larger side.
const noCombatGame = makeGame();
noCombatGame.players['0'].troops = 3;
noCombatGame.players['1'].troops = 2;
noCombatGame.players['2'].troops = 0;
noCombatGame.players['3'].troops = 0;
noCombatGame.offices.marshal = null;
noCombatGame.activeRebellion = {
  leader: '1',
  sides: { '2': 'loyal', '3': 'loyal' },
  step: 'locked',
};
warMoves.resolveRebellion(context(noCombatGame, '0'));
assert(noCombatGame.crownHolder === '0',
  'the larger side lost a rebellion without Trial by Combat');

console.log('PASS: M2d decree checks.');
