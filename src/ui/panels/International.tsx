import { useState, Fragment } from 'react';
import { useGame, Section, Prov, CName } from '../common';
import { fmtDate, fmtNum } from '../../i18n';
import { tradeView } from '../../sim/trade';

export function InternationalPanel() {
  const { w, t, lang, act, select, setPanel } = useGame();
  const me = w.player;
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState(''); const [kind, setKind] = useState<'economic' | 'military' | 'political'>('economic');
  const wars = w.wars.filter((x) => !x.ceasefire);
  return (
    <div>
      <Section title={t('dip.orgs')} right={<Prov tag={w.orgs[0]?.tag} />}>
        <table className="tbl click"><tbody>{w.orgs.map((o) => <Fragment key={o.id}>
          <tr key={o.id} onClick={() => setOpen(open === o.id ? null : o.id)}><td><b>{lang === 'fr' ? o.nameFr : o.name}</b> {o.custom && <span className="tag alt">{t('prov.simulated')}</span>}</td><td className="small muted">{o.kind}</td><td className="r">{o.members.length} {t('dip.members')}</td>
            <td className="r">{me && (o.members.includes(me) ? <button className="btn sm" onClick={(e) => { e.stopPropagation(); act({ type: 'leaveOrg', org: o.id }); }}>{t('dip.leave')}</button> : <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); act({ type: 'joinOrg', org: o.id }); }}>{t('dip.join')}</button>)}</td></tr>
          {open === o.id && <tr key={o.id + 'm'}><td colSpan={4} className="members">{o.members.map((m) => <button key={m} className="chip link" onClick={() => select(m)}>{w.countries[m]?.flag} {m}</button>)}</td></tr>}
        </Fragment>)}</tbody></table>
        {me && <div className="row"><input className="inp" placeholder={t('dip.orgName')} value={name} onChange={(e) => setName(e.target.value)} />
          <select className="sel" value={kind} onChange={(e) => setKind(e.target.value as any)}><option value="economic">economic</option><option value="military">military</option><option value="political">political</option></select>
          <button className="btn" disabled={!name.trim()} onClick={() => { act({ type: 'createOrg', name: name.trim(), kind, invite: (tradeView().partners[me] || []).slice(0, 8).map((p) => p.iso) }); setName(''); }}>{t('dip.create')} (40)</button></div>}
        {me && <p className="muted small">{t('dip.invite')}</p>}
      </Section>
      <Section title={t('mil.wars')}>
        {!wars.length && <p className="muted">{t('mil.noWars')}</p>}
        {wars.map((x) => <p key={x.id}>⚔ {x.attackers.map((a) => <CName key={a} iso={a} />)} {t('ui.vs')} {x.defenders.map((d) => <CName key={d} iso={d} />)} <small className="muted">{t('mil.since')} {fmtDate(w, Math.max(x.start, -999), lang)}</small> <button className="link" onClick={() => setPanel('military')}>→</button></p>)}
      </Section>
      <Section title={t('tr.sanctionsOut')}>
        <p className="small">{[...new Set(w.sanctions.map((s) => s.to))].map((to) => <span key={to} className="chip neg">{w.countries[to]?.flag} {lang === 'fr' ? w.countries[to]?.nameFr : w.countries[to]?.name} ← {w.sanctions.filter((s) => s.to === to).length}</span>)}</p>
      </Section>
      <Section title={lang === 'fr' ? 'Grandes puissances' : 'Great powers'}>
        <table className="tbl"><tbody>{Object.values(w.countries).filter((c) => c.alive).sort((a, b) => b.influence - a.influence).slice(0, 12).map((c) => <tr key={c.iso}><td><CName iso={c.iso} /></td><td className="r">{t('cd.influence')} {fmtNum(c.influence, 0, lang)}</td><td className="small muted">{t(c.ai.longGoal)}</td></tr>)}</tbody></table>
      </Section>
    </div>
  );
}
