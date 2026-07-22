// ==========================================================================
// M0 safety net: drives the REAL boardgame.io Game object (phases, turn
// order, moves) through a full 6-year match headlessly, the same code path
// the debug panel exercises, and asserts the match reaches "Game over" with
// a winner. Uses boardgame.io's own reducer directly (no React/transport)
// so it stays fast and dependency-free.
// ==========================================================================
import { createRequire } from 'node:module';
import { CrownAndFealty } from '../src/game/game.js';
import { CONFIG } from '../src/config.js';

// boardgame.io's package.json has no "exports" map, so this subpath isn't
// resolvable as an ES module import — pull it in via require() instead.
const require = createRequire(import.meta.url);
const { CreateGameReducer, InitializeGame } = require('boardgame.io/internal');

const MAKE_MOVE = 'MAKE_MOVE';
const makeMoveAction = (type, args, playerID) => ({
  type: MAKE_MOVE,
  payload: { type, args, playerID },
});

const NUM_PLAYERS = 4;
const SEATS = ['0', '1', '2', '3'];
const KING = '0';
const DUKES = SEATS.filter((s) => s !== KING);

const reducer = CreateGameReducer({ game: CrownAndFealty, isClient: false });
let state = InitializeGame({ game: CrownAndFealty, numPlayers: NUM_PLAYERS });

// Dispatches a move and returns its rejection error (undefined on success).
// Rejections surface as transient `state.transients.error` — not a G/ctx
// diff — since phase-advancing moves like endCouncil never mutate G at all.
// We strip transients ourselves after reading them, the way the client
// middleware normally would, so a stale error can't leak into the next call.
function dispatchMove(playerID, type, args) {
  state = reducer(state, makeMoveAction(type, args, playerID));
  const error = state.transients && state.transients.error;
  state = { ...state, transients: undefined };
  return error;
}

// Applies a move; throws with a readable message if it was rejected.
function move(playerID, type, ...args) {
  const error = dispatchMove(playerID, type, args);
  if (error) {
    throw new Error(
      `expected move to succeed but got ${error.type}: seat ${playerID} -> ` +
      `${type}(${args.join(', ')}) [phase=${state.ctx.phase}]`
    );
  }
}

// Applies a move that is EXPECTED to be rejected (wrong actor / wrong turn).
function expectRejected(playerID, type, ...args) {
  const error = dispatchMove(playerID, type, args);
  if (!error) {
    throw new Error(
      `expected move to be REJECTED but it succeeded: seat ${playerID} -> ` +
      `${type}(${args.join(', ')}) [phase=${state.ctx.phase}]`
    );
  }
}

function assertPhase(expected) {
  if (state.ctx.phase !== expected) {
    throw new Error(`expected phase "${expected}", got "${state.ctx.phase}"`);
  }
}

console.log(`Simulating ${CONFIG.years} years, ${NUM_PLAYERS} seats...`);

for (let y = 1; y <= CONFIG.years; y++) {
  assertPhase('council');
  // Only the crown-holder may run council business.
  expectRejected(DUKES[0], 'endCouncil');
  move(KING, 'endCouncil');

  assertPhase('draft');
  for (const seat of SEATS) {
    // May legitimately be rejected once a seat's hand is already full in
    // later years (nobody plays cards in this smoke test) — that's fine,
    // we're exercising phase flow, not the draft/card systems.
    dispatchMove(seat, 'drawHand', []);
  }
  move(KING, 'endDraft');

  assertPhase('actions');
  move(KING, 'endActions');

  assertPhase('warAndRebellion');
  move(KING, 'endWarPhase');

  assertPhase('harvest');
  move(KING, 'endHarvest');

  console.log(`  Year ${y} complete. Log: "${state.G.log[state.G.log.length - 1]}"`);
}

if (!state.ctx.gameover) {
  throw new Error(`expected ctx.gameover to be set after ${CONFIG.years} years`);
}
if (!(state.ctx.gameover.winner in state.G.players)) {
  throw new Error(`gameover.winner "${state.ctx.gameover.winner}" is not a valid seat`);
}

console.log('Game over:', state.ctx.gameover);
console.log('PASS: full 6-year game completes and declares a winner.');
