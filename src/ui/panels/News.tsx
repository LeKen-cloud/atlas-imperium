import { useState } from 'react';
import { useGame, Section, Prov, CName } from '../common';
import { LineChart, pal } from '../charts';
import { fmtDate } from '../../i18n';
import type { NewsItem } from '../../sim/types';
import { CAT_COLORS, CAT_ICONS } from '../theme';

const CATS = ['economy', 'finance', 'politics', 'diplomacy', 'conflict', 'trade', 'business', 'social', 'disaster', 'science', 'health', 'borders'];
const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'];

export function NewsPanel() {
  const { w, t, lang, focus } = useGame();
  const [cat, setCat] = useState(''); const [reg, setReg] = useState(''); const [country, setCountry] = useState(''); const [major, setMajor] = useState(false); const [mineOnly, setMineOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null); const [from, setFrom] = useState(0);
  const items = w.news.filter((n) => (!cat || n.cat === cat) && (!major || n.severity >= 2) && (!mineOnly || (w.player && n.countries.includes(w.player))) && (!reg || n.countries.some((c) => w.countries[c]?.region === reg)) && (!country || n.countries.includes(country)) && n.t >= from).slice(0, 200);
  const sel = w.news.find((n) => n.id === open);
  const related = (n: NewsItem) => w.news.filter((m) => m.id !== n.id && m.countries.some((c) => n.countries.includes(c))).slice(0, 5);
  return (
    <div>
      <div className="filters">
        <select className="sel" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('news.category')}><option value="">{t('news.category')}: {t('cat.all')}</option>{CATS.map((c) => <option key={c} value={c}>{t('cat.' + c)}</option>)}</select>
        <select className="sel" value={reg} onChange={(e) => setReg(e.target.value)} aria-label={t('news.region')}><option value="">{t('news.region')}: {t('ui.all')}</option>{REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <select className="sel" value={country} onChange={(e) => setCountry(e.target.value)} aria-label={t('news.country')}><option value="">{t('news.country')}: {t('ui.all')}</option>{Object.values(w.countries).filter((c) => c.alive).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.iso} value={c.iso}>{lang === 'fr' ? c.nameFr : c.name}</option>)}</select>
        <select className="sel" value={from} onChange={(e) => setFrom(+e.target.value)} aria-label={t('news.date')}><option value={0}>{t('news.date')}: {t('ui.all')}</option>{[3, 12, 36].map((m) => <option key={m} value={Math.max(0, w.t - m)}>−{m} {t('ui.months')}</option>)}</select>
        <label className="chk"><input type="checkbox" checked={major} onChange={(e) => setMajor(e.target.checked)} />{t('news.majorOnly')}</label>
        {w.player && <label className="chk"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />{t('news.myCountry')}</label>}
      </div>
      {sel && <Section title={t(sel.key, sel.params)} right={<button className="btn ghost sm" onClick={() => setOpen(null)}>✕</button>}>
        <p className="small"><Prov p={sel.prov} /> {fmtDate(w, sel.t, lang)} · {t('cat.' + sel.cat)} · {'●'.repeat(sel.severity)}</p>
        <p className="muted small">{t('news.simulatedNote')}</p>
        <p><b>{t('news.involved')}:</b> {sel.countries.map((c) => <CName key={c} iso={c} />)}</p>
        {sel.causes.length > 0 && <p><b>{t('news.causes')}:</b> {sel.causes.map((c) => t(c)).join(' · ')}</p>}
        {sel.effects.length > 0 && <p><b>{t('news.effects')}:</b> {sel.effects.map((c) => t(c)).join(' · ')}</p>}
        {sel.countries[0] && w.countries[sel.countries[0]] && <p className="small"><b>{t('news.context')}:</b> {t('cd.growth')} {w.countries[sel.countries[0]].econ.growth.toFixed(1)}% · {t('cd.inflation')} {w.countries[sel.countries[0]].econ.inflation.toFixed(1)}% · {t('cd.stability')} {w.countries[sel.countries[0]].gov.stability.toFixed(0)}</p>}
        {sel.link && <button className="btn sm" onClick={() => focus(sel.link!)}>{t('news.goTo')} →</button>}
        <h4>{t('news.related')}</h4><ul className="news">{related(sel).map((m) => <li key={m.id}><button className="link" onClick={() => setOpen(m.id)}>{fmtDate(w, m.t, lang)} — {t(m.key, m.params)}</button></li>)}</ul>
      </Section>}
      {!items.length && <p className="muted">{t('news.empty')}</p>}
      <ul className="news">{items.map((n) => <li key={n.id} className={'sev' + n.severity} style={{ ['--nc' as any]: CAT_COLORS[n.cat] }}><button className="link" onClick={() => setOpen(n.id)}>
        <span className="nd">{fmtDate(w, n.t, lang)}</span> <span className="nc">{CAT_ICONS[n.cat]} {t('cat.' + n.cat)}</span> {t(n.key, n.params)} {n.prov === 'ai' && <Prov p="ai" compact />}</button></li>)}</ul>
    </div>
  );
}

export function TimelinePanel() {
  const { w, t, lang, openReport, rewind, snapshots } = useGame();
  const iso = w.player;
  const major = w.news.filter((n) => n.severity >= 3 || n.cat === 'borders').slice(0, 80);
  const byYear: Record<string, typeof major> = {};
  for (const n of major) { const y = fmtDate(w, n.t, lang).split(' ').pop()!; (byYear[y] ||= []).push(n); }
  const c = iso ? w.countries[iso] : null;
  return (
    <div>
      <Section title={t('turn.history')}>
        {!w.reports.length && <p className="muted">{t('tl.empty')}</p>}
        <ul className="chapters">{[...w.reports].reverse().map((r) => <li key={r.n}>
          <b>{t('turn.chapter', { n: r.n })}</b> <small className="muted">{fmtDate(w, r.from, lang)} → {fmtDate(w, r.to, lang)}</small>
          <span className="small">{r.narrative ? r.narrative.slice(0, 110) + '…' : r.headlines.slice(0, 1).map((id) => { const n = w.news.find((x) => x.id === id); return n ? t(n.key, n.params) : ''; }).join('')}</span>
          <span className="actions"><button className="btn sm" onClick={() => openReport(r)}>{t('turn.open')}</button>
            {snapshots.includes(r.n) && <button className="btn sm ghost" onClick={() => rewind(r.n)}>↺ {t('turn.rewindTo')}</button>}</span></li>)}</ul>
      </Section>
      {c && <Section title={t('tl.chart')}><LineChart series={[{ name: 'GDP $T', data: c.hist.gdp.map((x) => x / 1e6), color: pal(0) }]} labels={c.hist.t.map((x) => fmtDate(w, x, lang))} height={130} />
        <LineChart series={[{ name: t('cd.stability'), data: c.hist.stability, color: pal(1) }, { name: t('cd.approval'), data: c.hist.approval, color: pal(2) }]} labels={c.hist.t.map((x) => fmtDate(w, x, lang))} height={120} /></Section>}
      <Section title={t('tl.major')}>
        {!major.length && <p className="muted">{t('tl.empty')}</p>}
        <div className="timeline">{Object.entries(byYear).map(([y, list]) => <div key={y}><h4>{y}</h4><ul>{list.map((n) => <li key={n.id}><span className="nd">{fmtDate(w, n.t, lang)}</span> {t(n.key, n.params)}</li>)}</ul></div>)}</div>
      </Section>
    </div>
  );
}
