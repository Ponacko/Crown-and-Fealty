// ==========================================================================
// SETUP — builds the initial G state from CONFIG + data. §4: the Crown is
// auctioned in a pre-game phase (see the `auction` phase in game.js and
// `auctionMoves` in moves.js) before Year 1 begins, so `setup()` itself
// leaves the Crown, Crownlands, duchies, and every seat's starting gold/
// troops/prestige unassigned (nobody is King yet). `crownKing()` below is
// the seam that assigns all of that, called once the auction resolves.
// ==========================================================================
import { CONFIG } from '../config.js';
import { PROVINCES, DUCHY_ORDER, FOREIGN_KINGDOMS, CARDS } from './data.js';

export function setup({ ctx, random }) {
  const provinces = {};
  for (const p of PROVINCES) {
    provinces[p.id] = { ...p, owner: null, building: null, faceUp: true };
  }

  const players = {};
  for (const seat of ctx.playOrder) {
    players[seat] = {
      isKing: false,
      gold: 0,
      troops: 0,
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

  const G = {
    year: 1,
    crownHolder: null,
    provinces,
    players,
    favor: {},
    taxLaw: CONFIG.startingTaxLaw,
    levyLaw: CONFIG.startingLevyLaw,
    // Offices: marshal held by king by default; civilian offices unseated.
    offices: {
      marshal: null,
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
    pendingConquest: null, // {kingdomId, provinceIds} awaiting grant or sack
    pendingOccupation: null, // {kingdomId, provinceIds} awaiting defeat choice
    pendingVote: null,      // {proposal, votes} awaiting Council votes
    pendingRevocation: null, // {target} awaiting the target's Submit/Defy (§11)
    councilProposals: 0,    // proposals used this Council phase (max 2)
    enactedDecrees: [],     // decree ids approved by Council; effects derive from this list
    // §10: side declarations are ordered, then each duke gets one
    // renegotiation before the sides lock for battle.
    activeRebellion: null, // {leader, sides, sideOrder, sideIndex, step, renegotiated, negotiationIndex}
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
    // §4: open-ascending auction for the Crown, resolved by the `auction`
    // phase (game.js) via auctionMoves.bid/passAuction (moves.js). highBid
    // starts below any legal bid (0 is a valid opening bid) so the phase can
    // tell "nobody has bid yet" apart from "the crown goes for free".
    auction: { highBid: -1, highBidder: null, passed: {}, resolved: false },
    log: ['The Crown is put up for auction.'],
  };

  return G;
}

// §4: assigns the Crown, Crownlands, duchies, and starting gold/troops/
// prestige to `kingSeat`, who won the auction at a starting Prestige debt of
// `bid`. Called from moves.js's resolveAuction() once the `auction` phase
// (game.js) concludes. Move-level unit tests that call `setup()` directly
// and skip the auction phase call this themselves for a default seat-0-King
// state (see scripts/*.mjs's makeGame() helpers).
export function crownKing(G, ctx, kingSeat, bid) {
  const dukes = ctx.playOrder.filter((seat) => seat !== kingSeat);

  // Map duke seats -> duchy regions; leftover duchies become minor/neutral.
  const dukeOfRegion = {};
  dukes.forEach((seat, i) => {
    if (DUCHY_ORDER[i]) dukeOfRegion[DUCHY_ORDER[i]] = seat;
  });

  for (const province of Object.values(G.provinces)) {
    if (province.region === 'crown') province.owner = kingSeat;
    else if (dukeOfRegion[province.region]) province.owner = dukeOfRegion[province.region];
    else province.owner = null; // unclaimed duchy or minor -> neutral
  }

  for (const seat of ctx.playOrder) {
    const isKing = seat === kingSeat;
    const totalLevy = Object.values(G.provinces)
      .filter((pr) => pr.owner === seat)
      .reduce((s, pr) => s + pr.levy, 0);
    const player = G.players[seat];
    player.isKing = isKing;
    player.gold = isKing ? CONFIG.startGold.king : CONFIG.startGold.duke;
    player.troops = Math.ceil(totalLevy / 2); // standing armies start small
    player.prestige = isKing ? -bid : 0;
  }

  // Favor: one track per duke, relationship with the current king.
  G.favor = {};
  for (const seat of dukes) G.favor[seat] = 0;

  G.crownHolder = kingSeat;
  G.offices.marshal = kingSeat;
  G.log.push(bid > 0
    ? `Seat ${kingSeat} wins the auction and wears the Crown at -${bid} prestige.`
    : `Seat ${kingSeat} wears the Crown.`);
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
