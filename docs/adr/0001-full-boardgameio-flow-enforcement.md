# Enforce turn flow with boardgame.io phases, turn order, and stages

The scaffold ran `turn: { activePlayers: ALL }` and gated roles with `if (playerID
=== king)` checks inside each move — any seat could act any time. We are replacing
that with real boardgame.io flow: per-phase `activePlayers`, a clockwise
`turn.order` seeded from the King for the Actions phase, and `stages` for the
genuinely simultaneous steps (Draft pick, secret War commitment). Out-of-turn moves
are rejected by the framework, not by hand-written guards.

## Why

M1 ("real turn structure") is the change that makes this feel like a game, and two
later goals — hidden information (`playerView`) and networked multiplayer — are only
coherent on top of real `activePlayers`. Doing it with the framework rather than a
soft `G.currentActor` flag avoids re-implementing turn management and prevents the
accidental info leaks / replay desync a hand-rolled version invites.

## Consequences

- The debug panel can still switch seats freely; enforcement is per-move legality,
  not a lock on the harness.
- Actions phase is **round-robin, one action per turn**, clockwise from the King,
  until every seat has spent 3 actions or declared "done" (design §5, resolving a
  contradiction with the PRD's "block of 3" wording in favor of the design doc).
- "Pass" means **done for the phase**; unspent actions are forfeited. The
  reactions-into-Phase-4 mechanic is deferred — a `heldActions` seam is left in state
  but unused.
