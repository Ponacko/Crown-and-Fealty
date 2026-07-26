// M2d checks: decree cards may be held by any seat, but only the King can
// enact them through a resolved Council vote; each decree changes the rules.
import { setup } from '../src/game/setup.js';
import { CONFIG } from '../src/config.js';
import { councilMoves, kingDomainLimit, warMoves } from '../src/game/moves.js';

const INVALID_MOVE = 'INVALID_MOVE';
const random = { Shuffle: (cards) => cards };
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

function enact(G, holder, cardId) {
  const uid = `${cardId}_test`;
  G.players[holder].hand.push({ uid, cardId });
  assert(councilMoves.proposeDecree(context(G, '0'), uid) !== INVALID_MOVE,
    `${cardId} was not proposed by the King from a duke's hand`);
  for (const seat of ['0', '1', '2', '3']) {
    assert(councilMoves.vote(context(G, seat), true) !== INVALID_MOVE,
      `seat ${seat} could not vote on ${cardId}`);
  }
  assert(G.enactedDecrees.includes(cardId), `${cardId} was not enacted`);
  assert(G.discard.some((held) => held.uid === uid), `${cardId} was not consumed`);
}

// Magna Carta permanently prevents a High Tax Law proposal.
const magnaGame = makeGame();
enact(magnaGame, '2', 'dec_magna');
assert(councilMoves.proposeLaw(context(magnaGame, '0'), 'taxLaw', 'high') === INVALID_MOVE,
  'Magna Carta did not prevent High Tax Law');

// Standing Army changes every Crown Domain Limit check, not CONFIG itself.
const armyGame = makeGame();
assert(kingDomainLimit(armyGame) === CONFIG.domainLimit,
  'base Domain Limit changed unexpectedly');
enact(armyGame, '3', 'dec_army');
assert(kingDomainLimit(armyGame) === CONFIG.domainLimit + CONFIG.decrees.standingArmyDomainBonus,
  'Standing Army did not raise the effective Domain Limit');
armyGame.provinces.a1.owner = '0';
let phaseEnded = false;
assert(warMoves.endWarPhase({
  G: armyGame,
  playerID: '0',
  events: { endPhase: () => { phaseEnded = true; } },
}) !== INVALID_MOVE && phaseEnded,
  'Standing Army did not update the Domain Limit phase gate');

// Trial by Combat gives the smaller rebellion force its configured bonus.
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

// A duke cannot enact a decree even when they hold it.
const accessGame = makeGame();
accessGame.players['2'].hand.push({ uid: 'dec_magna_access', cardId: 'dec_magna' });
assert(councilMoves.proposeDecree(context(accessGame, '2'), 'dec_magna_access') === INVALID_MOVE,
  'a duke enacted a decree');

console.log('PASS: M2d decree checks.');
