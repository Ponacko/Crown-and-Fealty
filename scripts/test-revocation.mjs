// M5.2 checks: Revocation is Royal Prerogative when the King holds a Casus
// Belli on the target (earned or the standing Furious one) — otherwise it
// routes through the M5.1 Council vote. The target then Submits (loses one
// province of their choice, -2 favor, spends the Casus Belli) or Defies
// (immediate rebellion, entering the M4 flow).
import { setup, crownKing } from '../src/game/setup.js';
import { CONFIG } from '../src/config.js';
import { councilMoves, warMoves } from '../src/game/moves.js';
import { CrownAndFealty } from '../src/game/game.js';
import { createRequire } from 'node:module';

const INVALID_MOVE = 'INVALID_MOVE';
const random = { Shuffle: (cards) => cards, Number: () => 0 };
const ctx = { numPlayers: 4, playOrder: ['0', '1', '2', '3'] };

// §4: this script exercises Revocation directly, not the Crown auction —
// crown seat 0 directly at the old scaffold's default (no starting debt).
function makeGame() {
  const G = setup({ ctx, random });
  crownKing(G, ctx, '0', 0);
  return G;
}

function context(G, playerID) {
  return {
    G,
    playerID,
    ctx: { playOrder: ['0', '1', '2', '3'] },
    events: { setActivePlayers() {}, endPhase() {} },
    random,
  };
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

// --- Prerogative via an earned Casus Belli: no vote is created. ---
const earnedGame = makeGame();
earnedGame.casusBelli['1'] = 1;
assert(councilMoves.proposeRevocation(context(earnedGame, '0'), '1') !== INVALID_MOVE,
  'King could not invoke prerogative Revocation with an earned Casus Belli');
assert(earnedGame.pendingVote === null, 'prerogative Revocation created a vote');
assert(earnedGame.pendingRevocation?.target === '1', 'prerogative Revocation did not open a response window');
assert(earnedGame.councilProposals === 1, 'prerogative Revocation did not spend a Council proposal');

// --- Prerogative via the standing Furious (favor floor) flag, with no earned CB. ---
const furiousGame = makeGame();
furiousGame.favor['2'] = CONFIG.favor.furiousThreshold;
assert(councilMoves.proposeRevocation(context(furiousGame, '0'), '2') !== INVALID_MOVE,
  'King could not invoke prerogative Revocation on a Furious duke');
assert(furiousGame.pendingVote === null, 'a Furious-triggered Revocation still created a vote');
assert(furiousGame.pendingRevocation?.target === '2', 'Furious Revocation did not open a response window');

// --- No Casus Belli, not Furious: routes through the M5.1 vote. ---
const votedGame = makeGame();
assert(councilMoves.proposeRevocation(context(votedGame, '0'), '3') !== INVALID_MOVE,
  'King could not propose a voted Revocation');
assert(votedGame.pendingVote?.proposal.type === 'revocation', 'Revocation without a CB did not open a vote');
assert(votedGame.pendingRevocation === null, 'a voted Revocation resolved before any vote was cast');
voteAll(votedGame, { '0': true, '1': true, '2': true, '3': false });
assert(votedGame.pendingRevocation?.target === '3', 'a passed Revocation vote did not open a response window');

// A defeated Revocation vote leaves everything untouched.
const defeatedGame = makeGame();
councilMoves.proposeRevocation(context(defeatedGame, '0'), '1');
voteAll(defeatedGame, { '0': false, '1': false, '2': false, '3': true });
assert(defeatedGame.pendingRevocation === null, 'a defeated Revocation vote still opened a response window');

// --- Submit: the target picks which province to give up. ---
const submitGame = makeGame();
submitGame.casusBelli['1'] = 1;
councilMoves.proposeRevocation(context(submitGame, '0'), '1');
const dukeProvince = Object.values(submitGame.provinces).find((p) => p.owner === '1').id;
assert(councilMoves.respondRevocation(context(submitGame, '2'), 'submit', dukeProvince) === INVALID_MOVE,
  'a seat other than the target could respond to a Revocation');
assert(councilMoves.respondRevocation(context(submitGame, '1'), 'submit', 'not-a-province') === INVALID_MOVE,
  'submitting an unowned province was accepted');
assert(submitGame.pendingRevocation !== null, 'an invalid Submit consumed the response window');
const favorBefore = submitGame.favor['1'];
assert(councilMoves.respondRevocation(context(submitGame, '1'), 'submit', dukeProvince) !== INVALID_MOVE,
  'the target could not submit to Revocation');
assert(submitGame.provinces[dukeProvince].owner === submitGame.crownHolder,
  'the submitted province did not transfer to the King');
assert(submitGame.favor['1'] === favorBefore + CONFIG.favor.onRevoke,
  'submitting to Revocation did not apply the Favor penalty');
assert(submitGame.casusBelli['1'] === 0, 'submitting to Revocation did not spend the Casus Belli');
assert(submitGame.pendingRevocation === null, 'Submit left the response window open');

// --- Defy: immediate rebellion, with the target as Rebel Leader. ---
const defyGame = makeGame();
defyGame.casusBelli['1'] = 1;
councilMoves.proposeRevocation(context(defyGame, '0'), '1');
assert(councilMoves.respondRevocation(context(defyGame, '1'), 'defy') !== INVALID_MOVE,
  'the target could not defy a Revocation');
assert(defyGame.activeRebellion?.leader === '1', 'Defy did not make the target the Rebel Leader');
assert(defyGame.rebellionThisYear, 'Defy did not mark a rebellion for this year');
assert(defyGame.pendingRevocation === null, 'Defy left the response window open');

// Council cannot end while a Revocation response is outstanding.
const openGame = makeGame();
openGame.casusBelli['1'] = 1;
councilMoves.proposeRevocation(context(openGame, '0'), '1');
assert(councilMoves.endCouncil({ G: openGame, playerID: '0', events: { endPhase() {} } }) === INVALID_MOVE,
  'Council ended with an unresolved Revocation');

// Revocation cannot be proposed while a war or a rebellion is already in play,
// and a new war cannot be declared over an already-active rebellion (the
// King could otherwise stack a war and a Defied Revocation in one Council).
const conflictGame = makeGame();
councilMoves.declareWar(context(conflictGame, '0'), 'fk_weak');
assert(councilMoves.proposeRevocation(context(conflictGame, '0'), '1') === INVALID_MOVE,
  'Revocation was proposed while a war was pending');
const stackedGame = makeGame();
stackedGame.casusBelli['1'] = 1;
councilMoves.proposeRevocation(context(stackedGame, '0'), '1');
councilMoves.respondRevocation(context(stackedGame, '1'), 'defy');
assert(councilMoves.declareWar(context(stackedGame, '0'), 'fk_weak') === INVALID_MOVE,
  'the King declared war over an already-active rebellion');

// The reverse order must also be closed: proposeRevocation's own pendingWar
// check only runs at proposal time, so a war declared *after* the proposal
// (while a vote — or the target's response — is still outstanding) must not
// let the eventual Defy slip a rebellion in alongside it.
const raceGame = makeGame();
councilMoves.proposeRevocation(context(raceGame, '0'), '1'); // no CB yet -> opens a vote
assert(raceGame.pendingVote?.proposal.type === 'revocation', 'the race setup did not open a vote');
assert(councilMoves.declareWar(context(raceGame, '0'), 'fk_weak') !== INVALID_MOVE,
  'the King could not declare war while the Revocation vote was still open');
voteAll(raceGame, { '0': true, '1': true, '2': true, '3': true });
assert(raceGame.pendingRevocation?.target === '1', 'the Revocation vote did not open a response window');
assert(councilMoves.respondRevocation(context(raceGame, '1'), 'defy') === INVALID_MOVE,
  'Defy started a rebellion alongside a war declared in the interim');
assert(raceGame.activeRebellion === null, 'a rebellion started despite the pending war');
assert(raceGame.pendingRevocation?.target === '1',
  'a rejected Defy consumed the response window, leaving the target stuck');

console.log('PASS: M5.2 revocation checks.');

// The real reducer must resume a Council-triggered rebellion at the correct
// stage once Phase 4 begins, exactly as a Phase-4-declared rebellion would.
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

// §4: resolve the pre-game Crown auction first — seat 0 bids the minimum and
// everyone else passes, keeping this script's "seat 0 is King" assumption.
frameworkMove('0', 'bid', 0);
for (const seat of ['1', '2', '3']) frameworkMove(seat, 'passAuction');
assert(state.ctx.phase === 'council', 'the Crown auction did not advance into Council');

frameworkMove('0', 'proposeRevocation', '1');
assert(state.G.pendingRevocation === null, 'prerogative check should have relied on real CB/favor state');
// Seat 1 has no Casus Belli and isn't Furious yet, so this routed through a vote.
for (const seat of ['0', '1', '2', '3']) frameworkMove(seat, 'vote', true);
assert(state.G.pendingRevocation?.target === '1', 'the passed Revocation vote did not open a response window');
frameworkMove('1', 'respondRevocation', 'defy');
assert(state.G.activeRebellion?.leader === '1', 'Defy through the reducer did not start a rebellion');

frameworkMove('0', 'endCouncil');
while (state.G.draftPacks) {
  for (const seat of ['0', '1', '2', '3']) {
    const pack = state.G.draftPacks?.[seat];
    if (pack?.length) frameworkMove(seat, 'pickCard', pack[0].uid);
  }
}
for (let i = 0; i < 4; i++) frameworkMove(state.ctx.currentPlayer, 'pass');

// Phase 4 has now begun with a rebellion that was declared back in Council;
// activePlayers must already be narrowed to the first side-picker, exactly
// as a Phase-4-declared rebellion would leave it (test-rebellion-negotiation.mjs).
assert(JSON.stringify(state.ctx.activePlayers) === JSON.stringify({ '2': 'rebellionSides' }),
  'a Council-triggered rebellion did not resume at the correct stage in Phase 4');
assert(dispatch('3', 'chooseRebellionSide', 'loyal'),
  'boardgame.io allowed an out-of-order side declaration on a resumed rebellion');
frameworkMove('2', 'chooseRebellionSide', 'neutral');
frameworkMove('3', 'chooseRebellionSide', 'loyal');
frameworkMove('2', 'renegotiateRebellion', 'neutral');
frameworkMove('3', 'renegotiateRebellion', 'loyal');
frameworkMove('0', 'resolveRebellion');
assert(state.G.activeRebellion === null, 'the resumed rebellion did not resolve');

console.log('PASS: boardgame.io resumes a Council-triggered rebellion at the right Phase-4 stage.');
