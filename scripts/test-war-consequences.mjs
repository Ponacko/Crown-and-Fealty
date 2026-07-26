// M3.2 checks: conquered-land distribution, sacking, defeat obligations,
// occupation, reparations, transfers, and Domain Limit enforcement.
import { setup } from '../src/game/setup.js';
import { CONFIG } from '../src/config.js';
import { provinceCount } from '../src/game/scoring.js';
import { warMoves } from '../src/game/moves.js';

const INVALID_MOVE = 'INVALID_MOVE';
const random = { Shuffle: (cards) => cards, Number: () => 0 };
const context = (G, playerID) => ({ G, playerID, random });

function makeGame() {
  return setup({
    ctx: { numPlayers: 4, playOrder: ['0', '1', '2', '3'] },
    random,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function prepareWar(G, { victory }) {
  const kingdom = G.foreignKingdoms.find((entry) => entry.id === 'fk_weak');
  kingdom.garrison = victory ? 0 : kingdom.baseGarrison;
  G.players['0'].troops = victory ? 1 : 0;
  for (const duke of ['1', '2', '3']) G.players[duke].troops = 0;
  if (!victory) G.players['1'].troops = 4;
  G.pendingWar = {
    kingdomId: kingdom.id,
    commits: { '0': victory ? 1 : 0, '1': victory ? 0 : 4, '2': 0, '3': 0 },
    availableTroops: { '0': victory ? 1 : 0, '1': victory ? 0 : 4, '2': 0, '3': 0 },
    revealed: true,
  };
}

// Victory keeps only the available Domain Limit and leaves every surplus as
// an explicit king decision instead of silently ending the phase.
const victoryGame = makeGame();
prepareWar(victoryGame, { victory: true });
warMoves.resolveWar(context(victoryGame, '0'), 1);
assert(victoryGame.foreignKingdoms.find((entry) => entry.id === 'fk_weak').conquered,
  'victory did not mark the foreign kingdom conquered');
assert(provinceCount(victoryGame, '0') === CONFIG.domainLimit,
  'victory let the king exceed Domain Limit');
assert(victoryGame.pendingConquest?.provinceIds.length === 4,
  'victory did not queue all surplus foreign provinces');
assert(warMoves.endWarPhase({ G: victoryGame, playerID: '0', events: { endPhase() {} } }) === INVALID_MOVE,
  'war phase ended before conquest distribution');

const firstConquest = victoryGame.pendingConquest.provinceIds[0];
warMoves.grantConquest({ G: victoryGame, playerID: '0' }, firstConquest, '1');
assert(victoryGame.provinces[firstConquest].owner === '1', 'conquest was not granted to the duke');
assert(victoryGame.favor['1'] === CONFIG.favor.onGrantProvince,
  'granting conquest did not award grant Favor');

for (const provinceId of [...victoryGame.pendingConquest.provinceIds]) {
  warMoves.sackConquest({ G: victoryGame, playerID: '0' }, provinceId);
}
assert(victoryGame.pendingConquest === null, 'sacked conquest obligations remained');
assert(!victoryGame.provinces[victoryGame.pendingConquest?.provinceIds?.[0]],
  'sacked province remained on the map');
warMoves.endWarPhase({ G: victoryGame, playerID: '0', events: { endPhase() {} } });

// Defeat applies negative reparations, double casualties, Favor penalties,
// and leaves one legal occupation choice that must be resolved before Phase 4
// can end.
const defeatGame = makeGame();
prepareWar(defeatGame, { victory: false });
defeatGame.players['0'].gold = 1;
warMoves.resolveWar(context(defeatGame, '0'), 1);
assert(defeatGame.warLostThisYear, 'defeat did not set warLostThisYear');
assert(defeatGame.players['0'].gold === 1 - CONFIG.warReparationsGold,
  'reparations did not reduce the king treasury');
assert(defeatGame.players['1'].troops === 2, 'defeat did not apply double casualties');
assert(defeatGame.favor['2'] === CONFIG.favor.onKingWarLoss,
  'defeat did not penalize duke Favor');
assert(defeatGame.pendingOccupation?.provinceIds.length > 0,
  'defeat did not create an occupation choice');
assert(warMoves.endWarPhase({ G: defeatGame, playerID: '0', events: { endPhase() {} } }) === INVALID_MOVE,
  'war phase ended before occupation was chosen');

const occupiedId = defeatGame.pendingOccupation.provinceIds[0];
warMoves.occupyProvince({ G: defeatGame, playerID: '0' }, occupiedId);
assert(defeatGame.provinces[occupiedId].owner === null, 'occupied province stayed king-owned');
assert(defeatGame.provinces[occupiedId].faceUp === false, 'occupied province was not hidden');
assert(defeatGame.provinces[occupiedId].occupiedBy === 'fk_weak', 'wrong kingdom occupied province');
assert(defeatGame.pendingOccupation === null, 'occupation choice was not consumed');

const dukeGoldBefore = defeatGame.players['1'].gold;
warMoves.transferGold(context(defeatGame, '1'), '0', 2);
assert(defeatGame.players['1'].gold === dukeGoldBefore - 2, 'duke transfer did not deduct gold');
assert(defeatGame.players['0'].gold === 1 - CONFIG.warReparationsGold + 2,
  'duke transfer did not cover the king debt');
warMoves.endWarPhase({ G: defeatGame, playerID: '0', events: { endPhase() {} } });

// A pre-existing over-limit crown cannot close Phase 4 either.
const overLimitGame = makeGame();
overLimitGame.provinces.a1.owner = '0';
assert(provinceCount(overLimitGame, '0') > CONFIG.domainLimit, 'over-limit setup failed');
assert(warMoves.endWarPhase({ G: overLimitGame, playerID: '0', events: { endPhase() {} } }) === INVALID_MOVE,
  'over-limit crown was allowed to end the war phase');

console.log('PASS: M3.2 war consequence checks.');
