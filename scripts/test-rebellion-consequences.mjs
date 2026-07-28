// M4.3 checks: both rebellion branches apply land, prestige, Favor, neutral,
// cooldown, crown, and troop consequences.
import { setup, crownKing } from '../src/game/setup.js';
import { warMoves } from '../src/game/moves.js';
import { adjustFavor, runHarvest } from '../src/game/scoring.js';
import { CONFIG } from '../src/config.js';

const random = { Shuffle: (cards) => cards, Number: () => 0 };
const ctx = { numPlayers: 4, playOrder: ['0', '1', '2', '3'] };

// §4: this script exercises rebellion consequences, not the Crown auction —
// crown seat 0 directly at the old scaffold's default (no starting debt).
function makeGame(sides) {
  const G = setup({ ctx, random });
  crownKing(G, ctx, '0', 0);
  G.activeRebellion = { leader: '1', sides, step: 'locked' };
  return G;
}

function context(G) {
  return { G, playerID: '0' };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function owned(G, seat) {
  return Object.values(G.provinces).filter((province) => province.owner === seat);
}

// Rebels win: capital transfers, loyalists lose up to two provinces, the old
// King is trimmed to three non-capital provinces, and stripped land goes to
// the winning rebel coalition without pushing the new King over his limit.
const rebelWin = makeGame({ '2': 'rebel', '3': 'loyal' });
rebelWin.players['1'].troops = 20;
rebelWin.players['0'].troops = 0;
rebelWin.players['2'].troops = 4;
rebelWin.players['3'].troops = 0;
rebelWin.favor['2'] = 2;
rebelWin.favor['3'] = 1;
warMoves.resolveRebellion(context(rebelWin));
assert(rebelWin.crownHolder === '1', 'rebel leader did not take the Crown');
assert(rebelWin.provinces.cap.owner === '1', 'Capital did not transfer to the new King');
assert(rebelWin.players['1'].prestige === CONFIG.prestige.usurperBonus,
  'rebel leader did not receive the usurper Prestige bonus');
assert(owned(rebelWin, '3').length === 1, 'loyalist was not stripped by up to two provinces');
assert(owned(rebelWin, '0').filter((province) => !province.capital).length === 3,
  'deposed King was not trimmed to duke size');
assert(owned(rebelWin, '1').length <= CONFIG.domainLimit,
  'new King exceeded Domain Limit after the rebellion');
assert(rebelWin.favor['2'] === 0 && rebelWin.favor['3'] === 0 && rebelWin.favor['0'] === 0,
  'new reign did not reset Favor');
assert(rebelWin.players['1'].troops === 15 && rebelWin.players['2'].troops === 3,
  'civil-war troop casualties were not applied to every player');

// With no rebel duke ally, the mandatory deposed-King trim still wins the
// single available Crown slot; optional Loyalist stripping yields to it.
const loneRebelWin = makeGame({ '2': 'loyal', '3': 'neutral' });
loneRebelWin.players['1'].troops = 20;
loneRebelWin.players['0'].troops = 0;
warMoves.resolveRebellion(context(loneRebelWin));
assert(owned(loneRebelWin, '0').filter((province) => !province.capital).length === 3,
  'mandatory deposed-King trim was lost when the winning coalition had no duke ally');
assert(owned(loneRebelWin, '1').length <= CONFIG.domainLimit,
  'lone new King exceeded Domain Limit while distributing rebellion land');

// A Rebel Leader who already holds more than the Crown limit is trimmed
// before the new reign distributes land to a rebel duke ally.
const overLimitRebelWin = makeGame({ '2': 'rebel', '3': 'loyal' });
overLimitRebelWin.provinces.m1.owner = '1';
overLimitRebelWin.provinces.m2.owner = '1';
overLimitRebelWin.players['1'].troops = 20;
overLimitRebelWin.players['0'].troops = 0;
warMoves.resolveRebellion(context(overLimitRebelWin));
assert(owned(overLimitRebelWin, '1').length <= CONFIG.domainLimit,
  'an over-limit Rebel Leader kept too much land after taking the Crown');
assert(owned(overLimitRebelWin, '2').length > 3,
  'over-limit Crown land was not redistributed to the rebel coalition');

// Neutrality is safe but never free: under a new King, a Neutral starts at -1.
const neutralWin = makeGame({ '2': 'rebel', '3': 'neutral' });
neutralWin.players['1'].troops = 20;
neutralWin.players['0'].troops = 0;
warMoves.resolveRebellion(context(neutralWin));
assert(neutralWin.favor['3'] === -1, 'new King did not penalize a Neutral seat');

// King wins: leader loses Prestige and two provinces, other rebels lose one,
// Loyalists receive stripped land first with Favor, and all rebels enter the
// floor/cooldown state.
const kingWin = makeGame({ '2': 'loyal', '3': 'rebel' });
kingWin.players['0'].troops = 20;
kingWin.players['1'].troops = 0;
kingWin.players['2'].troops = 0;
kingWin.players['3'].troops = 0;
warMoves.resolveRebellion(context(kingWin));
assert(kingWin.crownHolder === '0', 'King-win branch changed the Crown');
assert(kingWin.players['1'].prestige === CONFIG.prestige.failedRebelLeader,
  'rebel leader did not lose the failed-rebellion Prestige');
assert(owned(kingWin, '1').length === 1, 'King did not strip two provinces from rebel leader');
assert(owned(kingWin, '3').length === 2, 'King did not strip one province from other rebel');
assert(owned(kingWin, '2').length === 6,
  'stripped land was not awarded to Loyalists before the King');
assert(kingWin.favor['1'] === CONFIG.rebellionFavorFloor &&
  kingWin.favor['3'] === CONFIG.rebellionFavorFloor,
  'all rebels did not drop to the Favor floor');
assert(kingWin.players['1'].rebelCooldownUntilYear === 2 &&
  kingWin.players['3'].rebelCooldownUntilYear === 2,
  'all rebels did not receive the one-year cooldown');
assert(kingWin.favor['2'] === 3,
  'Loyalist did not gain Favor for receiving stripped land');

// Gifts and other Favor increases stay blocked through the next Harvest, then
// recover normally after the cooldown thaws.
const favorBefore = kingWin.favor['1'];
adjustFavor(kingWin, '1', 1, 'cooldown test');
assert(kingWin.favor['1'] === favorBefore, 'rebel Favor rose during cooldown');
kingWin.year = 2;
runHarvest(kingWin);
kingWin.year = 3;
adjustFavor(kingWin, '1', 1, 'post-cooldown test');
assert(kingWin.favor['1'] === CONFIG.rebellionFavorFloor + 1,
  'rebel Favor did not recover after the next Harvest');

// King-win neutrality still costs one Favor.
const neutralKingWin = makeGame({ '2': 'neutral', '3': 'rebel' });
neutralKingWin.players['0'].troops = 20;
neutralKingWin.players['1'].troops = 0;
neutralKingWin.players['3'].troops = 0;
warMoves.resolveRebellion(context(neutralKingWin));
assert(neutralKingWin.favor['2'] === -1, 'King-win branch did not penalize a Neutral');

console.log('PASS: M4.3 rebellion consequence checks.');
