# Council votes are uniformly king-favorable

Every Council vote uses one rule: each player (King included) casts one vote, the
Chancellor's counts double, and a tie is broken in the King's favor. This applies
uniformly — tax law, levy law, decrees, *and* a Revocation without a Casus Belli.

## Why this is surprising

The design doc (§11) wanted Revocation-without-a-CB to be *hard* — "dukes rarely
vote to let kings take land, that's the point" — implying the King should not
dominate that particular vote. We deliberately chose the simpler uniform rule
instead: one voting mechanic everywhere, no special cases. The trade-off accepted is
that the Casus Belli becomes a *convenience* (skip the vote) rather than a hard gate
on taking land, since a King with the Chancellor or an even split can often pass a
revocation by vote anyway.

## Consequences

- With 3 dukes, King + Chancellor (double vote) beats the other two — the King wins
  most contested votes. This is a known, deliberate balance lean toward the crown; flag
  it if playtests show the dukes can never block anything.
- Harvest is no longer purely automatic: each Duke makes a Pay-or-Refuse choice.
  Refuse = keep gold, −1 Favor, King gains a Casus Belli. A Duke who is merely too
  poor pays what he can with no penalty (poverty is not treason).
