import { useEffect, useRef, useState } from 'react';
import { useGame, Section, Prov, Stat, CName, CountryPicker } from '../common';
import { fmtDate, fmtNum, fmtMoney } from '../../i18n';
import { getRel, trust, hasTreaty, sanctionLevel, atWar, allies, militaryScore } from '../../sim/relations';
import { evaluateProposal } from '../../sim/actions';
import type { TreatyType } from '../../sim/types';
import { diplomatReply } from '../../ai/agents';
import { aiStatus } from '../../ai/llm';
import { InboxList } from './Government';
import { exposure } from '../../sim/trade';

const TREATIES: TreatyType[] = ['fta', 'alliance', 'defense', 'nap', 'investment', 'tech'];

export function DiplomacyPanel() {
  const { w, t, lang, selected, act, ai, bump } = useGame();
  const me = w.player;
  const [target, setTarget] = useState<string | null>(selected && selected !== me ? selected : null);
  const [confirmWar, setConfirmWar] = useState(false);
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [aid, setAid] = useState(500); const [lvl, setLvl] = useState(2);
  const [mediateB, setMediateB] = useState<string | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected && selected !== me) setTarget(selected); }, [selected, me]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); });
  if (!me) return <p className="muted">{t('err.observer')}</p>;
  const T = target ? w.countries[target] : null;
  const chat = target ? (w.chats[target] ||= []) : [];
  const send = async () => {
    if (!target || !msg.trim()) return; const text = msg; setMsg(''); setBusy(true);
    chat.push({ role: 'player', text, t: w.t, prov: 'simulated' }); bump();
    const r = await diplomatReply(w, me, target, text, ai, lang);
    chat.push({ role: 'them', text: r.text, t: w.t, prov: r.prov }); if (chat.length > 60) chat.splice(0, chat.length - 60);
    setBusy(false); bump();
  };
  return (
    <div>
      <Section title={t('dip.inbox')}><InboxList /></Section>
      <div className="row"><CountryPicker value={target} onChange={setTarget} exclude={[me]} placeholder={t('dip.target')} /><span className="muted small">{t('dip.points')}: {fmtNum(w.countries[me].diploPoints, 0, lang)}</span></div>
      {!T && <p className="muted">{t('dip.choose')}</p>}
      {T && target && <>
        <div className="stats g4">
          <Stat label={t('cd.relations')} value={<span className={getRel(w, me, target) >= 0 ? 'pos' : 'neg'}>{fmtNum(getRel(w, me, target), 0, lang)}</span>} p="simulated" />
          <Stat label={t('dip.trust')} value={fmtNum(trust(w, target, me), 0, lang)} p="simulated" />
          <Stat label={t('cd.government')} value={t('gov.' + T.gov.type)} />
          <Stat label={t('cd.military')} value={fmtNum(militaryScore(w, target), 0, lang)} sub={T.mil.nuclear ? '☢' : ''} />
          <Stat label={t('tr.dependency')} value={(exposure(me, target) * 100).toFixed(1) + '%'} />
          <Stat label={t('mil.allies')} value={allies(w, target).length} />
        </div>
        <Section title={t('dip.treaties')}>
          <table className="tbl"><tbody>{TREATIES.map((k) => { const has = hasTreaty(w, me, target, k); const ev = evaluateProposal(w, me, target, k); return (
            <tr key={k}><td>{t('treaty.' + k)}</td><td className="small muted">{has ? '✓' : ev.score > 0 ? '↑ ' + (lang === 'fr' ? 'probable' : 'likely') : '↓ ' + (lang === 'fr' ? 'improbable' : 'unlikely')}{ev.reasons.length ? ' · ' + ev.reasons.slice(0, 2).map((x) => t(x)).join(', ') : ''}</td>
              <td className="r">{has ? <button className="btn sm" onClick={() => act({ type: 'cancelTreaty', target, treaty: k })}>{t('dip.cancel')}</button> : <button className="btn sm primary" onClick={() => act({ type: 'proposeTreaty', target, treaty: k })}>{t('dip.propose')}</button>}</td></tr>); })}</tbody></table>
        </Section>
        <Section title={lang === 'fr' ? 'Actions' : 'Actions'}>
          <div className="actions">
            <button className="btn sm" onClick={() => act({ type: 'improveRelations', target })}>{t('dip.improve')} (10)</button>
            <button className="btn sm" onClick={() => act({ type: 'denounce', target })}>{t('dip.denounce')}</button>
            {sanctionLevel(w, me, target) ? <button className="btn sm" onClick={() => act({ type: 'liftSanctions', target })}>{t('dip.lift')}</button> :
              <span className="inline"><select className="sel sm" value={lvl} onChange={(e) => setLvl(+e.target.value)} aria-label={t('dip.level')}>{[1, 2, 3].map((x) => <option key={x} value={x}>{x}</option>)}</select><button className="btn sm" onClick={() => act({ type: 'sanction', target, level: lvl })}>{t('dip.sanction')}</button></span>}
            <span className="inline"><input className="inp sm" type="number" value={aid} onChange={(e) => setAid(+e.target.value)} aria-label="$M" /><button className="btn sm" onClick={() => act({ type: 'foreignAid', target, amount: aid })}>{t('dip.aid')} ({fmtMoney(aid, lang)})</button></span>
          </div>
          <div className="actions">
            {atWar(w, me, target) ? (['white', 'ceasefire', 'cede'] as const).map((k) => <button key={k} className="btn sm" onClick={() => act({ type: 'proposePeace', target, terms: k })}>{t('dip.peace')}: {t('treaty.peace_' + k)}</button>)
              : confirmWar ? <span className="confirm">{t('dip.warConfirm')} <button className="btn sm danger" onClick={() => { act({ type: 'declareWar', target }); setConfirmWar(false); }}>{t('dip.confirm')}</button><button className="btn sm" onClick={() => setConfirmWar(false)}>{t('dip.cancelBtn')}</button></span>
              : <button className="btn sm danger" onClick={() => setConfirmWar(true)}>{t('dip.war')}</button>}
          </div>
          <div className="actions"><span className="muted small">{t('dip.mediate')}</span> <CountryPicker value={mediateB} onChange={setMediateB} exclude={[me, target]} /><button className="btn sm" disabled={!mediateB} onClick={() => mediateB && act({ type: 'mediate', a: target, b: mediateB })}>{t('dip.mediate')} (20)</button></div>
        </Section>
        <Section title={t('dip.chat')} right={<Prov p={aiStatus() === 'online' ? 'ai' : 'simulated'} />}>
          {aiStatus() !== 'online' && <p className="muted small">{t('dip.aiOffline')}</p>}
          <div className="chat">{chat.map((m, i) => <div key={i} className={'msg ' + m.role}><small>{m.role === 'player' ? t('ui.you') : T.flag + ' ' + (lang === 'fr' ? T.nameFr : T.name)} · {fmtDate(w, m.t, lang)} {m.role === 'them' && <Prov p={m.prov} compact />}</small><p>{m.text}</p></div>)}
            {busy && <div className="msg them"><p className="muted">{t('dip.thinking')}</p></div>}<div ref={chatEnd} /></div>
          <div className="row"><input className="inp" value={msg} placeholder={t('dip.chatPlaceholder')} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} /><button className="btn primary" disabled={busy} onClick={send}>{t('dip.send')}</button></div>
        </Section>
        <Section title={t('dip.memory')}>
          <ul className="mem">{T.ai.memory.filter((m) => m.with === me).slice(-10).reverse().map((m, i) => <li key={i}><span className={m.delta >= 0 ? 'pos' : 'neg'}>{m.delta >= 0 ? '+' : ''}{m.delta}</span> {m.kind.replace(/_/g, ' ')} <small className="muted">{fmtDate(w, m.t, lang)}</small></li>)}
            {!T.ai.memory.some((m) => m.with === me) && <li className="muted">—</li>}</ul>
          <p className="muted small">{t('gv.goals')}: {T.ai.goals.map((x) => t(x)).join(', ')}</p>
        </Section>
      </>}
      <p className="muted small"><CName iso={me} /> · {t('dip.points')} +{fmtNum(1.5 + w.countries[me].influence / 25, 1, lang)}/{t('top.month')}</p>
    </div>
  );
}
