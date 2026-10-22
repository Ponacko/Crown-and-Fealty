// ==========================================================================
// BOARD — a modestly styled debug harness. It exposes state and fires moves
// while you tune the game, with enough hierarchy for a real playtest.
// ==========================================================================
import React from 'react';
import { CONFIG } from '../config.js';
import { CARDS } from '../game/data.js';

const page = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: 12,
  background: '#f4f1e8',
  color: '#25231f',
  fontFamily: 'system-ui, sans-serif',
};
const box = {
  border: '1px solid #b7ad9b',
  borderRadius: 6,
  padding: 12,
  background: '#fffdf8',
  boxShadow: '0 1px 2px rgba(40, 30, 15, 0.08)',
};
const btn = {
  margin: 2,
  padding: '5px 8px',
  border: '1px solid #8e8069',
  borderRadius: 4,
  background: '#f7f0df',
  color: '#25231f',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const sectionTitle = { margin: '0 0 8px', fontSize: 16 };
const muted = { color: '#655f55', fontSize: 12 };
const badge = {
  padding: '4px 7px',
  borderRadius: 4,
  background: '#eee7d8',
  fontSize: 12,
};
const ownershipColors = [
  { background: '#f4d58d', border: '#9a6b1f', text: '#4a3210' }, // Crown / seat 0
  { background: '#c8dff2', border: '#3874a6', text: '#173b5b' },
  { background: '#c9e8d0', border: '#3f8651', text: '#1d4d2a' },
  { background: '#e7cae2', border: '#8a4d7e', text: '#53274c' },
  { background: '#f2c8bf', border: '#a94e3f', text: '#61291f' },
  { background: '#d8d0f0', border: '#6955a0', text: '#39305f' },
];
const neutralProvinceColor = { background: '#ece7dd', border: '#aaa094', text: '#514b43' };
const occupiedProvinceColor = { background: '#ded8ce', border: '#766e64', text: '#4b463f' };
const phaseDetails = {
  auction: ['Crown auction', 'Bid for the Crown or pass. The high bidder becomes King.'],
  council: ['Council', 'The King proposes; seats vote, bargain, and prepare the year.'],
  draft: ['Court draft', 'Pick one card from your pack. The remaining pack passes left.'],
  actions: ['Actions', 'Take up to three actions, then pass to the next seat.'],
  warAndRebellion: ['War & rebellion', 'Commit troops, choose sides, resolve battles, then close the phase.'],
  harvest: ['Harvest', 'Collect income, prestige, and taxes before the next year begins.'],
};
const cardInfo = (cardId) => CARDS.find((c) => c.id === cardId) || null;
// Name + rules text together, so a card's effect is visible wherever it's
// listed — hand, draft pack, decree proposals — not just once it's playable.
const cardLabel = (cardId) => {
  const c = cardInfo(cardId);
  return c ? `${c.name} — ${c.text}` : cardId;
};

// §5: a seat is active either as the sole ctx.currentPlayer (Council,
// Harvest, and each sequential Actions turn), or, when a phase sets
// activePlayers (Draft, War & Rebellion), by appearing in ctx.activePlayers.
function isActiveSeat(ctx, seat) {
  if (ctx.activePlayers) return seat in ctx.activePlayers;
  return ctx.currentPlayer === seat;
}

function activeSeats(ctx) {
  return ctx.activePlayers ? Object.keys(ctx.activePlayers) : [ctx.currentPlayer];
}

function seatLabel(seat, crownHolder) {
  return `seat ${seat}${seat === crownHolder ? ' 👑' : ''}`;
}

function phaseLabel(phase) {
  return phaseDetails[phase]?.[0] || phase;
}

function waitingText(ctx, me, crownHolder) {
  const seats = activeSeats(ctx).filter((seat) => seat != null);
  if (seats.includes(me)) {
    return ctx.activePlayers ? 'Your move is available.' : `It is ${seatLabel(me, crownHolder)}'s turn.`;
  }
  return `Waiting for ${seats.map((seat) => seatLabel(seat, crownHolder)).join(', ')}.`;
}

function scoreLabel(player) {
  return `${player.prestige} prestige`;
}

function provinceColor(province) {
  if (!province.faceUp) return occupiedProvinceColor;
  if (province.owner == null) return neutralProvinceColor;
  const seat = Number(province.owner);
  return ownershipColors[Number.isInteger(seat) && seat >= 0
    ? seat % ownershipColors.length
    : 0];
}

function Panel({ title, children, style }) {
  return (
    <section style={{ ...box, ...style }}>
      {title && <h2 style={sectionTitle}>{title}</h2>}
      {children}
    </section>
  );
}

export function Board({ G, ctx, moves, playerID }) {
  // No seat picked in the debug panel: fall back to whoever's turn it is
  // (during the pre-game auction, G.crownHolder isn't decided yet).
  const me = playerID ?? ctx.currentPlayer;
  const isKing = me === G.crownHolder;
  const phase = ctx.phase;
  const active = isActiveSeat(ctx, me);
  const [phaseName, phaseDescription] = phaseDetails[phase] || [phase, ''];
  const current = G.players[me];

  if (ctx.gameover) {
    const standings = Object.entries(ctx.gameover.scores)
      .sort(([, a], [, b]) => b - a);
    return (
      <main style={page}>
        <Panel title="Game over" style={{ maxWidth: 760, margin: '24px auto' }}>
          <h1 style={{ margin: '0 0 4px' }}>Seat {ctx.gameover.winner} wins</h1>
          <div style={muted}>Final prestige standings</div>
          <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
            {standings.map(([seat, score], index) => (
              <div key={seat} style={{
                display: 'flex', justifyContent: 'space-between', padding: '8px 10px',
                background: index === 0 ? '#f0dfad' : '#f7f4ec', borderRadius: 4,
              }}>
                <b>{index + 1}. {seatLabel(seat, G.crownHolder)}</b>
                <b>{score} prestige</b>
              </div>
            ))}
          </div>
        </Panel>
      </main>
    );
  }

  return (
    <main style={page}>
      <header style={{ ...box, border: '2px solid #6d5935', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: 1 }}>
              Year {G.year} of {CONFIG.years}
            </div>
            <h1 style={{ margin: '2px 0 4px', fontSize: 28 }}>{phaseName}</h1>
            <div>{phaseDescription}</div>
          </div>
          <div style={{
            minWidth: 220, padding: 10, borderRadius: 5,
            background: active ? '#e5f2df' : '#f4e6d0',
            border: `1px solid ${active ? '#91ad83' : '#c9a978'}`,
          }}>
            <b>{active ? `Your turn — ${seatLabel(me, G.crownHolder)}` : 'Waiting'}</b>
            <div style={{ marginTop: 4 }}>{waitingText(ctx, me, G.crownHolder)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={badge}>Acting as {seatLabel(me, G.crownHolder)}</span>
          <span style={badge}>Active: {activeSeats(ctx).map((seat) => seatLabel(seat, G.crownHolder)).join(', ')}</span>
          <span style={badge}>Crown: {G.crownHolder == null ? 'auction underway' : seatLabel(G.crownHolder, G.crownHolder)}</span>
          <span style={badge}>Tax {G.taxLaw} · Levy {G.levyLaw}</span>
        </div>
        {G.activeRebellion && (
          <div style={{ marginTop: 10, color: '#7a2d20' }}>
            Rebellion: {seatLabel(G.activeRebellion.leader, G.crownHolder)} — {G.activeRebellion.step}
          </div>
        )}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Panel title="Scoreboard" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
            {Object.entries(G.players).map(([seat, player]) => {
              const isMe = seat === me;
              const handVisible = isMe || player.gold !== null;
              return (
                <div key={seat} style={{
                  padding: 10,
                  borderRadius: 5,
                  border: isMe ? '2px solid #6d5935' : '1px solid #d3c8b5',
                  background: isMe ? '#fff7df' : '#faf8f2',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>{seatLabel(seat, G.crownHolder)}</b>
                    {isMe && <span style={muted}>you</span>}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{scoreLabel(player)}</div>
                  <div style={{ marginTop: 5 }}>
                    Favor: <b>{seat in G.favor ? G.favor[seat] : '—'}</b>
                    {' · '}Troops: <b>{player.troops}</b>
                  </div>
                  <div style={muted}>
                    Gold: {player.gold === null ? 'hidden' : player.gold}
                    {' · '}Hand: {handVisible ? `${player.hand.length} card${player.hand.length === 1 ? '' : 's'}` : 'hidden'}
                  </div>
                  {isMe && phase === 'actions' && <div style={muted}>Actions left: {player.actionsLeft}</div>}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Your seat" style={{ minHeight: 100 }}>
          {current ? (
            <>
              <div><b>{seatLabel(me, G.crownHolder)}</b>{isKing ? ' — King' : ' — Duke'}</div>
              <div style={{ marginTop: 6 }}>
                {scoreLabel(current)} · {current.gold === null ? 'hidden gold' : `${current.gold} gold`} · {current.troops} troops
              </div>
              <div style={{ ...muted, marginTop: 6 }}>
                Favor: {me in G.favor ? G.favor[me] : 'not applicable'}
                {phase === 'actions' && ` · ${current.actionsLeft} actions left`}
              </div>
            </>
          ) : <div style={muted}>No seat selected.</div>}
        </Panel>

        <Panel title="Available actions" style={{ minHeight: 100 }}>
          {active
            ? <PhaseControls phase={phase} moves={moves} G={G} me={me} isKing={isKing} />
            : <div style={{ color: '#7a2d20' }}>{waitingText(ctx, me, G.crownHolder)}</div>}
        </Panel>

        <Panel title="Provinces" style={{ maxHeight: 360, overflow: 'auto' }}>
          <div style={{ ...muted, display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: neutralProvinceColor.background, border: `1px solid ${neutralProvinceColor.border}` }} />
              Neutral
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: occupiedProvinceColor.background, border: `1px solid ${occupiedProvinceColor.border}` }} />
              Occupied
            </span>
            {Object.keys(G.players).map((seat) => {
              const color = ownershipColors[Number(seat) % ownershipColors.length];
              return (
                <span key={seat} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: color.background, border: `1px solid ${color.border}` }} />
                  {seatLabel(seat, G.crownHolder)}
                </span>
              );
            })}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {Object.values(G.provinces).map((province) => {
              const color = provinceColor(province);
              return (
                <div key={province.id} style={{
                  padding: '7px 8px', borderRadius: 4,
                  background: color.background, border: `1px solid ${color.border}`,
                  color: color.text,
                }}>
                  <b>{province.name}</b>{province.capital ? ' ★' : ''}
                  <div style={{ ...muted, color: color.text }}>
                    {province.owner == null ? 'neutral' : seatLabel(province.owner, G.crownHolder)} · tax {province.tax} · levy {province.levy}
                    {province.building ? ` · ${province.building}` : ''}
                    {!province.faceUp && ' · occupied face-down'}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Recent log" style={{ maxHeight: 360, overflow: 'auto' }}>
          <ol reversed style={{ margin: 0, paddingLeft: 24 }}>
            {G.log.slice(-30).reverse().map((entry, index) => (
              <li key={`${entry}-${index}`} style={{ padding: '3px 0' }}>{entry}</li>
            ))}
          </ol>
        </Panel>
      </div>
    </main>
  );
}

function CardControls({ held, moves, G, me, isKing }) {
  const definition = CARDS.find((card) => card.id === held.cardId);
  if (!definition) return null;
  const mine = G.players[me];

  let controls;
  if ((definition.crownOnly && !isKing) || definition.type === 'decree') {
    // These cards remain visible in the hand summary, but are not available
    // actions during the Actions phase.
    return null;
  } else if (definition.type === 'character' &&
    mine.characters.length >= CONFIG.cards.characterSlots) {
    return null;
  } else if (definition.effect === 'envoy') {
    const targets = G.foreignKingdoms.filter((kingdom) => !kingdom.conquered);
    if (targets.length === 0) return null;
    controls = targets.map((kingdom) => (
      <button key={`${held.uid}-${kingdom.id}`} style={btn}
        onClick={() => moves.playCard(held.uid, kingdom.id)}>
        Envoy → {kingdom.name}
      </button>
    ));
  } else if (definition.effect === 'tournament' && isKing) {
    const dukes = Object.keys(G.favor);
    const choices = [];
    for (let i = 0; i < dukes.length; i += 1) {
      for (let j = i + 1; j < dukes.length; j += 1) {
        choices.push(
          <button key={`${held.uid}-${dukes[i]}-${dukes[j]}`} style={btn}
            onClick={() => moves.playCard(held.uid, [dukes[i], dukes[j]])}>
            Tournament → {dukes[i]} &amp; {dukes[j]}
          </button>
        );
      }
    }
    if (choices.length === 0) return null;
    controls = choices;
  } else if (definition.effect === 'charter' && isKing) {
    const targets = Object.values(G.provinces)
      .filter((province) => province.owner == null && province.region === 'minor')
      .flatMap((province) => Object.keys(G.favor).map((duke) => (
        <button key={`${held.uid}-${province.id}-${duke}`} style={btn}
          onClick={() => moves.playCard(held.uid, province.id, duke)}>
          Charter {province.id} → {duke}
        </button>
      )));
    if (targets.length === 0) return null;
    controls = targets;
  } else if (definition.effect === 'claim') {
    const targets = Object.values(G.provinces).filter((province) => province.owner !== me);
    if (targets.length === 0) return null;
    controls = targets.map((province) => (
      <button key={`${held.uid}-${province.id}`} style={btn}
        onClick={() => moves.playCard(held.uid, province.id)}>
        Claim {province.id}
      </button>
    ));
  } else if ((definition.effect === 'favor1' || definition.effect === 'title') && isKing) {
    controls = Object.keys(G.favor).map((duke) => (
      <button key={`${held.uid}-${duke}`} style={btn}
        onClick={() => moves.playCard(held.uid, duke)}>
        {definition.name} → {duke}
      </button>
    ));
  } else {
    controls = (
      <button style={btn} onClick={() => moves.playCard(held.uid)}>
        Play {definition.name}
      </button>
    );
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 11, color: '#555' }}>
        <b>{definition.name}</b> — {definition.text}
      </div>
      {controls}
    </div>
  );
}

function PhaseControls({ phase, moves, G, me, isKing }) {
  const [n, setN] = React.useState(1);
  const mine = G.players[me];
  const num = (
    <input type="number" value={n} min={0} style={{ width: 50 }}
      onChange={(e) => setN(parseInt(e.target.value || '0', 10))} />
  );

  switch (phase) {
    case 'auction': {
      const passedSeats = Object.keys(G.auction.passed).filter((s) => G.auction.passed[s]);
      return (
        <div>
          <div>High bid: <b>
            {G.auction.highBidder == null
              ? 'none yet'
              : `-${G.auction.highBid} prestige (seat ${G.auction.highBidder})`}
          </b></div>
          <div>Passed: {passedSeats.length ? passedSeats.join(', ') : '—'}</div>
          <div>{num}
            <button style={btn} onClick={() => moves.bid(n)}>Bid -{n} prestige</button>
            <button style={btn} onClick={() => moves.passAuction()}>PASS</button>
          </div>
        </div>
      );
    }

    case 'council': {
      const proposalsRemaining = CONFIG.councilProposalsPerYear - (G.councilProposals || 0);
      const canPropose = isKing && !G.pendingVote && !G.pendingRevocation &&
        !G.pendingWar && !G.activeRebellion && proposalsRemaining > 0;
      const availableLaws = [
        ['taxLaw', G.taxLaw],
        ['levyLaw', G.levyLaw],
      ];
      const availableWars = G.foreignKingdoms.filter((kingdom) => !kingdom.conquered);
      const availableOffices = CONFIG.grantableOffices.filter((office) => {
        const seated = CONFIG.grantableOffices.filter((item) => G.offices[item] != null).length;
        return G.offices[office] != null || seated < CONFIG.grantableSeats;
      });
      const hasVoted = G.pendingVote && Object.prototype.hasOwnProperty.call(G.pendingVote.votes, me);
      const voteChoice = hasVoted ? (G.pendingVote.votes[me] ? 'YES' : 'NO') : null;
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={muted}>Proposal slots remaining: {Math.max(0, proposalsRemaining)}</div>
          {canPropose && <>
            {availableLaws.map(([which, currentLaw]) => (
              <div key={which}>
                <b>{which === 'taxLaw' ? 'Tax law' : 'Levy law'}</b>{' '}
                <span style={muted}>(current: {currentLaw})</span>
                {['low', 'medium', 'high'].filter((value) => value !== currentLaw).map((value) => (
                  <button key={value} style={btn} onClick={() => moves.proposeLaw(which, value)}>
                    Propose {value}
                  </button>
                ))}
              </div>
            ))}
          </>}
          {G.pendingVote && <div style={{ padding: 8, background: '#f5edda', borderRadius: 4 }}>
            <b>Vote: {G.pendingVote.proposal.which || G.pendingVote.proposal.cardId ||
              `Revoke a province from seat ${G.pendingVote.proposal.dukeSeat}`}</b>
            {hasVoted
              ? <div style={{ marginTop: 4 }}>You voted <b>{voteChoice}</b>; waiting for the other seats.</div>
              : <div style={{ marginTop: 4 }}>
                <button style={btn} onClick={() => moves.vote(true)}>YES</button>
                <button style={btn} onClick={() => moves.vote(false)}>NO</button>
              </div>}
            {mine.gold > 0 && <div style={{ marginTop: 6 }}>
              <span>Bribe another seat: </span>
              {Object.keys(G.players).filter((seat) => seat !== me).map((seat) => (
                <button key={seat} style={btn} disabled={n <= 0 || n > mine.gold}
                  onClick={() => moves.transferGold(seat, n)}>
                  Pay {n}g → {seat}
                </button>))}
            </div>}
          </div>}
          {canPropose && <div>
            <b>Decrees</b>{' '}
            {Object.entries(G.players).flatMap(([seat, player]) =>
              player.hand
                .filter((held) => CARDS.find((card) => card.id === held.cardId)?.type === 'decree')
                .map((held) => (
                  <button key={held.uid} style={btn} onClick={() => moves.proposeDecree(held.uid)}>
                    Propose {cardLabel(held.cardId)} (seat {seat})
                  </button>
                )))}
          </div>}
          {G.pendingRevocation && G.pendingRevocation.target === me && <div style={{ padding: 8, background: '#f5e1dc', borderRadius: 4 }}>
            <b>Respond to Revocation</b>
            <div>
              {Object.values(G.provinces).filter((province) => province.owner === me).map((province) => (
                <button key={province.id} style={btn}
                  onClick={() => moves.respondRevocation('submit', province.id)}>
                  Submit → cede {province.name}
                </button>))}
              <button style={btn} onClick={() => moves.respondRevocation('defy')}>
                Defy ⚔
              </button>
            </div>
          </div>}
          {canPropose && <div>
            <b>King’s actions</b>
            {availableWars.map((kingdom) => (
              <button key={kingdom.id} style={btn} onClick={() => moves.declareWar(kingdom.id)}>
                Declare war: {kingdom.name} (garrison {kingdom.garrison})
              </button>
            ))}
            {Object.keys(G.favor).map((duke) => (
              <button key={`revoke-${duke}`} style={btn} onClick={() => moves.proposeRevocation(duke)}>
                Revocation → seat {duke}
              </button>
            ))}
            {availableOffices.flatMap((office) => Object.keys(G.favor).map((duke) => (
              <button key={`${office}-${duke}`} style={btn} onClick={() => moves.grantOffice(office, duke)}>
                {office} → seat {duke}
              </button>
            )))}
          </div>}
          {isKing && !G.pendingVote && !G.pendingRevocation &&
            <button style={btn} onClick={() => moves.endCouncil()}>End Council ▶</button>}
          {!isKing && !G.pendingVote && !G.pendingRevocation &&
            <div style={muted}>Waiting for the King to make a Council proposal.</div>}
        </div>
      );
    }

    case 'draft': {
      // §9 Phase 2: pick one card from your current pack; once everyone's
      // picked, packs auto-pass left and the phase auto-ends after the
      // final round (see moves.js dealDraftPacks/pickCard).
      const pack = G.draftPacks ? G.draftPacks[me] : null;
      const alreadyPicked = G.draftPicksThisRound?.[me];
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <div><b>Round {G.draftRound} of {CONFIG.draftPicksPerYear}</b></div>
          {alreadyPicked
            ? <div style={muted}>You picked this round. Waiting for the other seats.</div>
            : pack && pack.length > 0
            ? pack.map((c) => (
                <button key={c.uid} style={btn} onClick={() => moves.pickCard(c.uid)}>
                  Pick: {cardLabel(c.cardId)}
                </button>
              ))
            : <div style={muted}>No card to pick this round; waiting for the other seats.</div>}
        </div>
      );
    }

    case 'actions': {
      const mine = G.players[me];
      const ownedProvinces = Object.values(G.provinces).filter((province) => province.owner === me);
      const buildable = ownedProvinces.filter((province) =>
        !province.building && mine.gold >= CONFIG.buildCost);
      const levyCap = ownedProvinces.reduce((total, province) => total + province.levy, 0);
      const musterMax = Math.min(levyCap - mine.troops, mine.gold);
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <div><b>{mine.actionsLeft} action{mine.actionsLeft === 1 ? '' : 's'} remaining</b></div>
          {musterMax > 0 && <div>
            {num}<button style={btn} onClick={() => moves.muster(Math.min(n, musterMax))}>
              Muster up to {musterMax}
            </button>
          </div>}
          {buildable.length > 0 && <div>
            <b>Build</b>{' '}
            {buildable.flatMap((province) => [
              <button key={`${province.id}-market`} style={btn} onClick={() => moves.build(province.id, 'market')}>
                Market @ {province.id}
              </button>,
              <button key={`${province.id}-castle`} style={btn} onClick={() => moves.build(province.id, 'castle')}>
                Castle @ {province.id}
              </button>,
            ])}
          </div>}
          {mine.gold >= CONFIG.giftCost && <div>
            <b>Gift</b>{' '}
            {isKing
              ? Object.keys(G.favor).map((duke) =>
                <button key={duke} style={btn} onClick={() => moves.sendGift(duke)}>Gift → seat {duke}</button>)
              : <button style={btn} onClick={() => moves.sendGift(me)}>Gift → King</button>}
          </div>}
          <div><button style={btn} onClick={() => moves.holdCourt()}>Hold Court</button></div>
          {mine.hand.map((held) => (
            <CardControls key={held.uid} held={held} moves={moves} G={G} me={me} isKing={isKing} />
          ))}
          <button style={{ ...btn, background: '#eadfca' }} onClick={() => moves.pass()}>
            Pass and end turn ▶
          </button>
        </div>
      );
    }

    case 'warAndRebellion': {
      const hasCommitted = G.pendingWar && Object.prototype.hasOwnProperty.call(G.pendingWar.commits, me);
      // A private player view intentionally hides other seats' dial values.
      // It supplies allCommitted as the public readiness signal; the fallback
      // keeps local hotseat's full-state debug view working too.
      const allCommitted = G.pendingWar && (G.pendingWar.allCommitted ??
        Object.keys(G.players).every((seat) =>
          Object.prototype.hasOwnProperty.call(G.pendingWar.commits, seat)));
      const rebellion = G.activeRebellion;
      const sideToChoose = rebellion?.step === 'sides' &&
        rebellion.sideOrder[rebellion.sideIndex] === me;
      const seatToRenegotiate = rebellion?.step === 'negotiation' &&
        rebellion.sideOrder[rebellion.negotiationIndex] === me;
      const canEndWar = isKing && !G.pendingWar && !G.pendingConquest &&
        !G.pendingOccupation && !rebellion;
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          {G.pendingWar && <div style={{ padding: 8, background: '#e7edf5', borderRadius: 4 }}>
            <b>External war: {G.pendingWar.kingdomId}</b>
            <div style={muted}>
              {hasCommitted ? `Your dial is set to ${G.pendingWar.commits[me]}.` : 'Set your secret troop commitment.'}
              {' '}{allCommitted ? 'All seats are committed.' : 'Waiting for all seats to commit.'}
            </div>
            {!hasCommitted && <div style={{ marginTop: 5 }}>
              {num}<button style={btn} onClick={() => moves.commitTroops(n)}>Set dial</button>
            </div>}
            {isKing && allCommitted &&
              <button style={btn} onClick={() => moves.revealWar()}>Reveal dials &amp; resolve war ▶</button>}
          </div>}
          {G.pendingConquest && isKing && <div style={{ padding: 8, background: '#e5f2df', borderRadius: 4 }}>
            <b>Distribute conquered provinces</b>
            {G.pendingConquest.provinceIds.map((provinceId) => (
              <div key={provinceId}>
                <b>{G.provinces[provinceId]?.name || provinceId}</b>{' '}
                {Object.keys(G.favor).map((duke) => (
                  <button key={`${provinceId}-${duke}`} style={btn}
                    onClick={() => moves.grantConquest(provinceId, duke)}>
                    Grant → seat {duke}
                  </button>
                ))}
                <button style={btn} onClick={() => moves.sackConquest(provinceId)}>Sack</button>
              </div>
            ))}
          </div>}
          {G.pendingOccupation && isKing && <div style={{ padding: 8, background: '#f5e1dc', borderRadius: 4 }}>
            <b>Choose the occupied province</b>
            <div>{G.pendingOccupation.provinceIds.map((provinceId) => (
              <button key={provinceId} style={btn} onClick={() => moves.occupyProvince(provinceId)}>
                Occupy {G.provinces[provinceId]?.name || provinceId}
              </button>
            ))}</div>
          </div>}
          {!isKing && G.warLostThisYear && mine.gold > 0 && <div>
            {num}<button style={btn} disabled={n <= 0 || n > mine.gold}
              onClick={() => moves.transferGold(G.crownHolder, n)}>
              Contribute to war reparations
            </button>
          </div>}
          {isKing && rebellion?.step === 'negotiation' && mine.gold > 0 && <div>
            <b>King’s cash offers</b>{' '}
            {Object.keys(G.favor).map((duke) => (
              <button key={duke} style={btn} disabled={n <= 0 || n > mine.gold}
                onClick={() => moves.transferGold(duke, n)}>
                Offer {n}g → seat {duke}
              </button>
            ))}
          </div>}
          {sideToChoose && <div>
            <b>Choose your rebellion side</b>{' '}
            {['loyal', 'rebel', 'neutral'].map((side) => (
              <button key={side} style={btn} onClick={() => moves.chooseRebellionSide(side)}>
                {side}
              </button>
            ))}
          </div>}
          {seatToRenegotiate && <div>
            <b>Lock your final side</b>{' '}
            {['loyal', 'rebel', 'neutral'].map((side) => (
              <button key={side} style={btn} onClick={() => moves.renegotiateRebellion(side)}>
                {side}
              </button>
            ))}
          </div>}
          {!isKing && !rebellion && !G.rebellionThisYear && !G.pendingWar &&
            <button style={btn} onClick={() => moves.declareRebellion()}>Declare rebellion ⚔</button>}
          {isKing && rebellion?.step === 'locked' &&
            <button style={btn} onClick={() => moves.resolveRebellion()}>Resolve rebellion ▶</button>}
          {canEndWar && <button style={btn} onClick={() => moves.endWarPhase()}>End War &amp; Rebellion ▶</button>}
          {!G.pendingWar && !G.pendingConquest && !G.pendingOccupation && !rebellion && !canEndWar &&
            <div style={muted}>Waiting for the King to close this phase.</div>}
        </div>
      );
    }

    case 'harvest':
      // Only the crown-holder is ever active here (game.js turn order).
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={muted}>Harvest scores income, crown rent, and office prestige on advance.</div>
          <button style={btn} onClick={() => moves.endHarvest()}>Complete harvest &amp; begin next year ▶</button>
        </div>
      );

    default:
      return <div>—</div>;
  }
}
