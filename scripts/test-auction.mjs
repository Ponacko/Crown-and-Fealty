// M6 checks: the Crown is auctioned before Year 1 (§4) — an open-ascending
// bid in negative starting Prestige. Highest bidder becomes King at
// -(bid) prestige; remaining seats are assigned duchies exactly as the old
// fixed-seat-0 setup did, just parametrized by whoever actually won.
import { setup, crownKing } from '../src/game/setup.js';
import { CONFIG } from '../src/config.js';
import { auctionMoves } from '../src/game/moves.js';
import { CrownAndFealty } from '../src/game/game.js';
import { createRequire } from 'node:module';

const INVALID_MOVE = 'INVALID_MOVE';
const random = { Shuffle: (cards) => cards };

function makeGame() {
  return setup({
    ctx: { numPlayers: 4, playOrder: ['0', '1', '2', '3'] },
    random,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- setup() alone leaves the Crown undecided until the auction resolves. ---
const defaultGame = makeGame();
assert(defaultGame.crownHolder === null, 'setup() should not assign a King before the auction');
assert(Object.keys(defaultGame.favor).length === 0,
  'setup() should not assign duchies/Favor before the auction');
assert(defaultGame.offices.marshal === null, 'setup() should not seat a Marshal before the auction');
assert(Object.values(defaultGame.players).every((p) => !p.isKing && p.gold === 0 && p.troops === 0),
  'setup() should not hand out starting gold/troops before the auction');
assert(Object.values(defaultGame.provinces).every((p) => p.owner === null),
  'setup() should leave every province unowned before the auction');
assert(defaultGame.auction.resolved === false, 'setup() marked the auction resolved');
assert(defaultGame.auction.highBid === -1 && defaultGame.auction.highBidder === null,
  'setup() should start with no bids placed');

// --- crownKing() can re-crown a different seat, overwriting the default. ---
const recrownedGame = makeGame();
crownKing(recrownedGame, { playOrder: ['0', '1', '2', '3'] }, '2', 5);
assert(recrownedGame.crownHolder === '2', 'crownKing did not move the Crown to seat 2');
assert(recrownedGame.players['2'].prestige === -5,
  'the winning bid was not applied as starting Prestige debt');
assert(recrownedGame.players['2'].isKing, 'crownKing did not flag the new King');
assert(recrownedGame.players['2'].gold === CONFIG.startGold.king,
  'the new King did not get King starting gold');
for (const duke of ['0', '1', '3']) {
  assert(recrownedGame.players[duke].gold === CONFIG.startGold.duke,
    `seat ${duke} did not get Duke starting gold after re-crowning`);
  assert(recrownedGame.players[duke].prestige === 0,
    `seat ${duke} kept nonzero Prestige after re-crowning`);
  assert(duke in recrownedGame.favor, `seat ${duke} was not given a Favor track`);
}
assert(!('2' in recrownedGame.favor), 'the King should not have a Favor track');
assert(recrownedGame.offices.marshal === '2', 'the Marshal office did not follow the new King');
const crownProvince = Object.values(recrownedGame.provinces).find((p) => p.id === 'cap');
assert(crownProvince.owner === '2', 'the Capital did not transfer to the new King');
const duchyOwners = new Set(Object.values(recrownedGame.provinces)
  .filter((p) => p.region === 'duchyA' || p.region === 'duchyB' || p.region === 'duchyC')
  .map((p) => p.owner));
assert(!duchyOwners.has('2'), 'the new King should not also hold a duchy');

// --- auctionMoves.bid: must strictly exceed the standing high bid. ---
const bidGame = makeGame();
assert(auctionMoves.bid({ G: bidGame, playerID: '1' }, 3) !== INVALID_MOVE,
  'an opening bid of 3 was rejected');
assert(bidGame.auction.highBid === 3 && bidGame.auction.highBidder === '1',
  'the bid was not recorded');
assert(auctionMoves.bid({ G: bidGame, playerID: '2' }, 3) === INVALID_MOVE,
  'a tying bid was accepted');
assert(auctionMoves.bid({ G: bidGame, playerID: '2' }, 2) === INVALID_MOVE,
  'a lower bid was accepted');
assert(auctionMoves.bid({ G: bidGame, playerID: '2' }, 4) !== INVALID_MOVE,
  'a strictly higher bid was rejected');
assert(auctionMoves.bid({ G: bidGame, playerID: '0' }, -1) === INVALID_MOVE,
  'a negative bid was accepted');

// --- auctionMoves.passAuction: a folded seat can't act again. ---
const passGame = makeGame();
assert(auctionMoves.passAuction({ G: passGame, ctx: { playOrder: ['0', '1', '2', '3'] }, playerID: '1' })
  !== INVALID_MOVE, 'a normal pass was rejected');
assert(auctionMoves.passAuction({ G: passGame, ctx: { playOrder: ['0', '1', '2', '3'] }, playerID: '1' })
  === INVALID_MOVE, 'a seat passed twice');

// --- The last standing bidder can't fold — the Crown can't go to nobody. ---
const forcedGame = makeGame();
const ctx4 = { playOrder: ['0', '1', '2', '3'] };
for (const seat of ['0', '1', '2']) auctionMoves.passAuction({ G: forcedGame, ctx: ctx4, playerID: seat });
assert(auctionMoves.passAuction({ G: forcedGame, ctx: ctx4, playerID: '3' }) === INVALID_MOVE,
  'the sole remaining bidder was allowed to fold, leaving nobody to take the Crown');
assert(auctionMoves.bid({ G: forcedGame, playerID: '3' }, 0) !== INVALID_MOVE,
  'the sole remaining bidder could not claim the Crown for free');

console.log('PASS: M6 auction move checks.');

// --- The real reducer: a genuine ascending auction where a DUKE (not seat 0)
// wins, exercising the turn order (skip the standing high bidder; give a
// re-contested seat another turn once outbid) and the automatic transition
// into Council once no contested seat remains.
const require = createRequire(import.meta.url);
const { CreateGameReducer, InitializeGame } = require('boardgame.io/internal');
const reducer = CreateGameReducer({ game: CrownAndFealty, isClient: false });
let state = InitializeGame({ game: CrownAndFealty, numPlayers: 4 });

function dispatch(playerID, type, ...args) {
  state = reducer(state, { type: 'MAKE_MOVE', payload: { playerID, type, args } });
  const error = state.transients?.error;
  state = { ...state, transients: undefined };
  return error;
}

function frameworkMove(playerID, type, ...args) {
  const error = dispatch(playerID, type, ...args);
  assert(!error, `framework rejected seat ${playerID} -> ${type}: ${JSON.stringify(error)}`);
}

function frameworkReject(playerID, type, ...args) {
  const error = dispatch(playerID, type, ...args);
  assert(error, `expected seat ${playerID} -> ${type} to be rejected but it succeeded`);
}

assert(state.ctx.phase === 'auction', 'the game did not open on the Crown auction');
assert(state.ctx.currentPlayer === '0', 'the auction did not start with seat 0');

// A seat that isn't up can't act out of turn.
frameworkReject('1', 'bid', 10);

frameworkMove('0', 'bid', 1);
frameworkMove('1', 'bid', 3);
frameworkMove('2', 'bid', 5);
frameworkMove('3', 'passAuction');
// Seat 0, outbid, gets another turn instead of being skipped forever.
assert(state.ctx.currentPlayer === '0', 'an outbid seat was not given another turn');
frameworkMove('0', 'passAuction');
frameworkMove('1', 'passAuction');

assert(state.ctx.phase === 'council', 'the auction did not advance into Council once resolved');
assert(state.G.auction.resolved && state.G.auction.winner === '2',
  'the highest bidder (seat 2) did not win the auction');
assert(state.G.crownHolder === '2', 'seat 2 was not crowned');
assert(state.G.players['2'].prestige === -5,
  'the winning bid was not applied as starting Prestige debt');
assert(state.G.offices.marshal === '2', 'the Marshal office did not follow the winning bidder');
for (const duke of ['0', '1', '3']) {
  assert(duke in state.G.favor, `seat ${duke} was not assigned a duchy/Favor track`);
}

console.log('PASS: the real reducer resolves an ascending Crown auction and crowns the winner.');
