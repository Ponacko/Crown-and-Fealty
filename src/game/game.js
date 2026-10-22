// ==========================================================================
// THE GAME OBJECT — phases, turn model, end condition.
// Year = council -> draft -> actions -> warAndRebellion -> harvest -> (loop)
// ==========================================================================
import { ActivePlayers } from 'boardgame.io/dist/esm/core.js';
import { CONFIG } from '../config.js';
import { setup } from './setup.js';
import {
  auctionMoves,
  resolveAuction,
  councilMoves,
  draftMoves,
  dealDraftPacks,
  actionMoves,
  warMoves,
  harvestMoves,
  resumeRebellionStage,
} from './moves.js';

const crownHolderPos = (G, ctx) => ctx.playOrder.indexOf(G.crownHolder);

// §4: a seat is "contested" in the Crown auction while it hasn't passed and
// isn't the current high bidder — the high bidder simply waits until either
// everyone else has passed (they win) or someone outbids them (making them
// contested again, so they get a turn to respond).
const contestedAuctionSeats = (G, ctx) => ctx.playOrder.filter((seat) =>
  !G.auction.passed[seat] && seat !== G.auction.highBidder);

// A single action (bid or pass) per turn; the next contested seat goes after
// the current one, wrapping around. Returning undefined — no contested seat
// left — ends the phase automatically (see the `actions` phase below for the
// same convention), landing in onEnd to crown the winner.
const auctionTurn = () => ({
  order: {
    first: () => 0,
    next: ({ G, ctx }) => {
      const contested = contestedAuctionSeats(G, ctx);
      if (contested.length === 0) return undefined;
      const n = ctx.playOrder.length;
      for (let step = 1; step <= n; step++) {
        const pos = (ctx.playOrderPos + step) % n;
        if (contested.includes(ctx.playOrder[pos])) return pos;
      }
      return undefined;
    },
  },
  endIf: () => true, // one move ends the turn; see actions phase's endIf for contrast
});

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

// The server keeps one complete G, but a multiplayer client must only receive
// the private information belonging to its seat. Keep the public player shape
// intact so consumers can render every seat, replacing secret values with
// neutral values rather than deleting fields that moves/UI code expect.
function redactPlayer(player, seat, playerID, warRevealed) {
  const isViewer = seat === playerID;
  return {
    ...player,
    hand: isViewer ? player.hand.map((card) => ({ ...card })) : [],
    gold: isViewer ? player.gold : null,
    schemes: isViewer ? player.schemes.map((scheme) => ({ ...scheme })) : [],
    committed: isViewer || warRevealed ? player.committed : null,
  };
}

function redactDraftPacks(draftPacks, playerID) {
  if (!draftPacks) return draftPacks;
  const ownPack = draftPacks[playerID];
  return ownPack
    ? { [playerID]: ownPack.map((card) => ({ ...card })) }
    : {};
}

function redactPendingWar(pendingWar, playerID, playerSeats) {
  if (!pendingWar) return pendingWar;
  const commits = pendingWar.revealed
    ? { ...pendingWar.commits }
    : Object.prototype.hasOwnProperty.call(pendingWar.commits, playerID)
      ? { [playerID]: pendingWar.commits[playerID] }
      : {};
  const availableTroops = Object.prototype.hasOwnProperty.call(
    pendingWar.availableTroops || {}, playerID
  ) ? { [playerID]: pendingWar.availableTroops[playerID] } : {};
  // Whether every seat has supplied a dial is public information: the King
  // needs it to reveal, while the counts themselves remain secret until then.
  const allCommitted = playerSeats.every((seat) =>
    Object.prototype.hasOwnProperty.call(pendingWar.commits, seat));
  return { ...pendingWar, commits, availableTroops, allCommitted };
}

export const CrownAndFealty = {
  name: 'crown-and-fealty',

  minPlayers: 4,
  maxPlayers: 6,

  setup,

  // Default for phases that don't override it below (draft, warAndRebellion):
  // every seat is active at once, in any order, until the phase ends.
  turn: { activePlayers: ActivePlayers.ALL },

  phases: {
    auction: {
      // §4: the Crown is auctioned before Year 1 begins — an open-ascending
      // bid in negative starting Prestige. See auctionTurn/contestedAuctionSeats
      // above and auctionMoves/resolveAuction in moves.js.
      start: true,
      next: 'council',
      turn: auctionTurn(),
      onEnd: ({ G, ctx }) => resolveAuction(G, ctx),
      moves: auctionMoves,
    },
    council: {
      // §5 Council: the King proposes; every seat may then vote or transfer
      // cash openly. Move-level guards keep proposal/end controls royal.
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

  // Multiplayer hidden info. Hands, treasuries, face-down schemes, draft
  // packs, and the undealt deck stay private to the relevant client. War dials
  // are private until the King reveals them together.
  playerView: ({ G, playerID }) => {
    if (playerID == null || !(playerID in G.players)) return G;
    const warRevealed = Boolean(G.pendingWar?.revealed);
    const players = Object.fromEntries(Object.entries(G.players).map(([seat, player]) => [
      seat,
      redactPlayer(player, seat, playerID, warRevealed),
    ]));
    return {
      ...G,
      players,
      deck: [],
      draftPacks: redactDraftPacks(G.draftPacks, playerID),
      pendingWar: redactPendingWar(G.pendingWar, playerID, Object.keys(G.players)),
    };
  },
};
