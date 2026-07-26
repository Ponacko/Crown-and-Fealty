// ==========================================================================
// THE GAME OBJECT — phases, turn model, end condition.
// Year = council -> draft -> actions -> warAndRebellion -> harvest -> (loop)
// ==========================================================================
import { ActivePlayers } from 'boardgame.io/dist/esm/core.js';
import { CONFIG } from '../config.js';
import { setup } from './setup.js';
import {
  councilMoves,
  draftMoves,
  dealDraftPacks,
  actionMoves,
  warMoves,
  harvestMoves,
} from './moves.js';

const crownHolderPos = (G, ctx) => ctx.playOrder.indexOf(G.crownHolder);

// §5: the crown-holder is always the sole actor in Council and Harvest, and
// always leads off the Actions phase. A phase's `turn` config completely
// replaces the game-level default (no key-by-key merge), so anywhere we set
// `turn.order` we own the whole turn config for that phase. boardgame.io
// mutates each phase's `turn` object in place, so hand each phase its own
// (a factory, not a shared literal).
const crownHolderOnly = () => ({
  order: {
    first: ({ G, ctx }) => crownHolderPos(G, ctx),
    next: () => undefined, // a single turn; the phase always ends via its own end move
  },
});

export const CrownAndFealty = {
  name: 'crown-and-fealty',

  minPlayers: 4,
  maxPlayers: 6,

  setup,

  // Default for phases that don't override it below (draft, warAndRebellion):
  // every seat is active at once, in any order, until the phase ends.
  turn: { activePlayers: ActivePlayers.ALL },

  phases: {
    council: {
      // §5 Council: only the crown-holder may act; other seats cannot.
      start: true,
      next: 'draft',
      turn: crownHolderOnly(),
      moves: councilMoves,
    },
    draft: {
      // §5/§9 Phase 2 (Inis-style pick-and-pass): every seat is active at
      // once (inherited ActivePlayers.ALL) for each pick step. Packs are
      // dealt here; the phase ends itself once dealDraftPacks/pickCard
      // (moves.js) resolve the final round.
      next: 'actions',
      onBegin: ({ G, ctx, random, events }) => {
        if (dealDraftPacks(G, ctx, random)) events.endPhase();
      },
      moves: draftMoves,
    },
    actions: {
      // §5 Phase 3: sequential turns clockwise starting from the king. Each
      // player's turn begins with a full action budget and ends as soon as
      // it's spent (or the player passes early); the phase itself ends once
      // everyone has gone exactly once.
      next: 'warAndRebellion',
      turn: {
        order: {
          first: ({ G, ctx }) => crownHolderPos(G, ctx),
          next: ({ G, ctx }) => {
            const stepsTaken =
              (ctx.playOrderPos - crownHolderPos(G, ctx) + ctx.playOrder.length) %
              ctx.playOrder.length;
            if (stepsTaken < ctx.playOrder.length - 1) {
              return (ctx.playOrderPos + 1) % ctx.playOrder.length;
            }
            return undefined; // everyone has had a turn — end the phase
          },
        },
        onBegin: ({ G, ctx }) => {
          G.players[ctx.currentPlayer].actionsLeft = CONFIG.actionsPerTurn;
        },
        endIf: ({ G, ctx }) => G.players[ctx.currentPlayer].actionsLeft <= 0,
      },
      moves: actionMoves,
    },
    warAndRebellion: {
      // §5 Phase 4: who's active when is finished in M3/M4. For now, inherit
      // ActivePlayers.ALL so commitTroops/declareRebellion/etc. keep working.
      next: 'harvest',
      moves: warMoves,
    },
    harvest: {
      // Automatic; only the crown-holder advances (endHarvest).
      next: 'council',
      turn: crownHolderOnly(),
      moves: harvestMoves,
    },
  },

  // Fixed horizon (§2): game ends once we roll past the final year.
  // G.finalScores is computed in moves.js's endHarvest (a move, where
  // mutating G is legal) — endIf must stay a pure read, never mutate G.
  endIf: ({ G }) => {
    if (G.year > CONFIG.years) {
      let winner = null;
      for (const seat of Object.keys(G.finalScores)) {
        if (winner === null || G.finalScores[seat] > G.finalScores[winner]) winner = seat;
      }
      return { scores: G.finalScores, winner };
    }
  },

  // Multiplayer hidden info (only meaningful across networked clients).
  // In local/hotseat play everything is visible. TODO: redact other players'
  // hands, gold, and face-down schemes for networked playtests.
  playerView: ({ G, playerID }) => G,
};
