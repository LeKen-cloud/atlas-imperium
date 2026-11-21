import { useFocus, NoCountry } from './index';
import { Section, Prov, Stat, CName, Bar } from '../common';
import { fmtMoney, fmtPct } from '../../i18n';
import { tradeView, exposure } from '../../sim/trade';
import { hasTreaty, sanctionsOn } from '../../sim/relations';

export function TradePanel() {
  const { w, t, lang, iso, setMapMode } = useFocus();
  if (!iso) return <NoCountry />;
  const c = w.countries[iso]; const tv = tradeView();
  const partners = tv.partners[iso] || [];
  const tot = (c.econ.exports + c.econ.imports) || 1;
  const exposed = Object.values(w.countries).filter((x) => x.alive && x.iso !== iso).map((x) => ({ iso: x.iso, v: exposure(x.iso, iso) })).sort((a, b) => b.v - a.v).slice(0, 8);
  const blocs = w.orgs.filter((o) => o.kind === 'economic' && o.members.includes(iso));
  const ftas = w.treaties.filter((x) => x.type === 'fta' && (x.a === iso || x.b === iso));
  return (
    <div>
      <div className="note">{t('tr.model')} <Prov p="estimate" /></div>
      <div className="stats g4">
        <Stat label={t('eco.exports')} value={fmtMoney(c.econ.exports, lang)} p="simulated" />
        <Stat label={t('eco.imports')} value={fmtMoney(c.econ.imports, lang)} p="simulated" />
        <Stat label={t('tr.balance')} value={fmtMoney(c.econ.exports - c.econ.imports, lang)} p="simulated" />
        <Stat label={t('pol.tariff')} value={fmtPct(c.policy.tariff, 1, lang)} />
      </div>
      <Section title={t('tr.partners')} right={<button className="btn sm ghost" onClick={() => setMapMode('trade')}>{t('mode.trade')} ⌖</button>}>
        {partners.map((p) => <Bar key={p.iso} label={<><CName iso={p.iso} />{hasTreaty(w, iso, p.iso, 'fta') ? ' ⇄' : ''}</>} value={(p.ex + p.im) / tot * 100} max={Math.max(...partners.map((x) => (x.ex + x.im) / tot * 100))} right={`${fmtMoney(p.ex, lang)} / ${fmtMoney(p.im, lang)} · ${fmtPct((p.ex + p.im) / tot * 100, 1, lang)}`} />)}
        <p className="muted small">{t('eco.exports')} / {t('eco.imports')} · {t('tr.dependency')}</p>
      </Section>
      <Section title={t('tr.exposure', { c: iso })}>
        {exposed.map((x) => <Bar key={x.iso} label={<CName iso={x.iso} />} value={x.v * 100} max={Math.max(...exposed.map((y) => y.v * 100), 1)} color="#e3a33b" right={fmtPct(x.v * 100, 1, lang)} />)}
      </Section>
      <Section title={t('tr.agreements')}>
        <p>{blocs.map((o) => <span key={o.id} className="chip">{lang === 'fr' ? o.nameFr : o.name}</span>)}{ftas.map((f) => <span key={f.id} className="chip">⇄ <CName iso={f.a === iso ? f.b : f.a} /></span>)}{!blocs.length && !ftas.length && '—'}</p>
        <p>{t('tr.sanctionsIn')}: {sanctionsOn(w, iso).map((s) => <span key={s.from} className="chip neg">{w.countries[s.from]?.flag} {s.from} ×{s.level}</span>)}</p>
        <p>{t('tr.sanctionsOut')}: {w.sanctions.filter((s) => s.from === iso).map((s) => <span key={s.to} className="chip">{w.countries[s.to]?.flag} {s.to} ×{s.level}</span>)}</p>
      </Section>
      <Section title={t('tr.global')}>
        <table className="tbl"><tbody>{tv.flows.slice(0, 12).map(([a, b, v], i) => <tr key={i}><td><CName iso={a} /> → <CName iso={b} /></td><td className="r">{fmtMoney(v, lang)}</td></tr>)}</tbody></table>
      </Section>
    </div>
  );
}
