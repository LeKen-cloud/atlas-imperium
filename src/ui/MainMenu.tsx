import { useEffect, useMemo, useState } from 'react';
import type { WorldState } from '../sim/types';
import { SCENARIOS, buildScenario } from '../sim/scenarios';
import { startWorld as initPlayer } from '../sim/init';
import { translate, bindWorld, fmtMoney, fmtPop, type Lang } from '../i18n';
import { listSaves, loadGame, deleteSave, importFile, SESSION_ID, type SaveMeta } from '../save/save';
import { WORLD } from '../sim/geo';
import { BUILD_DATE } from '../data/reference';
import { WorldBackdrop } from './MapView';

export function MainMenu({ lang, setLang, onStart, onLoad }: { lang: Lang; setLang: (l: Lang) => void; onStart: (scn: string, player: string | null) => void; onLoad: (w: WorldState) => void }) {
  const t = (k: string, p?: Record<string, string | number>) => translate(lang, k, p);
  const [scn, setScn] = useState('contemporary');
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<string | null>('FRA');
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => { const w = buildScenario(scn); bindWorld(w); return w; }, [scn]);
  useEffect(() => { listSaves().then(setSaves); }, []);
  const session = saves.find((s) => s.id === SESSION_ID);
  const list = Object.values(preview.countries).filter((c) => c.alive && c.iso !== 'ATA' && (!q || (c.name + ' ' + c.nameFr + ' ' + c.iso).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.econ.gdp - a.econ.gdp);
  const start = () => { setBusy(true); setTimeout(() => { onLoad(initPlayer(preview, pick)); }, 30); };
  const sel = pick ? preview.countries[pick] : null;
  void onStart;
  return (
    <div className="menu">
      <div className="menu-bg" aria-hidden><WorldBackdrop w={preview} /></div>
      <div className="menu-in">
        <header className="menu-h">
          <div><h1><span className="logo">◈</span> <span className="title-grad">{t('app.name')}</span></h1><p className="lead">{t('app.tagline')}</p></div>
          <button className="btn" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}>{lang === 'fr' ? 'English' : 'Français'}</button>
        </header>
        {session && <div className="recover"><span>{t('menu.recovered')} <b>{session.player || t('top.observer')}</b> · {session.scenario}</span>
          <button className="btn primary" onClick={async () => { const w = await loadGame(SESSION_ID); if (w) onLoad(w); }}>{t('menu.recover')}</button></div>}
        <div className="menu-grid">
          <section className="card">
            <h2>{t('menu.chooseScenario')}</h2>
            <ul className="scn-list">
              {SCENARIOS.map((s) => (
                <li key={s.id}><button disabled={s.status === 'planned'} className={'scn-btn' + (scn === s.id ? ' on' : '')} onClick={() => setScn(s.id)}>
                  <b>{t('scn.' + s.id)}</b>{s.status === 'planned' ? <span className="tag">{t('menu.planned')}</span> : s.status === 'alt' ? <span className="tag alt">{t('prov.simulated')}</span> : <span className="tag real">{t('prov.verified')}</span>}
                  <small>{s.status === 'planned' ? t('scn.plannedNote') : t('scn.' + s.id + '.d')}</small>
                </button></li>
              ))}
            </ul>
            <p className="muted small">{t('menu.dataNote', { d: BUILD_DATE })}</p>
          </section>
          <section className="card">
            <h2>{t('menu.chooseCountry')}</h2>
            <input className="inp" placeholder={t('menu.searchCountry')} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="clist" role="listbox">
              <button className={'crow' + (pick === null ? ' on' : '')} onClick={() => setPick(null)}><span className="fl">👁</span><span>{t('menu.observer')}</span></button>
              {list.map((c) => (
                <button key={c.iso} role="option" aria-selected={pick === c.iso} className={'crow' + (pick === c.iso ? ' on' : '')} onClick={() => setPick(c.iso)}>
                  <span className="fl">{c.flag}</span><span><i className="swatch" style={{ background: c.color }} />{lang === 'fr' ? c.nameFr : c.name}</span><span className="num">{fmtMoney(c.econ.gdp, lang)}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="card brief" style={sel ? { ['--cc' as any]: sel.color } : undefined}>
            {sel ? <>
              <h2>{sel.flag} {lang === 'fr' ? sel.nameFr : sel.name}</h2>
              <dl className="kv">
                <dt>{t('cd.capital')}</dt><dd>{sel.capital || '—'}</dd>
                <dt>{t('cd.government')}</dt><dd>{t('gov.' + sel.gov.type)}</dd>
                <dt>{t('cd.population')}</dt><dd>{fmtPop(sel.soc.pop, lang)}</dd>
                <dt>{t('cd.gdp')}</dt><dd>{fmtMoney(sel.econ.gdp, lang)} <span className={'prov prov-' + sel.tags.gdp.prov}>{t('prov.' + sel.tags.gdp.prov)}</span></dd>
                <dt>{t('cd.currency')}</dt><dd>{sel.currencyName || sel.currency}</dd>
                <dt>{t('cd.region')}</dt><dd>{sel.subregion || sel.region}</dd>
              </dl>
              <p className="muted small">{sel.tags.gdp.src} {sel.tags.gdp.date}</p>
            </> : <><h2>👁 {t('menu.observer')}</h2><p className="muted">{t('gv.observerNote')}</p></>}
            <button className="btn primary big" disabled={busy} onClick={start}>{busy ? '…' : t('menu.start')}</button>
            {saves.filter((s) => s.id !== SESSION_ID).length > 0 && <>
              <h3>{t('st.saves')}</h3>
              <ul className="saves">{saves.filter((s) => s.id !== SESSION_ID).slice(0, 6).map((s) => <li key={s.id}>
                <button className="link" onClick={async () => { const w = await loadGame(s.id); if (w) onLoad(w); }}>{s.name}</button>
                <small className="muted">{new Date(s.date).toLocaleString(lang)}</small>
                <button className="btn ghost sm" onClick={async () => { await deleteSave(s.id); setSaves(await listSaves()); }} aria-label={t('st.delete')}>✕</button></li>)}</ul></>}
            <label className="btn ghost file">{t('st.importFile')}<input type="file" accept=".json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const w = await importFile(f); if (w) onLoad(w); } }} /></label>
          </section>
        </div>
        <footer className="muted small">{WORLD.meta.sources.map((s) => s.name).join(' · ')}</footer>
      </div>
    </div>
  );
}
