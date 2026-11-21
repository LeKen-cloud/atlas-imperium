import { useState } from 'react';
import { useFocus } from './index';
import { Section, Prov, CName, CountryPicker } from '../common';
import { analystAnswer } from '../../ai/agents';
import type { Analysis } from '../../ai/analyst';
import { riskScore, debtRatio } from '../../sim/economy';
import { fmtNum } from '../../i18n';

export function IntelPanel() {
  const { w, t, lang, iso, ai, select } = useFocus();
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<(Analysis & { ai?: string; q: string }) | null>(null);
  const [target, setTarget] = useState<string | null>(iso);
  const tgt = target || iso;
  const ask = async (question: string) => {
    if (!tgt || !question.trim()) return; setBusy(true); setQ(question);
    const r = await analystAnswer(w, tgt, question, ai, lang); setAns({ ...r, q: question }); setBusy(false);
  };
  const risk = Object.values(w.countries).filter((c) => c.alive && c.econ.gdp > 50000).map((c) => ({ iso: c.iso, v: riskScore(w, c) })).sort((a, b) => b.v - a.v).slice(0, 10);
  return (
    <div>
      <Section title={t('in.ask')}>
        <div className="row"><CountryPicker value={tgt} onChange={setTarget} /></div>
        <div className="row"><input className="inp" value={q} placeholder={t('in.askPh')} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask(q)} /><button className="btn primary" disabled={busy || !tgt} onClick={() => ask(q)}>{busy ? '…' : t('in.ask')}</button></div>
        <div className="chips">{[1, 2, 3, 4, 5, 6].map((i) => <button key={i} className="chip link" onClick={() => ask(t('in.q' + i))}>{t('in.q' + i)}</button>)}</div>
      </Section>
      {ans && <Section title={t('in.answer') + ' — ' + ans.q}>
        <h4>{t('in.factual')} <Prov p="simulated" /></h4>
        <ul className="facts">{ans.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        {ans.ranking && <ol className="rank">{ans.ranking.map((r) => <li key={r.iso}><CName iso={r.iso} /> <span className="muted">{r.label}</span></li>)}</ol>}
        <h4>{t('in.interpretation')} <Prov p="simulated" /></h4>
        <ul>{ans.interpretation.map((f, i) => <li key={i}>{f}</li>)}</ul>
        {ans.ai && <><h4>{t('prov.ai')} <Prov p="ai" /></h4><p className="ai-text">{ans.ai}</p></>}
      </Section>}
      <Section title={t('in.risks')} right={<Prov p="simulated" />}>
        <table className="tbl click"><tbody>{risk.map((r) => <tr key={r.iso} onClick={() => select(r.iso)}><td><CName iso={r.iso} link={false} /></td><td className="r">{fmtNum(r.v, 1, lang)}</td><td className="r small muted">{w.countries[r.iso].fin.rating} · {fmtNum(debtRatio(w.countries[r.iso]), 0, lang)}%</td></tr>)}</tbody></table>
      </Section>
    </div>
  );
}
