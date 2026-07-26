// M5.1 checks: council proposals resolve through weighted votes, bribery is
// immediate cash transfer, and the old direct law setter is gone.
import { setup } from '../src/game/setup.js';
import { CONFIG } from '../src/config.js';
import { CrownAndFealty } from '../src/game/game.js';
import { councilMoves } from '../src/game/moves.js';
import { createRequire } from 'node:module';

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

function voteAll(G, choices) {
  for (const seat of ['0', '1', '2', '3']) {
    const result = councilMoves.vote(context(G, seat), choices[seat]);
    assert(result !== INVALID_MOVE, `seat ${seat} could not vote`);
  }
}

// Laws can no longer be changed by a direct king move.
const directGame = makeGame();
assert(councilMoves.setLaw(context(directGame, '0'), 'taxLaw', 'high') === INVALID_MOVE,
  'direct law setter still bypasses the council');

// A Chancellor's double vote is enough to pass a proposal that would otherwise
// tie: the Chancellor and one duke vote yes, the King and one duke vote no.
const chancellorGame = makeGame();
chancellorGame.offices.chancellor = '1';
assert(councilMoves.proposeLaw(context(chancellorGame, '0'), 'taxLaw', 'low') !== INVALID_MOVE,
  'King could not propose a law');
assert(councilMoves.transferGold(context(chancellorGame, '2'), '0', 1) !== INVALID_MOVE,
  'bribery was not legal during a vote');
assert(chancellorGame.players['2'].gold === CONFIG.startGold.duke - 1,
  'bribery did not move cash immediately');
assert(chancellorGame.favor['2'] === 0, 'bribery changed Favor');
voteAll(chancellorGame, { '0': false, '1': true, '2': true, '3': false });
assert(chancellorGame.taxLaw === 'low', 'Chancellor double vote did not pass the law');
assert(chancellorGame.pendingVote === null, 'resolved vote remained pending');
assert(chancellorGame.favor['3'] === CONFIG.favor.onLawLower,
  'lowering a law did not please every duke');

// The King casts a normal vote and breaks an otherwise even tie.
const tieGame = makeGame();
councilMoves.proposeLaw(context(tieGame, '0'), 'levyLaw', 'high');
voteAll(tieGame, { '0': true, '1': true, '2': false, '3': false });
assert(tieGame.levyLaw === 'high', 'King did not break a tied vote');
assert(tieGame.favor['2'] === CONFIG.favor.onLawRaise,
  'a dissenting duke was not penalized when a law was raised');

// A defeated proposal leaves the law and Favor unchanged, and Council cannot
// end while a proposal is still waiting for votes.
const defeatGame = makeGame();
councilMoves.proposeLaw(context(defeatGame, '0'), 'taxLaw', 'high');
assert(councilMoves.endCouncil({ G: defeatGame, playerID: '0', events: { endPhase() {} } }) === INVALID_MOVE,
  'Council ended with an unresolved proposal');
voteAll(defeatGame, { '0': false, '1': false, '2': true, '3': false });
assert(defeatGame.taxLaw === CONFIG.startingTaxLaw, 'defeated proposal changed the law');
assert(Object.values(defeatGame.favor).every((value) => value === 0),
  'defeated proposal changed Favor');

// A decree follows the same vote seam and is not discarded on proposal or
// defeat; it is consumed only once the vote resolves in its favor.
const decreeGame = makeGame();
const decreeUid = 'dec_army_test';
decreeGame.players['0'].hand.push({ uid: decreeUid, cardId: 'dec_army' });
councilMoves.proposeDecree(context(decreeGame, '0'), decreeUid);
voteAll(decreeGame, { '0': true, '1': true, '2': true, '3': true });
assert(decreeGame.enactedDecrees.includes('dec_army'), 'passed decree was not recorded');
assert(decreeGame.discard.some((held) => held.uid === decreeUid),
  'passed decree was not discarded');

// The real boardgame.io reducer exposes all seats during Council, then lets
// the King end it only after the vote has resolved.
const require = createRequire(import.meta.url);
const { CreateGameReducer, InitializeGame } = require('boardgame.io/internal');
const reducer = CreateGameReducer({ game: CrownAndFealty, isClient: false });
let state = InitializeGame({ game: CrownAndFealty, numPlayers: 4 });
const dispatch = (playerID, type, ...args) => {
  state = reducer(state, {
    type: 'MAKE_MOVE',
    payload: { playerID, type, args },
  });
  const error = state.transients?.error;
  state = { ...state, transients: undefined };
  return error;
};
assert(Object.keys(state.ctx.activePlayers).length === 4,
  'Council did not activate every seat');
assert(dispatch('1', 'proposeLaw', 'taxLaw', 'high'),
  'a duke proposed a Council law');
assert(!dispatch('0', 'proposeLaw', 'taxLaw', 'high'),
  'King proposal was rejected by the reducer');
for (const seat of ['0', '1', '2', '3']) assert(!dispatch(seat, 'vote', true),
  `seat ${seat} could not vote through the reducer`);
assert(!dispatch('0', 'endCouncil'), 'King could not end a resolved Council');
assert(state.ctx.phase === 'draft', 'Council did not advance after resolution');

console.log('PASS: M5.1 council voting checks.');
