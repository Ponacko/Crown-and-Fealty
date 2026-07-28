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
  resumeRebellionStage,
} from './moves.js';

const crownHolderPos = (G, ctx) => ctx.playOrder.indexOf(G.crownHolder);

// §5: the crown-holder is the sole actor in Harvest and always leads off the
// Actions phase. Council is simultaneous after the King proposes, so every
// seat is active there. A phase's `turn` config completely
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
      // §5 Council: the King proposes; every seat may then vote or transfer
      // cash openly. Move-level guards keep proposal/end controls royal.
      start: true,
      next: 'draft',
      turn: { activePlayers: ActivePlayers.ALL },
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
      // §5 Phase 4: all seats can set a secret war dial simultaneously; the
      // King reveals once every seat has committed. Rebellion sequencing is
      // layered on by M4: its moves replace activePlayers dynamically with
      // one side-picker (plus the King during negotiation).
      next: 'harvest',
      turn: {
        activePlayers: { all: 'warCommit' },
        // §11: a Revocation Defied during Council already set G.activeRebellion
        // before Phase 4 began; resume it at the right stage instead of leaving
        // everyone in the default war-commit stage (see moves.js resumeRebellionStage).
        onBegin: ({ G, events }) => resumeRebellionStage(G, events),
        stages: {
          warCommit: { moves: warMoves },
          rebellionSides: { moves: warMoves },
          rebellionNegotiation: { moves: warMoves },
          rebellionNegotiationKing: { moves: warMoves },
          rebellionLocked: { moves: warMoves },
        },
      },
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

  // Multiplayer hidden info. M3.1's war dials are private until reveal;
  // M7 will extend this redaction to hands, treasuries, and face-down schemes.
  playerView: ({ G, playerID }) => {
    if (playerID == null || !G.pendingWar || G.pendingWar.revealed) return G;
    const visibleCommits = Object.prototype.hasOwnProperty.call(
      G.pendingWar.commits, playerID
    ) ? { [playerID]: G.pendingWar.commits[playerID] } : {};
    const visibleAvailable = Object.prototype.hasOwnProperty.call(
      G.pendingWar.availableTroops || {}, playerID
    ) ? { [playerID]: G.pendingWar.availableTroops[playerID] } : {};
    const players = Object.fromEntries(Object.entries(G.players).map(([seat, player]) => [
      seat,
      seat === playerID ? player : { ...player, committed: null },
    ]));
    return {
      ...G,
      players,
      pendingWar: {
        ...G.pendingWar,
        commits: visibleCommits,
        availableTroops: visibleAvailable,
      },
    };
  },
};
