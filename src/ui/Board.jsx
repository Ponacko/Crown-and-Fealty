// ==========================================================================
// BOARD — intentionally ugly dev harness. No styling ambitions: this exists
// to expose state and fire moves while you tune numbers. Use the boardgame.io
// debug panel (right side) to switch which seat you're acting as.
// ==========================================================================
import React from 'react';
import { CONFIG } from '../config.js';
import { CARDS } from '../game/data.js';

const box = { border: '1px solid #999', padding: 8, margin: 6, fontFamily: 'monospace', fontSize: 13 };
const btn = { margin: 2, fontFamily: 'monospace' };
const cardName = (uid) => {
  const id = uid.replace(/_\d+$/, '');
  const c = CARDS.find((x) => x.id === id);
  return c ? c.name : uid;
};

// §5: a seat is active either as the sole ctx.currentPlayer (Council,
// Harvest, and each sequential Actions turn), or, when a phase sets
// activePlayers (Draft, War & Rebellion), by appearing in ctx.activePlayers.
function isActiveSeat(ctx, seat) {
  if (ctx.activePlayers) return seat in ctx.activePlayers;
  return ctx.currentPlayer === seat;
}

export function Board({ G, ctx, moves, playerID }) {
  const me = playerID ?? G.crownHolder;
  const isKing = me === G.crownHolder;
  const phase = ctx.phase;
  const active = isActiveSeat(ctx, me);

  if (ctx.gameover) {
    return (
      <div style={box}>
        <h2>Game over</h2>
        <div>Winner: seat {ctx.gameover.winner}</div>
        <pre>{JSON.stringify(ctx.gameover.scores, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* --- Status --- */}
      <div style={{ ...box, minWidth: 260 }}>
        <b>Year {G.year} / {CONFIG.years}</b> — phase: <b>{phase}</b>
        <div>Acting as seat: <b>{me}</b> {isKing ? '(KING 👑)' : '(duke)'}</div>
        <div>Active now: <b>{ctx.activePlayers ? Object.keys(ctx.activePlayers).join(', ') : ctx.currentPlayer}</b></div>
        <div>Crown holder: seat {G.crownHolder}</div>
        <div>Tax law: {G.taxLaw} | Levy law: {G.levyLaw}</div>
        <div>Offices: {JSON.stringify(G.offices)}</div>
        <div>Pending war: {G.pendingWar ? G.pendingWar.kingdomId : '—'}</div>
        <div>Rebellion: {G.activeRebellion ? `seat ${G.activeRebellion.leader}` : '—'}</div>
      </div>

      {/* --- Players --- */}
      <div style={{ ...box, minWidth: 260 }}>
        <b>Players</b>
        {Object.entries(G.players).map(([seat, p]) => (
          <div key={seat} style={{ borderTop: '1px dotted #ccc', marginTop: 4, paddingTop: 4 }}>
            seat {seat}{seat === G.crownHolder ? ' 👑' : ''}: {p.prestige} prestige
            <div>gold {p.gold} | troops {p.troops} | actionsLeft {p.actionsLeft}</div>
            <div>favor: {seat in G.favor ? G.favor[seat] : 'n/a (king)'}</div>
            <div>hand: {p.hand.map((h) => cardName(h.uid)).join(', ') || '—'}</div>
          </div>
        ))}
      </div>

      {/* --- Provinces --- */}
      <div style={{ ...box, minWidth: 260, maxHeight: 320, overflow: 'auto' }}>
        <b>Provinces</b>
        {Object.values(G.provinces).map((pr) => (
          <div key={pr.id}>
            {pr.name}: owner {pr.owner ?? 'neutral'} | tax {pr.tax} levy {pr.levy}
            {pr.building ? ` [${pr.building}]` : ''}{pr.capital ? ' ★' : ''}
          </div>
        ))}
      </div>

      {/* --- Controls for the current phase --- */}
      <div style={{ ...box, minWidth: 320 }}>
        <b>Actions ({phase})</b>
        {active
          ? <PhaseControls phase={phase} moves={moves} G={G} me={me} isKing={isKing} />
          : <div>Waiting for seat {ctx.currentPlayer} — it isn't seat {me}'s turn.</div>}
      </div>

      {/* --- Log --- */}
      <div style={{ ...box, minWidth: 320, maxHeight: 320, overflow: 'auto' }}>
        <b>Log</b>
        {G.log.slice(-25).reverse().map((l, i) => <div key={i}>· {l}</div>)}
      </div>
    </div>
  );
}

function CardControls({ held, moves, G, me, isKing }) {
  const definition = CARDS.find((card) => card.id === held.cardId);
  if (!definition) return null;
  if (definition.crownOnly && !isKing) {
    return <button style={btn} disabled>Hold {definition.name} (crown-only)</button>;
  }

  if (definition.effect === 'envoy') {
    return G.foreignKingdoms.filter((kingdom) => !kingdom.conquered).map((kingdom) => (
      <button key={`${held.uid}-${kingdom.id}`} style={btn}
        onClick={() => moves.playCard(held.uid, kingdom.id)}>
        Envoy → {kingdom.name}
      </button>
    ));
  }

  if (definition.effect === 'tournament' && isKing) {
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
    return choices;
  }

  if (definition.effect === 'charter' && isKing) {
    return Object.values(G.provinces)
      .filter((province) => province.owner == null && province.region === 'minor')
      .flatMap((province) => Object.keys(G.favor).map((duke) => (
        <button key={`${held.uid}-${province.id}-${duke}`} style={btn}
          onClick={() => moves.playCard(held.uid, province.id, duke)}>
          Charter {province.id} → {duke}
        </button>
      )));
  }

  if (definition.effect === 'claim') {
    return Object.values(G.provinces).filter((province) => province.owner !== me).map((province) => (
      <button key={`${held.uid}-${province.id}`} style={btn}
        onClick={() => moves.playCard(held.uid, province.id)}>
        Claim {province.id}
      </button>
    ));
  }

  if ((definition.effect === 'favor1' || definition.effect === 'title') && isKing) {
    return Object.keys(G.favor).map((duke) => (
      <button key={`${held.uid}-${duke}`} style={btn}
        onClick={() => moves.playCard(held.uid, duke)}>
        {definition.name} → {duke}
      </button>
    ));
  }

  return (
    <button style={btn} onClick={() => moves.playCard(held.uid)}>
      Play {definition.name}
    </button>
  );
}

function PhaseControls({ phase, moves, G, me, isKing }) {
  const [n, setN] = React.useState(1);
  const num = (
    <input type="number" value={n} min={0} style={{ width: 50 }}
      onChange={(e) => setN(parseInt(e.target.value || '0', 10))} />
  );

  switch (phase) {
    case 'council':
      // Only the crown-holder is ever active here (game.js turn order), so
      // reaching this branch already implies isKing.
      return (
        <div>
          <div>Tax law:
            {['low', 'medium', 'high'].map((v) =>
              <button key={v} style={btn} onClick={() => moves.setLaw('taxLaw', v)}>{v}</button>)}
          </div>
          <div>Levy law:
            {['low', 'medium', 'high'].map((v) =>
              <button key={v} style={btn} onClick={() => moves.setLaw('levyLaw', v)}>{v}</button>)}
          </div>
          <div>Declare war:
            {G.foreignKingdoms.filter((k) => !k.conquered).map((k) =>
              <button key={k.id} style={btn} onClick={() => moves.declareWar(k.id)}>
                {k.name} (g{k.garrison})
              </button>)}
          </div>
          <div>Grant office (to a duke seat):
            {CONFIG.grantableOffices.map((o) =>
              Object.keys(G.favor).map((d) =>
                <button key={o + d} style={btn} onClick={() => moves.grantOffice(o, d)}>
                  {o}→{d}
                </button>))}
          </div>
          <button style={btn} onClick={() => moves.endCouncil()}>END COUNCIL ▶</button>
        </div>
      );

    case 'draft': {
      // §9 Phase 2: pick one card from your current pack; once everyone's
      // picked, packs auto-pass left and the phase auto-ends after the
      // final round (see moves.js dealDraftPacks/pickCard).
      const pack = G.draftPacks ? G.draftPacks[me] : null;
      return (
        <div>
          <div>Draft round {G.draftRound} / {CONFIG.draftPicksPerYear}</div>
          {pack && pack.length > 0
            ? pack.map((c) => (
                <button key={c.uid} style={btn} onClick={() => moves.pickCard(c.uid)}>
                  Pick {cardName(c.uid)}
                </button>
              ))
            : <div>Nothing left in your pack this round.</div>}
        </div>
      );
    }

    case 'actions': {
      const mine = G.players[me];
      return (
        <div>
          <div>Actions left: <b>{mine.actionsLeft}</b></div>
          <div>{num}
            <button style={btn} onClick={() => moves.muster(n)}>Muster</button>
          </div>
          <div>
            {Object.values(G.provinces).filter((p) => p.owner === me && !p.building).map((p) => (
              <span key={p.id}>
                <button style={btn} onClick={() => moves.build(p.id, 'market')}>Market@{p.id}</button>
                <button style={btn} onClick={() => moves.build(p.id, 'castle')}>Castle@{p.id}</button>
              </span>
            ))}
          </div>
          <div>
            {isKing
              ? Object.keys(G.favor).map((d) =>
                  <button key={d} style={btn} onClick={() => moves.sendGift(d)}>Gift→{d}</button>)
              : <button style={btn} onClick={() => moves.sendGift(me)}>Gift→king</button>}
            <button style={btn} onClick={() => moves.holdCourt()}>Hold Court</button>
          </div>
          <div>
            {mine.hand.map((h) => (
              <CardControls key={h.uid} held={h} moves={moves} G={G} me={me} isKing={isKing} />
            ))}
          </div>
          <button style={btn} onClick={() => moves.pass()}>PASS (end turn) ▶</button>
        </div>
      );
    }

    case 'warAndRebellion':
      return (
        <div>
          {G.pendingWar && <div>{num}
            <button style={btn} onClick={() => moves.commitTroops(n)}>Commit troops</button>
            {isKing && <button style={btn} onClick={() => moves.revealWar()}>Reveal dials &amp; resolve war</button>}
          </div>}
          {G.pendingConquest && isKing && <div>
            <b>Distribute conquered provinces</b>
            {G.pendingConquest.provinceIds.map((provinceId) => (
              <div key={provinceId}>
                {G.provinces[provinceId]?.name || provinceId}
                {Object.keys(G.favor).map((duke) => (
                  <button key={`${provinceId}-${duke}`} style={btn}
                    onClick={() => moves.grantConquest(provinceId, duke)}>
                    Grant → {duke}
                  </button>
                ))}
                <button style={btn} onClick={() => moves.sackConquest(provinceId)}>Sack</button>
              </div>
            ))}
          </div>}
          {G.pendingOccupation && isKing && <div>
            <b>Choose the occupied province</b>
            {G.pendingOccupation.provinceIds.map((provinceId) => (
              <button key={provinceId} style={btn}
                onClick={() => moves.occupyProvince(provinceId)}>
                Occupy {G.provinces[provinceId]?.name || provinceId}
              </button>
            ))}
          </div>}
          {!isKing && <button style={btn} onClick={() => moves.transferGold(G.crownHolder, n)}>
            Cover king reparations ({n}g)
          </button>}
          {!isKing && !G.activeRebellion &&
            <button style={btn} onClick={() => moves.declareRebellion()}>⚔ DECLARE REBELLION</button>}
          {isKing && G.activeRebellion &&
            <button style={btn} onClick={() => moves.resolveRebellion()}>Resolve rebellion</button>}
          {isKing && <button style={btn} onClick={() => moves.endWarPhase()}>END WAR PHASE ▶</button>}
        </div>
      );

    case 'harvest':
      // Only the crown-holder is ever active here (game.js turn order).
      return (
        <div>
          <div>Harvest scores income, crown rent, and office prestige on advance.</div>
          <button style={btn} onClick={() => moves.endHarvest()}>HARVEST &amp; NEXT YEAR ▶</button>
        </div>
      );

    default:
      return <div>—</div>;
  }
}
