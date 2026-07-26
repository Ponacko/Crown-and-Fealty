// M4.1 checks: rebellion side declarations happen in table order, followed by
// one renegotiation pass with immediate cash offers and locked sides.
import { setup } from '../src/game/setup.js';
import { warMoves } from '../src/game/moves.js';
import { CrownAndFealty } from '../src/game/game.js';
import { createRequire } from 'node:module';

const INVALID_MOVE = 'INVALID_MOVE';
const random = { Shuffle: (cards) => cards, Number: () => 0 };

function makeGame() {
  return setup({
    ctx: { numPlayers: 4, playOrder: ['0', '1', '2', '3'] },
    random,
  });
}

function context(G, playerID) {
  return {
    G,
    playerID,
    ctx: { playOrder: ['0', '1', '2', '3'] },
    random,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const game = makeGame();
warMoves.declareRebellion(context(game, '1'));
assert(game.rebellionThisYear, 'rebellion was not marked for this year');
assert(game.activeRebellion.step === 'sides', 'rebellion did not enter side-picking');
assert(JSON.stringify(game.activeRebellion.sideOrder) === JSON.stringify(['2', '3']),
  'side order did not start after the rebel and skip the king');
assert(warMoves.resolveRebellion(context(game, '0')) === INVALID_MOVE,
  'the king resolved rebellion before side-picking and negotiation finished');

assert(warMoves.chooseRebellionSide(context(game, '3'), 'loyal') === INVALID_MOVE,
  'a duke declared out of order');
warMoves.chooseRebellionSide(context(game, '2'), 'neutral');
assert(game.activeRebellion.sides['2'] === 'neutral', 'first side was not stored');
assert(warMoves.chooseRebellionSide(context(game, '2'), 'rebel') === INVALID_MOVE,
  'a duke declared twice during side-picking');
warMoves.chooseRebellionSide(context(game, '3'), 'loyal');
assert(game.activeRebellion.step === 'negotiation', 'side-picking did not open negotiation');

const kingGold = game.players['0'].gold;
warMoves.transferGold(context(game, '0'), '2', 2);
assert(game.players['0'].gold === kingGold - 2, 'king offer did not transfer cash immediately');
assert(game.players['2'].gold === 4 + 2, 'king offer did not reach its recipient');

warMoves.renegotiateRebellion(context(game, '2'), 'rebel');
assert(game.activeRebellion.sides['2'] === 'rebel', 'renegotiated side was not stored');
assert(game.activeRebellion.renegotiated['2'], 'renegotiation was not locked for the duke');
assert(warMoves.renegotiateRebellion(context(game, '2'), 'loyal') === INVALID_MOVE,
  'a duke renegotiated more than once');
warMoves.renegotiateRebellion(context(game, '3'), 'neutral');
assert(game.activeRebellion.step === 'locked', 'rebellion sides did not lock after negotiation');
assert(game.activeRebellion.sides['3'] === 'neutral', 'second renegotiated side was not stored');
assert(warMoves.chooseRebellionSide(context(game, '3'), 'rebel') === INVALID_MOVE,
  'side choice remained open after negotiation locked');
assert(warMoves.endWarPhase({
  G: game,
  playerID: '0',
  events: { endPhase() {} },
}) === INVALID_MOVE, 'war phase ended before rebellion resolution');

// The one-per-year rule remains in force even if the active rebellion is gone.
game.activeRebellion = null;
assert(warMoves.declareRebellion(context(game, '2')) === INVALID_MOVE,
  'a second rebellion was allowed in the same year');

console.log('PASS: M4.1 rebellion negotiation checks.');

// The real reducer must enforce the ordered stages too; move-level guards are
// only a defence in depth for direct callers and old saved states.
const require = createRequire(import.meta.url);
const { CreateGameReducer, InitializeGame } = require('boardgame.io/internal');
const reducer = CreateGameReducer({ game: CrownAndFealty, isClient: false });
const action = (playerID, type, args = []) => ({
  type: 'MAKE_MOVE',
  payload: { playerID, type, args },
});
let state = InitializeGame({ game: CrownAndFealty, numPlayers: 4 });

function dispatch(playerID, type, ...args) {
  state = reducer(state, action(playerID, type, args));
  const error = state.transients?.error;
  state = { ...state, transients: undefined };
  return error;
}

function frameworkMove(playerID, type, ...args) {
  const error = dispatch(playerID, type, ...args);
  assert(!error, `framework rejected ${type}: ${JSON.stringify(error)}`);
}

frameworkMove('0', 'endCouncil');
while (state.G.draftPacks) {
  for (const seat of ['0', '1', '2', '3']) {
    const pack = state.G.draftPacks?.[seat];
    if (pack?.length) frameworkMove(seat, 'pickCard', pack[0].uid);
  }
}
for (let i = 0; i < 4; i++) frameworkMove(state.ctx.currentPlayer, 'pass');
frameworkMove('1', 'declareRebellion');
assert(JSON.stringify(state.ctx.activePlayers) === JSON.stringify({ '2': 'rebellionSides' }),
  'boardgame.io did not activate the first side-picker');
assert(dispatch('3', 'chooseRebellionSide', 'loyal'),
  'boardgame.io allowed an out-of-order side declaration');
frameworkMove('2', 'chooseRebellionSide', 'neutral');
frameworkMove('3', 'chooseRebellionSide', 'loyal');
assert(state.ctx.activePlayers['2'] === 'rebellionNegotiation' &&
  state.ctx.activePlayers['0'] === 'rebellionNegotiationKing',
  'boardgame.io did not open the negotiation stages');
frameworkMove('0', 'transferGold', '2', 1);
frameworkMove('2', 'renegotiateRebellion', 'rebel');
frameworkMove('3', 'renegotiateRebellion', 'neutral');
assert(JSON.stringify(state.ctx.activePlayers) === JSON.stringify({ '0': 'rebellionLocked' }),
  'boardgame.io did not leave only the king active after locking');

console.log('PASS: boardgame.io rebellion stages enforce ordered moves.');
