# One binding-cash primitive; promises are never enforced

Council bribery, the King's war-reparations borrowing, and binding rebellion offers
are all implemented by a single move: `transferGold(toSeat, amount)` — move gold
between players *now*, with no Favor effect. There is no loan ledger and no
promise-tracking of any kind.

## Why

The design borrows Junta's rule that *only cash paid right now is binding*; every
promise to repay or reciprocate is table-trust, deliberately unenforced. Modeling a
formal loan (lender, terms, auto-repayment) would enforce exactly what the design
says must stay unenforceable, and would add a subsystem for no gameplay gain. Three
fuzzy negotiation mechanics collapse into one primitive; `sendGift` stays separate
because it is the Favor-granting act, not a bare transfer.

## Consequences

- A King who cannot cover war reparations simply goes into **negative gold** (a
  visible debt), paid down by later Harvest income. Dukes may cover it with a
  `transferGold`, but the app never records or enforces repayment terms.
- Because transfers carry no Favor, all vote-buying and coup-bribery is pure gold —
  keeping the Favor economy clean, as the design intends ("keep vote-buying to gold
  rather than Favor").
