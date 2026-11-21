import { useState } from 'react';
import { useFocus, NoCountry, ReadOnlyNote } from './index';
import { Section, Stat, Prov, CName } from '../common';
import { LineChart, pal } from '../charts';
import { fmtMoney, fmtPct, fmtNum, fmtDate } from '../../i18n';
import { debtRatio } from '../../sim/economy';
import { warsOf, sanctionsOn } from '../../sim/relations';
import { setGoals } from '../../sim/countryAI';
import { interpretOrder } from '../../ai/agents';
import { queueOrder, ordersLeft } from '../../sim/turn';
import type { Action } from '../../sim/actions';

export function GovernmentPanel() {
  const g = useFocus(); const { w, t, lang, iso, mine, ai, bump, toast } = g;
  const [order, setOrder] = useState('');
  const [out, setOut] = useState<{ actions: Action[]; source: 'ai' | 'rules'; summary: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!iso) return <><p className="muted">{t('gv.observerNote')}</p><NoCountry /></>;
  const c = w.countries[iso]; const e = c.econ;
  setGoals(w, c);
  const alerts: string[] = [];
  if (e.inflation > 8) alerts.push(t('ev.inflation', { c: iso, v: e.inflation.toFixed(1) }));
  if (e.growth < 0) alerts.push(t('ev.recession', { c: iso, g: e.growth.toFixed(1) }));
  if (c.fin.bond10y > 8) alerts.push(t('ev.debtCrisis', { c: iso, y: c.fin.bond10y.toFixed(1) }));
  if (c.gov.stability < 40) alerts.push(t('cause.lowStability') + ' (' + c.gov.stability.toFixed(0) + ')');
  if (e.bankHealth < 40) alerts.push(t('eco.banks') + ': ' + e.bankHealth.toFixed(0));
  for (const x of warsOf(w, iso)) alerts.push('⚔ ' + t('mil.wars') + ': ' + (x.attackers.includes(iso) ? x.defenders : x.attackers).map((k) => w.countries[k]?.[lang === 'fr' ? 'nameFr' : 'name']).join(', '));
  const labels = c.hist.t.map((x) => fmtDate(w, x, lang));
  const run = async () => {
    if (!order.trim()) return; setBusy(true);
    const r = await interpretOrder(w, iso, order, ai, lang); setOut({ ...r, text: order }); setBusy(false);
  };
  const describe = (a: Action) => {
    const x = a as any; const parts = [t('act.' + a.type)];
    if (x.target) parts.push('→ ' + (lang === 'fr' ? w.countries[x.target]?.nameFr : w.countries[x.target]?.name));
    if (x.treaty) parts.push('(' + t('treaty.' + x.treaty) + ')');
    if (x.patch) parts.push(Object.entries(x.patch).map(([k, v]) => k + ' = ' + (typeof v === 'number' ? +v.toFixed(2) : v)).join(', '));
    if (x.key) parts.push(t('sp.' + x.key) + ' = ' + (+x.value).toFixed(1) + '% GDP');
    if (x.id) parts.push(t('reform.' + x.id));
    if (x.level) parts.push('×' + x.level);
    if (x.effects) parts.push(x.effects.length ? x.effects.map((e: any) => e.stat + ' ' + (e.value > 0 ? '+' : '') + e.value + (e.target && e.target !== iso ? ' (' + e.target + ')' : '')).join(', ') : t('eff.symbolic'));
    return parts.join(' ');
  };
  return (
    <div>
      {!mine && <ReadOnlyNote iso={iso} />}
      <Section title={t('gv.brief')} right={<Prov p="simulated" />}>
        <div className="stats g4">
          <Stat label={t('cd.gdp')} value={fmtMoney(e.gdp, lang)} />
          <Stat label={t('cd.growth')} value={fmtPct(e.growth, 1, lang)} />
          <Stat label={t('cd.inflation')} value={fmtPct(e.inflation, 1, lang)} />
          <Stat label={t('cd.unemployment')} value={fmtPct(e.unemployment, 1, lang)} />
          <Stat label={t('cd.debt')} value={fmtPct(debtRatio(c), 0, lang)} />
          <Stat label={t('cd.budget')} value={fmtPct(-e.deficit, 1, lang)} />
          <Stat label={t('cd.approval')} value={fmtNum(c.gov.approval, 0, lang)} />
          <Stat label={t('cd.stability')} value={fmtNum(c.gov.stability, 0, lang)} />
          <Stat label={t('dip.points')} value={fmtNum(c.diploPoints, 0, lang)} />
          <Stat label={t('cd.rating')} value={c.fin.rating} />
          <Stat label={t('tr.sanctionsIn')} value={sanctionsOn(w, iso).length} />
          <Stat label={t('cd.influence')} value={fmtNum(c.influence, 0, lang)} />
        </div>
        <LineChart series={[{ name: t('cd.approval'), data: c.hist.approval, color: pal(0) }, { name: t('cd.stability'), data: c.hist.stability, color: pal(1) }]} labels={labels} />
      </Section>
      <Section title={t('gv.alerts')}>{alerts.length ? <ul className="alerts">{alerts.map((a, i) => <li key={i}>{a}</li>)}</ul> : <p className="muted">—</p>}</Section>
      {mine && <Section title={t('gv.orders') + ' · ' + t('turn.orders', { u: w.turn.orders.length, m: w.turn.maxOrders })} right={<Prov p={ai.enabled ? 'ai' : 'simulated'} />}>
        <p className="muted small">{t('gv.queueHint')} {t('turn.free')}</p>
        <textarea className="inp" rows={3} value={order} onChange={(e) => setOrder(e.target.value)} placeholder={t('gv.ordersHint')} />
        <button className="btn primary" disabled={busy || !order.trim() || ordersLeft(w) <= 0} onClick={run}>{busy ? '…' : t('gv.execute')}</button>
        {ordersLeft(w) <= 0 && <p className="warn small">{t('turn.full')}</p>}
        {out && <div className="order-out">
          <b>{t('turn.interpretation')}</b> <Prov p={out.source === 'ai' ? 'ai' : 'simulated'} />{out.summary && <p>{out.summary}</p>}
          <ul>{out.actions.map((a, i) => <li key={i}><code>{describe(a)}</code></li>)}</ul>
          <div className="actions">
            <button className="btn primary" onClick={() => { const q = queueOrder(w, { actions: out.actions, source: out.source, text: out.text, summary: out.summary || out.actions.map(describe).join(' · ') }); if (q) { toast(t('ok.queued', { u: w.turn.orders.length, m: w.turn.maxOrders }), 'ok'); setOut(null); setOrder(''); bump(); } else toast(t('turn.full'), 'err'); }}>{t('turn.addToTurn')}</button>
            <button className="btn" onClick={() => setOut(null)}>{t('turn.discard')}</button>
          </div>
        </div>}
      </Section>}
      <Section title={t('gv.goals')} right={<Prov p="simulated" />}>
        <p>{c.ai.goals.map((x) => t(x)).join(' · ')}</p><p className="muted small">{t(c.ai.longGoal)}</p>
      </Section>
      {mine && w.proposals.filter((p) => p.to === iso).length > 0 && <Section title={t('dip.inbox')}>
        <InboxList />
      </Section>}
      <Section title={t('int.coalition')}>{c.gov.parties.filter((p) => p.inGov).map((p) => <span key={p.id} className="chip">{t('party.' + p.bloc)} · {p.seats}%</span>)}</Section>
    </div>
  );
}

import { respondProposal } from '../../sim/actions';
export function InboxList() {
  const { w, t, bump, lang } = useFocus();
  const items = w.proposals.map((p, i) => ({ p, i })).filter((x) => x.p.to === w.player);
  if (!items.length) return <p className="muted">—</p>;
  return <ul className="inbox">{items.map(({ p, i }) => <li key={i}><CName iso={p.from} /> — {t('treaty.' + p.treaty)} <small className="muted">{fmtDate(w, p.t, lang)}</small>
    <span><button className="btn sm primary" onClick={() => { respondProposal(w, i, true); bump(); }}>{t('dip.accept')}</button>
      <button className="btn sm" onClick={() => { respondProposal(w, i, false); bump(); }}>{t('dip.reject')}</button></span></li>)}</ul>;
}
