# Deterministic battle-resolution rulings

The design doc leaves several battle questions silent or ambiguous. These rulings
fill the gaps so external war and rebellion resolve without a coin flip.

## Rulings

- **Ties go to the defender**, in both external war and rebellion. A rebel must
  *exceed* the King's total (not merely match it); an external attacker must beat
  the garrison outright. This is consistent with what the external-war code already
  did (`attack > defense`), keeps civil wars fully deterministic (design's
  no-randomness requirement), and leans defense-favoring per the anti-snowball intent.

- **Castles add +1 to their owner's coalition**, not only to the defender. Loyalist
  castles help the King, Rebel castles help the rebels, Neutral-owned castles count
  for nobody. Chosen over the literal "defender-side only" wording because it keeps
  building worthwhile for everyone and makes a fortified rebel viable.

- **"Meeting levy duty" is satisfied by giving all you have.** Duty =
  `floor(levyLaw × province levy value)`. A Duke is branded disloyal (−1 Favor +
  Casus Belli) only if he *held cubes back* and still fell short — committing every
  cube he owns always counts as dutiful, even if the number is below duty. This
  preserves sandbagging detection without punishing a Duke bled dry by earlier wars.

## Why record it

A future reader will look for these rules in the design doc and not find them; each
is a real trade-off (defense-favoring vs. attacker-favoring, literal vs. intuitive
castles, punishing vs. humane duty) that the war/rebellion code is built around, so
reversing one ripples through resolution and scoring.
