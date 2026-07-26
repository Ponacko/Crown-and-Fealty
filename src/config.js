// ==========================================================================
// CROWN & FEALTY — CENTRAL TUNING FILE
// --------------------------------------------------------------------------
// This is the ONLY place balance numbers should live. Every constant the
// design doc (§13) called out as "tune this first" is here. When a playtest
// feels off, change a number here and re-run — never hunt through the rules
// code. Keep this file boring and flat on purpose.
// ==========================================================================

export const CONFIG = {
  // ---- Game length & seats -----------------------------------------------
  years: 6,                 // fixed horizon (§2). Try 5 for a faster game.
  defaultPlayers: 4,        // 1 King (seat "0") + N-1 Dukes. Range 4–6.

  // ---- Starting resources ------------------------------------------------
  startGold: { king: 6, duke: 4 },
  // Starting troops = ceil(totalLevy / 2). See setup.js.

  // ---- Action economy ----------------------------------------------------
  actionsPerTurn: 3,        // actions each player takes in the Actions phase
  troopCost: 1,             // gold per cube when mustering
  buildCost: 3,             // gold to build a Market or Castle
  giftCost: 2,              // gold per gift
  giftFavorMaxPerYear: 1,   // cap on favor gained from gifts, per relationship

  // ---- The crown & land --------------------------------------------------
  domainLimit: 5,           // max provinces the king may personally hold (incl. Capital)
  dukeStartProvinces: 3,

  // ---- Favor track (§6) --------------------------------------------------
  favor: {
    min: -3,
    max: 3,
    onGift: 1,
    onGrantProvince: 2,
    onGrantOffice: 1,
    onExceedLevy: 1,
    onRefuseTax: -1,
    onUnderCommitLevy: -1,
    onRevoke: -2,
    onKingWarLoss: -1,      // applied to EVERY duke when the king loses a war
    onGrantClaimedToOther: -1,
    onStripOffice: -2,
    devotedThreshold: 3,    // +1 str per 3 cubes fighting for king at this favor
    furiousThreshold: -3,   // grants king a permanent casus belli
  },
  rebellionFavorFloor: -3,
  rebellionCooldownYears: 1, // crushed rebel sits at floor this many years before recovering

  // ---- Prestige sources (§2) — THE FIVE NUMBERS TO TUNE FIRST -------------
  prestige: {
    crownRentPerYear: 3,    // consider scaling: (numPlayers - 2)
    usurperBonus: 4,        // one-time, on taking the crown by rebellion
    heirBonus: 5,           // highest-favor duke at game end
    perProvinceEnd: 1,      // each province held at game end
    officePerYear: 1,       // each seated office, per year
    warWinKing: 2,
    warWinDutifulDuke: 1,
    justRule: 1,            // king only: no rebellion AND no war loss this year
    failedRebelLeader: -3,
    warLossKing: -2,
    courtCardMin: 1,
    courtCardMax: 2,
  },

  // ---- Laws (§5) ---------------------------------------------------------
  // Tax owed by each duke to the crown at Harvest.
  taxLaw: {
    low:    { perDuke: 1, perProvinces: 0, perProvince: 0 },
    medium: { perDuke: 0, perProvinces: 2, perProvince: 0 }, // 1 gold per 2 provinces
    high:   { perDuke: 0, perProvinces: 0, perProvince: 1 }, // 1 gold per province
  },
  // Levy fraction each duke owes when the king calls to arms.
  levyLaw: {
    low: 1 / 3,
    medium: 1 / 2,
    high: 1,
  },
  startingTaxLaw: 'medium',
  startingLevyLaw: 'medium',

  // ---- Draft (§9 Phase 2 — Inis-style pick-and-pass) ----------------------
  draftPackSize: 5,      // cards dealt to each seat's pack at Draft's start
  draftPicksPerYear: 4,  // pick-and-pass rounds; the (packSize - this) leftover is discarded

  // ---- Court cards (§9) --------------------------------------------------
  // Card effects are rules, but their balance numbers belong here with the
  // rest of the tuning surface.
  cards: {
    taxFarmersGold: 3,
    marketDayGold: 2,
    forcedLevyTroops: 3,
    mercenaryTroops: 2,
    forcedLevyTaxPenalty: 1,
    envoyGarrisonReduction: 2,
    tournamentFavor: 1,
    tournamentPrestige: 1,
    honoraryTitleFavor: 1,
    honoraryTitlePrestige: 1,
    characterSlots: 1,
    generalStrength: 1,
    legatePrestige: 1,
    claimFavorPenalty: -1,
    ambushStrength: 3,
    poisonGarrison: 3,
    bribedCaptainsCubes: 2,
    forgedLettersFavor: -2,
  },

  // ---- War (§7) ----------------------------------------------------------
  casualties: {
    winPerN: 4,   // lose 1 cube per N committed on the winning side
    losePerN: 2,  // lose 1 cube per N committed on the losing side (double)
  },
  warReparationsGold: 3,     // king pays on a loss
  warModifierDeck: [-1, 0, 0, 1, 2], // tiny near-deterministic swing deck (§7.4)

  // ---- Offices (§8) ------------------------------------------------------
  // Marshal is the king's by default; only civilian offices are grantable,
  // and at most `grantableSeats` may be seated at once (scarcity at 3 dukes).
  offices: ['marshal', 'steward', 'chancellor', 'spymaster'],
  kingDefaultOffice: 'marshal',
  grantableOffices: ['steward', 'chancellor', 'spymaster'],
  grantableSeats: 2,
  marshalBattleBonus: 2,
  chancellorVoteWeight: 2,
};

// Convenience: king is always seat "0" in this scaffold.
// (Auctioning the crown is a setup TODO — see setup.js.)
export const KING_SEAT = '0';
