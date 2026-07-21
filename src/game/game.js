// ==========================================================================
// THE GAME OBJECT — phases, turn model, end condition.
// Year = council -> draft -> actions -> warAndRebellion -> harvest -> (loop)
// ==========================================================================
import { ActivePlayers } from 'boardgame.io/core';
import { CONFIG } from '../config.js';
import { setup } from './setup.js';
import { finalScores } from './scoring.js';
import {
  councilMoves,
  draftMoves,
  actionMoves,
  warMoves,
  harvestMoves,
} from './moves.js';

export const CrownAndFealty = {
  name: 'crown-and-fealty',

  minPlayers: 4,
  maxPlayers: 6,

  setup,

  // Hotseat/debug: everyone is always active, so any seat can act at any time
  // and you drive the flow from the debug panel. Role gating is done inside
  // moves (king-only checks). Swap to stages/turn order for strict play later.
  turn: { activePlayers: ActivePlayers.ALL },

  phases: {
    council: {
      start: true,
      next: 'draft',
      moves: councilMoves,
    },
    draft: {
      next: 'actions',
      moves: draftMoves,
    },
    actions: {
      next: 'warAndRebellion',
      moves: actionMoves,
    },
    warAndRebellion: {
      next: 'harvest',
      moves: warMoves,
    },
    harvest: {
      next: 'council',
      moves: harvestMoves,
    },
  },

  // Fixed horizon (§2): game ends once we roll past the final year.
  endIf: ({ G }) => {
    if (G.year > CONFIG.years) {
      const scores = finalScores(G);
      // Winner = highest prestige.
      let winner = null;
      for (const seat of Object.keys(scores)) {
        if (winner === null || scores[seat] > scores[winner]) winner = seat;
      }
      return { scores, winner };
    }
  },

  // Multiplayer hidden info (only meaningful across networked clients).
  // In local/hotseat play everything is visible. TODO: redact other players'
  // hands, gold, and face-down schemes for networked playtests.
  playerView: ({ G, playerID }) => G,
};
