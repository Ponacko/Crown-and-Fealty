// M7 checks: each seat only receives its own private hand, treasury, schemes,
// draft pack, and war dial. Public state remains available to every seat.
import assert from 'node:assert/strict';
import { CrownAndFealty } from '../src/game/game.js';
import { setup } from '../src/game/setup.js';

const G = setup({
  ctx: { numPlayers: 4, playOrder: ['0', '1', '2', '3'] },
  random: { Shuffle: (cards) => cards, Number: () => 0 },
});

G.players['0'].hand = [{ uid: 'own-card', cardId: 'act_taxfarmers' }];
G.players['0'].gold = 7;
G.players['0'].schemes = [{ uid: 'own-scheme', cardId: 'sch_ambush', targetSeat: '1' }];
G.players['0'].committed = 2;
G.players['1'].hand = [{ uid: 'other-card', cardId: 'act_marketday' }];
G.players['1'].gold = 11;
G.players['1'].schemes = [{ uid: 'other-scheme', cardId: 'sch_poison' }];
G.players['1'].committed = 4;
G.players['1'].prestige = 13;
G.deck = [{ uid: 'deck-card', cardId: 'act_gold' }];
G.draftPacks = {
  '0': [{ uid: 'own-pack-card', cardId: 'act_gold' }],
  '1': [{ uid: 'other-pack-card', cardId: 'act_marketday' }],
};
G.pendingWar = {
  kingdomId: 'fk_weak',
  commits: { '0': 2, '1': 4 },
  availableTroops: { '0': 5, '1': 6 },
  revealed: false,
};

const privateView = CrownAndFealty.playerView({ G, playerID: '0' });
assert.deepEqual(privateView.players['0'].hand, G.players['0'].hand);
assert.equal(privateView.players['0'].gold, 7);
assert.deepEqual(privateView.players['0'].schemes, G.players['0'].schemes);
assert.equal(privateView.players['0'].committed, 2);
assert.deepEqual(privateView.players['1'].hand, []);
assert.equal(privateView.players['1'].gold, null);
assert.deepEqual(privateView.players['1'].schemes, []);
assert.equal(privateView.players['1'].committed, null);
assert.equal(privateView.players['1'].prestige, 13, 'public prestige was not preserved');
assert.deepEqual(privateView.pendingWar.commits, { '0': 2 });
assert.deepEqual(privateView.pendingWar.availableTroops, { '0': 5 });
assert.equal(privateView.pendingWar.allCommitted, false);
assert.deepEqual(privateView.draftPacks, {
  '0': [{ uid: 'own-pack-card', cardId: 'act_gold' }],
});
assert.deepEqual(privateView.deck, []);

// The King may reveal the dials only after every seat commits. The private
// view must expose that public readiness fact without exposing any other
// seat's dial value; otherwise the King has no way to continue the war phase.
const readyWar = {
  ...G,
  pendingWar: {
    ...G.pendingWar,
    commits: { '0': 2, '1': 4, '2': 0, '3': 3 },
  },
};
const readyView = CrownAndFealty.playerView({ G: readyWar, playerID: '0' });
assert.equal(readyView.pendingWar.allCommitted, true,
  'the King cannot tell that every war dial is ready to reveal');
assert.deepEqual(readyView.pendingWar.commits, { '0': 2 },
  'war readiness leaked another seat\'s dial');

const revealed = {
  ...G,
  pendingWar: { ...G.pendingWar, revealed: true },
};
const revealedView = CrownAndFealty.playerView({ G: revealed, playerID: '0' });
assert.deepEqual(revealedView.pendingWar.commits, { '0': 2, '1': 4 });
assert.equal(revealedView.players['1'].committed, 4, 'revealed dial stayed hidden');
assert.deepEqual(revealedView.players['1'].hand, [], 'hands became public after reveal');
assert.equal(revealedView.players['1'].gold, null, 'treasury became public after reveal');
assert.deepEqual(revealedView.players['1'].schemes, [], 'schemes became public after reveal');

const noWarView = CrownAndFealty.playerView({ G: { ...G, pendingWar: null }, playerID: '0' });
assert.deepEqual(noWarView.players['1'].hand, []);
assert.equal(noWarView.players['1'].gold, null);
assert.deepEqual(noWarView.players['1'].schemes, []);

// Building a view must not mutate the authoritative state.
assert.deepEqual(G.players['1'].hand, [{ uid: 'other-card', cardId: 'act_marketday' }]);
assert.equal(G.players['1'].gold, 11);
assert.equal(G.deck.length, 1);

console.log('PASS: playerView hidden-information checks.');
