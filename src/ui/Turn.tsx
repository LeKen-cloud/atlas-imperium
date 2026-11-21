// Turn-based play UI: turn bar (time jump + end turn), queued orders tray, and the chapter report.
import { useGame, CName, Prov } from './common';
import { fmtDate, fmtMoney, fmtNum } from '../i18n';
import { JUMPS, removeOrder, ordersLeft } from '../sim/turn';
import type { TurnReport } from '../sim/types';
import { respondProposal } from '../sim/actions';
import { CAT_COLORS, CAT_ICONS } from './theme';
import { RATINGS } from '../sim/economy';
import { aiStatus } from '../ai/llm';

export function TurnBar() {
  const { w, t, lang, endTurn, busy, bump } = useGame();
  return (
    <div className="turnbar">
      <span className="turn-n">{t('turn.label', { n: w.turn.n })}</span>
      <span className="date">{fmtDate(w, w.t, lang)}</span>
      <label className="jump" title={t('turn.jump')}>
        <span className="sr">{t('turn.jump')}</span>
        <select className="sel sm" value={w.turn.jump} onChange={(e) => { w.turn.jump = +e.target.value; bump(); }} aria-label={t('turn.jump')}>
          {JUMPS.map((m) => <option key={m} value={m}>⏩ {t('turn.m' + m)}</option>)}
        </select>
      </label>
      {w.player && <span className={'ocount' + (ordersLeft(w) === 0 ? ' full' : '')}>{t('turn.orders', { u: w.turn.orders.length, m: w.turn.maxOrders })}</span>}
      <button className="btn endturn" disabled={busy} onClick={endTurn} title="Ctrl+Enter">{w.player ? t('turn.end') : t('turn.observerEnd')} ▶</button>
    </div>
  );
}

export function OrdersTray() {
  const { w, t, bump, setPanel } = useGame();
  if (!w.player) return null;
  return (
    <div className="orders-tray" aria-label={t('turn.yourOrders')}>
      {Array.from({ length: w.turn.maxOrders }, (_, i) => {
        const o = w.turn.orders[i];
        return o ? <div key={o.id} className="oslot filled" title={o.text || o.summary}>
          <span className="onum">{i + 1}</span><span className="otext">{o.summary || o.text}</span>
          <button className="link" aria-label={t('turn.removeOrder')} onClick={() => { removeOrder(w, o.id); bump(); }}>✕</button>
        </div> : <button key={'e' + i} className="oslot empty" onClick={() => setPanel('government')}><span className="onum">{i + 1}</span>{t('turn.addOrder')}</button>;
      })}
    </div>
  );
}

const KEY_FMT: Record<string, (v: number, lang: 'en' | 'fr') => string> = {
  gdp: (v, l) => fmtMoney(v, l), equity: (v, l) => fmtNum(v, 0, l), rating: (v) => RATINGS[RATINGS.length - Math.round(v)] || '—', approval: (v, l) => fmtNum(v, 0, l), stability: (v, l) => fmtNum(v, 0, l), influence: (v, l) => fmtNum(v, 0, l),
};

export function ReportModal({ report: r, onClose }: { report: TurnReport; onClose: () => void }) {
  const g = useGame(); const { w, t, lang, bump, rewind, snapshots, focus } = g;
  const P = r.player ? w.countries[r.player] : null;
  const news = r.headlines.map((id) => w.news.find((n) => n.id === id)).filter(Boolean) as typeof w.news;
  const props = w.proposals.map((p, i) => ({ p, i })).filter((x) => x.p.to === w.player);
  const fallback = (() => {
    const parts = [t('turn.intro', { a: fmtDate(w, r.from, lang), b: fmtDate(w, r.to, lang) })];
    if (r.orders.length) parts.push(t('turn.ordersSum', { n: r.orders.length }));
    if (news.length) parts.push(news.slice(0, 3).map((n) => t(n.key, n.params)).join('. ') + '.'); else parts.push(t('turn.quiet'));
    if (P) parts.push(t('turn.statsSum', { g: P.econ.growth.toFixed(1), i: P.econ.inflation.toFixed(1), ap: Math.round(P.gov.approval), st: Math.round(P.gov.stability) }));
    return parts.join(' ');
  })();
  const fmt = (k: string, v: number) => (KEY_FMT[k] ? KEY_FMT[k](v, lang) : fmtNum(v, k === 'bond' ? 2 : 1, lang) + (k === 'growth' || k === 'inflation' || k === 'unemployment' || k === 'bond' ? '%' : k === 'debt' || k === 'deficit' ? '%' : ''));
  const canRewind = snapshots.includes(r.n);
  return (
    <div className="report-back" role="dialog" aria-modal="true" aria-label={t('turn.chapter', { n: r.n })}>
      <article className="report" style={{ ['--cc' as any]: P?.color || 'var(--gold)' }}>
        <header className="rp-h">
          <div className="rp-flag" aria-hidden>{P?.flag || '🌍'}</div>
          <div><small>{fmtDate(w, r.from, lang)} → {fmtDate(w, r.to, lang)}</small><h2>{t('turn.chapter', { n: r.n })}{P ? ' · ' + (lang === 'fr' ? P.nameFr : P.name) : ''}</h2></div>
          <button className="btn ghost sm" onClick={onClose} aria-label={t('ui.close')}>✕</button>
        </header>
        <section className="rp-story">
          <p>{r.narrative || fallback}</p>
          <small className="muted">{r.narrative ? <><Prov p="ai" /> {t('turn.chronicleAI')}</> : g.ai.enabled && aiStatus() === 'online' ? <span className="writing">{t('turn.writing')}</span> : <><Prov p="simulated" /> {t('turn.chronicleSim')}</>}</small>
        </section>
        <div className="rp-grid">
          {r.orders.length > 0 && <section className="rp-card"><h3>{t('turn.yourOrders')}</h3>
            <ul className="rp-orders">{r.orders.map((o, i) => <li key={i}><b>{i + 1}. {o.text}</b>
              {o.results.map((x, j) => <div key={j} className={x.ok ? 'ok' : 'err'}>{x.ok ? '✓' : '✗'} {t(x.key, x.params)}{x.reasons?.length ? ' — ' + x.reasons.map((z) => t(z)).join(', ') : ''}</div>)}</li>)}</ul></section>}
          {r.deltas.length > 0 && <section className="rp-card"><h3>{t('turn.yourCountry')}</h3>
            <table className="tbl"><tbody>{r.deltas.map((d) => { const diff = d.after - d.before; const good = Math.abs(diff) < 1e-6 ? 0 : (diff > 0) === d.goodUp ? 1 : -1;
              return <tr key={d.key}><td>{t('turn.k.' + d.key)}</td><td className="r muted">{fmt(d.key, d.before)}</td><td className="r">→</td><td className={'r ' + (good > 0 ? 'pos' : good < 0 ? 'neg' : '')}><b>{fmt(d.key, d.after)}</b> {diff > 1e-6 ? '▲' : diff < -1e-6 ? '▼' : ''}</td></tr>; })}</tbody></table></section>}
          <section className="rp-card wide"><h3>{t('turn.headlines')}</h3>
            {!news.length && <p className="muted">{t('turn.none')}</p>}
            <ul className="rp-news">{news.map((n) => <li key={n.id} style={{ ['--nc' as any]: CAT_COLORS[n.cat] }}><span className="rp-ic">{CAT_ICONS[n.cat]}</span>
              <button className="link" onClick={() => { if (n.link) focus(n.link); onClose(); }}>{t(n.key, n.params)}</button> <small className="muted">{fmtDate(w, n.t, lang)}</small></li>)}</ul></section>
          {r.borders.length > 0 && <section className="rp-card"><h3>{t('turn.mapChanges')}</h3>
            <ul className="rp-news">{r.borders.map((b, i) => <li key={i}>🗺 <b>{b.name}</b> {t('turn.b.' + b.kind)}: <CName iso={b.from} /> → <CName iso={b.to} /></li>)}</ul></section>}
          {props.length > 0 && <section className="rp-card"><h3>{t('turn.proposals')}</h3>
            <ul className="rp-news">{props.map(({ p, i }) => <li key={i}><CName iso={p.from} /> — {t('treaty.' + p.treaty)} <span className="actions">
              <button className="btn sm primary" onClick={() => { respondProposal(w, i, true); bump(); }}>{t('dip.accept')}</button>
              <button className="btn sm" onClick={() => { respondProposal(w, i, false); bump(); }}>{t('dip.reject')}</button></span></li>)}</ul></section>}
          {r.tips.length > 0 && <section className="rp-card advisor"><h3>🎓 {t('turn.advisor')}</h3>
            <ul>{r.tips.map((x, i) => <li key={i}>{t(x.key, x.params)}</li>)}</ul></section>}
        </div>
        <footer className="rp-f">
          {canRewind && <button className="btn ghost" onClick={() => { if (rewind(r.n)) onClose(); }}>↺ {t('turn.rewind')}</button>}
          <button className="btn primary big-inline" onClick={onClose} autoFocus>{t('turn.continue')} ▶</button>
        </footer>
      </article>
    </div>
  );
}
