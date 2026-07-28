// ==========================================================================
// M0 safety net: dry-runs setup + scoring directly (no moves/UI involved)
// and asserts prestige lands in the ranges PRD.md §6 calls "baseline"
// (unchallenged king, one office granted to duke 1). Guards against silent
// regressions to setup.js/scoring.js/config.js.
// ==========================================================================
import { setup, crownKing } from '../src/game/setup.js';
import { runHarvest, finalScores } from '../src/game/scoring.js';

function assertInRange(label, value, min, max) {
  if (value < min || value > max) {
    throw new Error(`${label} = ${value}, expected within [${min}, ${max}]`);
  }
  console.log(`  ok: ${label} = ${value} (within [${min}, ${max}])`);
}

// setup() shuffles the starter deck via the `random` plugin (§3 guardrail:
// no Math.random()). This script calls setup() directly, bypassing
// boardgame.io's plugin injection, so it needs a stub — deck order is
// irrelevant to the scoring math this test checks, so identity is fine.
const random = { Shuffle: (arr) => arr };
const ctx = { numPlayers: 4, playOrder: ['0', '1', '2', '3'] };
const G = setup({ ctx, random });
// §4: this script exercises the harvest/scoring spine, not the Crown auction
// — crown seat 0 directly at the old scaffold's default (no starting debt).
crownKing(G, ctx, '0', 0);
G.offices.steward = '1';

for (let y = 1; y <= 6; y++) {
  runHarvest(G);
  G.year++;
}

console.log('Pre-final prestige:', Object.fromEntries(
  Object.keys(G.players).map((s) => [s, G.players[s].prestige])
));
assertInRange('king (seat 0) pre-final prestige', G.players['0'].prestige, 26, 34);

const scores = finalScores(G);
console.log('Final scores:', scores);

assertInRange('king (seat 0) final score', scores['0'], 31, 39);
assertInRange('duke 1 (steward) final score', scores['1'], 10, 18);
assertInRange('duke 2 final score', scores['2'], 0, 7);
assertInRange('duke 3 final score', scores['3'], 0, 7);

console.log('PASS: scoring spine within expected baseline ranges.');
