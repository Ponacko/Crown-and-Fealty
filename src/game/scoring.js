// ==========================================================================
// SCORING — all prestige math lives here so balance is auditable.
// ==========================================================================
import { CONFIG } from '../config.js';
import { CARDS } from './data.js';

export function provinceCount(G, seat) {
  return Object.values(G.provinces).filter((p) => p.owner === seat).length;
}

export function officesHeldBy(G, seat) {
  return Object.entries(G.offices)
    .filter(([, holder]) => holder === seat)
    .map(([office]) => office);
}

export function clampFavor(v) {
  return Math.max(CONFIG.favor.min, Math.min(CONFIG.favor.max, v));
}

export function adjustFavor(G, dukeSeat, delta, reason) {
  if (!(dukeSeat in G.favor)) return;
  if (delta > 0 && G.players[dukeSeat].rebelCooldownUntilYear >= G.year) {
    G.log.push(`Favor ${dukeSeat} remains at ${G.favor[dukeSeat]} during rebel cooldown.`);
    return;
  }
  const before = G.favor[dukeSeat];
  G.favor[dukeSeat] = clampFavor(before + delta);
  G.log.push(
    `Favor ${dukeSeat}: ${before} -> ${G.favor[dukeSeat]} (${reason})`
  );
}

// Yearly income + crown rent + office prestige, run at end of Harvest.
export function runHarvest(G) {
  const P = CONFIG.prestige;

  // 1) Everyone collects their own province tax as gold.
  for (const seat of Object.keys(G.players)) {
    const grossIncome = Object.values(G.provinces)
      .filter((p) => p.owner === seat)
      .reduce((s, p) => s + p.tax, 0);
    const taxPenalty = Math.min(grossIncome, G.players[seat].taxPenalty || 0);
    const income = grossIncome - taxPenalty;
    G.players[seat].gold += income;
    G.players[seat].taxPenalty = 0;
    if (taxPenalty > 0) {
      G.log.push(`Seat ${seat} loses ${taxPenalty} tax from a card effect.`);
    }
  }

  // 2) Dukes pay the crown per Tax Law (may be refused elsewhere; simplified).
  const law = CONFIG.taxLaw[G.taxLaw];
  for (const dukeSeat of Object.keys(G.favor)) {
    const provs = provinceCount(G, dukeSeat);
    let owed = law.perDuke;
    if (law.perProvinces) owed += Math.floor(provs / law.perProvinces);
    if (law.perProvince) owed += provs * law.perProvince;
    const paid = Math.min(owed, G.players[dukeSeat].gold);
    G.players[dukeSeat].gold -= paid;
    G.players[G.crownHolder].gold += paid;
    if (paid > 0) G.log.push(`Duke ${dukeSeat} pays ${paid}g tax to the crown.`);
  }

  // 3) Crown rent.
  G.players[G.crownHolder].prestige += P.crownRentPerYear;
  G.log.push(`Crown rent: seat ${G.crownHolder} +${P.crownRentPerYear} prestige.`);

  // 4) Office prestige.
  for (const [office, holder] of Object.entries(G.offices)) {
    if (holder != null) {
      G.players[holder].prestige += P.officePerYear;
      G.log.push(`Office ${office}: seat ${holder} +${P.officePerYear} prestige.`);
    }
  }

  // §9: The Papal Legate adds yearly prestige. The levy constraint is
  // enforced by commitTroops in moves.js.
  for (const seat of Object.keys(G.players)) {
    const hasLegate = G.players[seat].characters.some((cardId) =>
      CARDS.some((c) => c.id === cardId && c.effect === 'legate')
    );
    if (hasLegate) {
      G.players[seat].prestige += CONFIG.cards.legatePrestige;
      G.log.push(`Papal Legate: seat ${seat} +${CONFIG.cards.legatePrestige} prestige.`);
    }
  }

  // 5) "Just rule": king only, if no rebellion and no war loss this year.
  if (!G.rebellionThisYear && !G.warLostThisYear) {
    G.players[G.crownHolder].prestige += P.justRule;
    G.log.push(`Just rule: seat ${G.crownHolder} +${P.justRule} prestige.`);
  }

  // 6) Reset yearly flags, thaw rebel cooldowns.
  G.rebellionThisYear = false;
  G.warLostThisYear = false;
  for (const [seat, player] of Object.entries(G.players)) {
    if (player.rebelCooldownUntilYear && player.rebelCooldownUntilYear <= G.year) {
      player.rebelCooldownUntilYear = 0;
      G.log.push(`Seat ${seat}'s rebellion cooldown thaws.`);
    }
  }

  // Diplomatic Envoy lasts for the current year only (§9).
  for (const kingdom of G.foreignKingdoms) {
    kingdom.garrison = kingdom.baseGarrison ?? kingdom.garrison;
  }
}

// Final scoring at game end: land + heir.
export function finalScores(G) {
  const P = CONFIG.prestige;

  // Land.
  for (const seat of Object.keys(G.players)) {
    G.players[seat].prestige += provinceCount(G, seat) * P.perProvinceEnd;
  }

  // Heir: highest-favor duke (ties: lowest seat number, arbitrary — TODO).
  const dukeSeats = Object.keys(G.favor);
  if (dukeSeats.length) {
    let heir = dukeSeats[0];
    for (const s of dukeSeats) if (G.favor[s] > G.favor[heir]) heir = s;
    G.players[heir].prestige += P.heirBonus;
    G.log.push(`Heir: seat ${heir} (favor ${G.favor[heir]}) +${P.heirBonus} prestige.`);
  }

  const scores = {};
  for (const seat of Object.keys(G.players)) scores[seat] = G.players[seat].prestige;
  return scores;
}
