// ==========================================================================
// SETUP — builds the initial G state from CONFIG + data.
// TODO(auction): the doc makes the crown an auction (negative starting
// prestige). For the scaffold, seat "0" is simply the king and everyone
// starts at 0 prestige. Wire the auction as a pre-game phase later.
// ==========================================================================
import { CONFIG, KING_SEAT } from '../config.js';
import { PROVINCES, DUCHY_ORDER, FOREIGN_KINGDOMS, CARDS } from './data.js';

export function setup({ ctx, random }) {
  const n = ctx.numPlayers;
  const dukes = ctx.playOrder.filter((p) => p !== KING_SEAT);

  // Map duke seats -> duchy regions; leftover duchies become minor/neutral.
  const dukeOfRegion = {};
  dukes.forEach((seat, i) => {
    if (DUCHY_ORDER[i]) dukeOfRegion[DUCHY_ORDER[i]] = seat;
  });

  // Build the province table with ownership assigned.
  const provinces = {};
  for (const p of PROVINCES) {
    let owner = null;
    if (p.region === 'crown') owner = KING_SEAT;
    else if (dukeOfRegion[p.region]) owner = dukeOfRegion[p.region];
    else owner = null; // unclaimed duchy or minor -> neutral
    provinces[p.id] = { ...p, owner, building: null, faceUp: true };
  }

  // Players
  const players = {};
  for (const seat of ctx.playOrder) {
    const isKing = seat === KING_SEAT;
    const totalLevy = Object.values(provinces)
      .filter((pr) => pr.owner === seat)
      .reduce((s, pr) => s + pr.levy, 0);
    players[seat] = {
      isKing,
      gold: isKing ? CONFIG.startGold.king : CONFIG.startGold.duke,
      troops: Math.ceil(totalLevy / 2), // standing armies start small
      prestige: 0,
      hand: [],
      schemes: [],       // face-down cards {cardId}
      characters: [],    // persistent advisor cardIds
      claims: [],        // {cardId, provinceId}
      taxPenalty: 0,     // temporary next-Harvest tax loss from card effects
      actionsLeft: 0,
      committed: null,    // secret troop commitment for the current war
      rebelCooldownUntilYear: 0,
    };
  }

  // Favor: one track per duke, relationship with the current king.
  const favor = {};
  for (const seat of dukes) favor[seat] = 0;

  return {
    year: 1,
    crownHolder: KING_SEAT,
    provinces,
    players,
    favor,
    taxLaw: CONFIG.startingTaxLaw,
    levyLaw: CONFIG.startingLevyLaw,
    // Offices: marshal held by king by default; civilian offices unseated.
    offices: {
      marshal: KING_SEAT,
      steward: null,
      chancellor: null,
      spymaster: null,
    },
    foreignKingdoms: FOREIGN_KINGDOMS.map((fk) => ({
      ...fk,
      baseGarrison: fk.garrison,
      conquered: false,
    })),
    // Pending / active flags used across phases
    pendingWar: null,      // {kingdomId} declared in Council, resolved in Phase 4
    activeRebellion: null, // {leader, sides:{seat:'loyal'|'rebel'|'neutral'}}
    casusBelli: {},        // {dukeSeat: count}
    rebellionThisYear: false,
    warLostThisYear: false,
    deck: random.Shuffle(buildStarterDeck()),
    discard: [],
    // §9 Phase 2 (Inis-style pick-and-pass): populated by the Draft phase's
    // onBegin hook (game.js) each year; draftPacks is null outside a draft.
    draftPacks: null,
    draftRound: 0,
    draftPicksThisRound: {},
    log: [`Year 1 begins. Seat ${KING_SEAT} wears the crown.`],
  };
}

// Repeat the balanced card list four times to make a shared deck large enough
// for six annual drafts while retaining several copies of every card.
// Shuffled once via the `random` plugin (§3 guardrail: no Math.random()) by
// the caller above — this just builds the unshuffled list.
function buildStarterDeck() {
  const deck = [];
  for (let copy = 0; copy < 4; copy++) {
    for (const c of CARDS) deck.push({ uid: `${c.id}_${copy}`, cardId: c.id });
  }
  return deck;
}
