// ==========================================================================
// STATIC GAME DATA — map + cards.
// Edit provinces here to reshape the realm; add cards to grow the deck.
// Everything here is data, not logic.
// ==========================================================================

// ---- Provinces ------------------------------------------------------------
// region: 'crown' | 'duchyA'..'duchyE' | 'minor'
// tax / levy: 1–3. capital: only one, always travels with the crown.
// Design target (§13): eight 1s, eight 2s, four 3s per stat; no starting
// duchy over 6 tax or 6 levy. These numbers are a first pass — retune freely.

export const PROVINCES = [
  // Crownlands (5, includes Capital)
  { id: 'cap',  name: 'Kingsreach (Capital)', region: 'crown', tax: 3, levy: 2, capital: true },
  { id: 'cr1',  name: 'Highmoor',   region: 'crown', tax: 2, levy: 1 },
  { id: 'cr2',  name: 'Elderford',  region: 'crown', tax: 1, levy: 2 },
  { id: 'cr3',  name: 'Stonewatch', region: 'crown', tax: 1, levy: 1 },
  { id: 'cr4',  name: 'Greenvale',  region: 'crown', tax: 2, levy: 1 },

  // Duchy A
  { id: 'a1', name: 'Westmarch',  region: 'duchyA', tax: 2, levy: 2 },
  { id: 'a2', name: 'Thornhold',  region: 'duchyA', tax: 1, levy: 3 },
  { id: 'a3', name: 'Ashcombe',   region: 'duchyA', tax: 2, levy: 1 },

  // Duchy B
  { id: 'b1', name: 'Ravensburg', region: 'duchyB', tax: 3, levy: 1 },
  { id: 'b2', name: 'Mirefield',  region: 'duchyB', tax: 1, levy: 2 },
  { id: 'b3', name: 'Oakhurst',   region: 'duchyB', tax: 2, levy: 2 },

  // Duchy C
  { id: 'c1', name: 'Saltcliff',  region: 'duchyC', tax: 2, levy: 1 },
  { id: 'c2', name: 'Duncastle',  region: 'duchyC', tax: 1, levy: 3 },
  { id: 'c3', name: 'Brightwater',region: 'duchyC', tax: 3, levy: 2 },

  // Duchy D
  { id: 'd1', name: 'Ironpeak',   region: 'duchyD', tax: 1, levy: 2 },
  { id: 'd2', name: 'Wolfden',    region: 'duchyD', tax: 2, levy: 2 },
  { id: 'd3', name: 'Fenmoor',    region: 'duchyD', tax: 2, levy: 1 },

  // Minor-lord provinces (neutral; grantable via Grant Charter)
  { id: 'm1', name: 'Coldharbor', region: 'minor', tax: 1, levy: 1 },
  { id: 'm2', name: 'Rookspire',  region: 'minor', tax: 1, levy: 1 },
  { id: 'm3', name: 'Deepford',   region: 'minor', tax: 2, levy: 1 },
];

// Which duchy each duke seat receives, in order. Seat "0" is the king.
// Extra duchies (beyond the number of dukes) fall back to 'minor' at setup.
export const DUCHY_ORDER = ['duchyA', 'duchyB', 'duchyC', 'duchyD'];

// ---- Foreign kingdoms (external-war targets, §7) --------------------------
export const FOREIGN_KINGDOMS = [
  { id: 'fk_weak',   name: 'The Vends',       garrison: 8,  provinces: [
      { id: 'v1', tax: 1, levy: 2 }, { id: 'v2', tax: 2, levy: 1 },
      { id: 'v3', tax: 1, levy: 1 }, { id: 'v4', tax: 2, levy: 2 } ] },
  { id: 'fk_mid',    name: 'Karthia',         garrison: 12, provinces: [
      { id: 'k1', tax: 2, levy: 2 }, { id: 'k2', tax: 2, levy: 1 },
      { id: 'k3', tax: 1, levy: 3 }, { id: 'k4', tax: 3, levy: 1 } ] },
  { id: 'fk_rich',   name: 'The Sun Caliphate', garrison: 16, provinces: [
      { id: 's1', tax: 3, levy: 2 }, { id: 's2', tax: 3, levy: 1 },
      { id: 's3', tax: 2, levy: 3 }, { id: 's4', tax: 3, levy: 2 },
      { id: 's5', tax: 2, levy: 2 } ] },
];

// ---- Starter card deck ----------------------------------------------------
// A small representative set across the five types (§9). Grow this list to
// build the real ~110-card deck. `effect` is a string key that moves.js
// switches on — most are stubbed with TODOs for you to vibecode.
//   type: 'action' | 'scheme' | 'character' | 'claim' | 'decree'
//   crownOnly: playable only while holding the crown
export const CARDS = [
  { id: 'act_taxfarmers', type: 'action', name: 'Tax Farmers', effect: 'gold3',
    text: '+3 gold.' },
  { id: 'act_forcedlevy', type: 'action', name: 'Forced Levy', effect: 'forcedLevy',
    text: 'Muster 3 troops free; lose 1 tax next Harvest.' },
  { id: 'act_envoy', type: 'action', name: 'Diplomatic Envoy', effect: 'envoy',
    text: 'Reduce a foreign kingdom garrison by 2 this year.' },
  { id: 'act_tourney', type: 'action', name: 'Royal Tournament', crownOnly: true, effect: 'tournament',
    text: 'CROWN: +1 favor with two dukes, +1 prestige. (Duke: local Feast, +1 favor with king.)' },
  { id: 'act_charter', type: 'action', name: 'Grant Charter', crownOnly: true, effect: 'charter',
    text: 'CROWN: grant one neutral minor-lord province.' },

  { id: 'sch_ambush', type: 'scheme', name: 'Ambush', effect: 'ambush',
    text: 'Reveal in a battle: +3 to your side.' },
  { id: 'sch_bribe', type: 'scheme', name: 'Bribed Captains', effect: 'bribe',
    text: 'When an opponent reveals their dial, 2 of their cubes desert.' },
  { id: 'sch_poison', type: 'scheme', name: 'Poison the Wells', effect: 'poison',
    text: "Reveal in an external war: garrison +3 (make the king lose)." },

  { id: 'chr_general', type: 'character', name: 'The Old General', effect: 'general',
    text: '+1 strength always.' },
  { id: 'chr_legate', type: 'character', name: 'The Papal Legate', effect: 'legate',
    text: '+1 prestige/year, but you may never under-commit levies.' },

  { id: 'clm_generic', type: 'claim', name: 'Ancestral Claim', effect: 'claim',
    text: 'Place on a province you do not hold (see §9).' },

  { id: 'dec_magna', type: 'decree', name: 'Magna Carta', crownOnly: true, effect: 'magnaCarta',
    text: 'Council vote: Tax Law may never be High again.' },
  { id: 'dec_army', type: 'decree', name: 'Royal Standing Army', crownOnly: true, effect: 'standingArmy',
    text: "Council vote: king's Domain Limit +1." },
];
