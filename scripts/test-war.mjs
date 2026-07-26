// M3.1 checks: levy duty, simultaneous dial reveal, external-war strength,
// duty branding, scheme/character/Marshal bonuses, and casualties.
import { setup } from '../src/game/setup.js';
import { CONFIG } from '../src/config.js';
import { CrownAndFealty } from '../src/game/game.js';
import { warMoves, levyDuty } from '../src/game/moves.js';

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

function startWar(G) {
  G.pendingWar = { kingdomId: 'fk_weak', commits: {} };
}

function commitAll(G, counts) {
  for (const seat of ['0', '1', '2', '3']) {
    G.players[seat].troops = Math.max(G.players[seat].troops, counts[seat] || 0);
    const result = warMoves.commitTroops(context(G, seat), counts[seat] || 0);
    assert(result !== INVALID_MOVE, `seat ${seat} could not commit`);
  }
}

// Duty is levy value multiplied by the current law, rounded down.
const dutyGame = makeGame();
dutyGame.levyLaw = 'low';
assert(levyDuty(dutyGame, '1') === 2, 'low levy duty was not floored correctly');
dutyGame.levyLaw = 'high';
assert(levyDuty(dutyGame, '1') === 6, 'high levy duty was not computed from total levy');

// An under-commit brands a duke and creates one Casus Belli.
const underGame = makeGame();
startWar(underGame);
underGame.foreignKingdoms.find((kingdom) => kingdom.id === 'fk_weak').garrison = 0;
underGame.players['1'].troops = 5;
commitAll(underGame, { '0': 0, '1': 1, '2': 0, '3': 0 });
warMoves.revealWar(context(underGame, '0'), 1);
assert(underGame.favor['1'] === CONFIG.favor.onUnderCommitLevy,
  'under-commit did not reduce Favor');
assert(underGame.casusBelli['1'] === 1, 'under-commit did not create Casus Belli');
assert(underGame.log.some((line) => line.includes('under-commits')), 'under-commit was not branded');

// Giving every cube is dutiful even when the total is below the levy duty.
const allInGame = makeGame();
startWar(allInGame);
allInGame.foreignKingdoms.find((kingdom) => kingdom.id === 'fk_weak').garrison = 0;
allInGame.players['1'].troops = 1;
commitAll(allInGame, { '0': 0, '1': 1, '2': 0, '3': 0 });
warMoves.revealWar(context(allInGame, '0'), 1);
assert(allInGame.favor['1'] === 0, 'all-in commitment was incorrectly branded');
assert(!allInGame.casusBelli['1'], 'all-in commitment incorrectly created Casus Belli');
assert(allInGame.players['1'].prestige === CONFIG.prestige.warWinDutifulDuke,
  'all-in dutiful duke did not receive victory Prestige');

// Exceeding duty earns one Favor, while reveal is blocked until every seat
// has supplied a dial.
const revealGame = makeGame();
startWar(revealGame);
revealGame.foreignKingdoms.find((kingdom) => kingdom.id === 'fk_weak').garrison = 0;
revealGame.players['1'].troops = 6;
warMoves.commitTroops(context(revealGame, '1'), 4);
assert(warMoves.revealWar(context(revealGame, '0'), 1) === INVALID_MOVE,
  'war revealed before every seat set a dial');
commitAll(revealGame, { '0': 0, '1': 4, '2': 0, '3': 0 });
warMoves.revealWar(context(revealGame, '0'), 1);
assert(revealGame.favor['1'] === CONFIG.favor.onExceedLevy,
  'exceeding duty did not grant Favor');

// Before reveal, a player view exposes only that seat's own dial.
const hiddenGame = makeGame();
startWar(hiddenGame);
hiddenGame.players['1'].troops = 4;
warMoves.commitTroops(context(hiddenGame, '1'), 4);
const hiddenView = CrownAndFealty.playerView({ G: hiddenGame, playerID: '1' });
assert(hiddenView.pendingWar.commits['1'] === 4, 'own war dial was hidden');
assert(!Object.prototype.hasOwnProperty.call(hiddenView.pendingWar.commits, '0'),
  'another player\'s war dial leaked');
assert(hiddenView.players['0'].committed === null, 'another player\'s dial leaked through player state');

// Marshal +2, General +1, and Ambush +3 can turn a losing commitment into a
// victory; five committed cubes lose one cube on a winning battle.
const strengthGame = makeGame();
startWar(strengthGame);
strengthGame.players['0'].troops = 1;
strengthGame.players['1'].troops = 5;
strengthGame.players['1'].characters.push('chr_general');
strengthGame.players['1'].schemes.push({ uid: 'ambush_test', cardId: 'sch_ambush' });
commitAll(strengthGame, { '0': 1, '1': 5, '2': 0, '3': 0 });
warMoves.revealWar(context(strengthGame, '0'), 1);
const weakKingdom = strengthGame.foreignKingdoms.find((k) => k.id === 'fk_weak');
assert(weakKingdom.conquered, 'Marshal/General/Ambush strength did not win the war');
assert(strengthGame.players['1'].troops === 4, 'winning-war casualties were not applied');
assert(strengthGame.players['0'].troops === 1, 'one committed cube incorrectly suffered a casualty');

// Ending Phase 4 while a war is still pending is illegal.
const endGame = makeGame();
startWar(endGame);
assert(warMoves.endWarPhase({ G: endGame, playerID: '0', events: { endPhase() {} } }) === INVALID_MOVE,
  'war phase ended with an unresolved war');

console.log('PASS: M3.1 war checks.');
