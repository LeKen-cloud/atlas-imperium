import { useState } from 'react';
import { useGame, Section, CountryPicker, CName } from '../common';
import { LineChart, pal } from '../charts';
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtPop } from '../../i18n';
import { debtRatio, gdpPc } from '../../sim/economy';
import { militaryScore } from '../../sim/relations';
import type { Country } from '../../sim/types';

const METRICS: [string, (c: Country) => number[]][] = [['cd.gdp', (c) => c.hist.gdp.map((x) => x / 1000)], ['cd.growth', (c) => c.hist.growth], ['cd.inflation', (c) => c.hist.infl], ['cd.unemployment', (c) => c.hist.unemp], ['cd.debt', (c) => c.hist.debt], ['cd.bond', (c) => c.hist.bond], ['cd.stability', (c) => c.hist.stability], ['mk.equities', (c) => c.hist.equity]];

export function ComparePanel() {
  const { w, t, lang, compare, setCompare } = useGame();
  const [m, setM] = useState(0);
  const list = compare.filter((x) => w.countries[x]);
  const cs = list.map((x) => w.countries[x]);
  return (
    <div>
      <div className="row"><CountryPicker value={null} onChange={(iso) => iso && !compare.includes(iso) && setCompare([...compare, iso].slice(-6))} placeholder={t('cmp.add')} />
        {list.map((x) => <span key={x} className="chip"><CName iso={x} /> <button className="link" onClick={() => setCompare(compare.filter((y) => y !== x))}>✕</button></span>)}</div>
      {cs.length > 0 && <>
        <table className="tbl"><thead><tr><th /> {cs.map((c) => <th key={c.iso} className="r">{c.flag} {c.iso}</th>)}</tr></thead><tbody>
          {([
            ['cd.population', (c: Country) => fmtPop(c.soc.pop, lang)], ['cd.gdp', (c: Country) => fmtMoney(c.econ.gdp, lang)], ['cd.gdppc', (c: Country) => '$' + fmtNum(gdpPc(c), 0, lang)],
            ['cd.growth', (c: Country) => fmtPct(c.econ.growth, 1, lang)], ['cd.inflation', (c: Country) => fmtPct(c.econ.inflation, 1, lang)], ['cd.unemployment', (c: Country) => fmtPct(c.econ.unemployment, 1, lang)],
            ['cd.debt', (c: Country) => fmtPct(debtRatio(c), 0, lang)], ['cd.bond', (c: Country) => fmtPct(c.fin.bond10y, 2, lang)], ['cd.rating', (c: Country) => c.fin.rating],
            ['cd.stability', (c: Country) => fmtNum(c.gov.stability, 0, lang)], ['cd.military', (c: Country) => fmtNum(militaryScore(w, c.iso), 0, lang)], ['cd.tech', (c: Country) => fmtNum(c.tech, 0, lang)],
            ['cd.education', (c: Country) => fmtNum(c.soc.education, 0, lang)], ['cd.influence', (c: Country) => fmtNum(c.influence, 0, lang)],
          ] as [string, (c: Country) => string][]).map(([k, f]) => <tr key={k}><td>{t(k)}</td>{cs.map((c) => <td key={c.iso} className="r">{f(c)}</td>)}</tr>)}
        </tbody></table>
        <Section title={t('cmp.metric')} right={<select className="sel" value={m} onChange={(e) => setM(+e.target.value)}>{METRICS.map(([k], i) => <option key={k} value={i}>{t(k)}</option>)}</select>}>
          <LineChart series={cs.map((c, i) => ({ name: c.iso, data: METRICS[m][1](c), color: pal(i) }))} labels={cs[0].hist.t.map((x) => fmtDate(w, x, lang))} />
        </Section>
      </>}
    </div>
  );
}
