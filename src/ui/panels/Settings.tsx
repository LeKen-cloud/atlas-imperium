import { useEffect, useState } from 'react';
import { useGame, Section } from '../common';
import { ping, aiStatus } from '../../ai/llm';
import { listSaves, loadGame, saveGame, deleteSave, renameSave, exportFile, importFile, SESSION_ID, type SaveMeta } from '../../save/save';
import { FEATURES } from '../../status';
import { WORLD } from '../../sim/geo';
import { bindWorld, fmtDate } from '../../i18n';
import { invalidate } from '../../sim/relations';
import { computeTrade } from '../../sim/trade';
import type { WorldState } from '../../sim/types';

export function SettingsPanel() {
  const { w, t, lang, ai, setAi, bump, toast } = useGame();
  const [saves, setSaves] = useState<SaveMeta[]>([]); const [name, setName] = useState(''); const [st, setSt] = useState(aiStatus());
  const refresh = () => listSaves().then((s) => setSaves(s.filter((x) => x.id !== SESSION_ID)));
  useEffect(() => { refresh(); }, []);
  const load = (n: WorldState | null) => { if (!n) return toast('Error', 'err'); for (const k of Object.keys(w)) delete (w as any)[k]; Object.assign(w, n); bindWorld(w); invalidate(); computeTrade(w); bump(); toast(t('st.loaded'), 'ok'); };
  return (
    <div>
      <Section title={t('st.ai')}>
        <label className="chk"><input type="checkbox" checked={ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} />{t('st.enabled')}</label>
        <div className="row">
          <select className="sel" value={ai.kind} onChange={(e) => setAi({ ...ai, kind: e.target.value as any, endpoint: e.target.value === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8080' })}><option value="ollama">Ollama</option><option value="openai">OpenAI-compatible (llama.cpp, vLLM, LM Studio)</option></select>
        </div>
        <label className="field">{t('st.endpoint')} <input className="inp" value={ai.endpoint} onChange={(e) => setAi({ ...ai, endpoint: e.target.value })} /></label>
        <label className="field">{t('st.model')} <input className="inp" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} list="models" />
          <datalist id="models"><option value="qwen3:8b" /><option value="qwen3:14b" /><option value="qwen3:4b" /><option value="mistral-small3.2" /><option value="gpt-oss:20b" /></datalist></label>
        <div className="row"><button className="btn" onClick={async () => { await ping(ai); setSt(aiStatus()); }}>{t('st.test')}</button><span>{t('st.aiStatus')}: <b className={st === 'online' ? 'pos' : 'neg'}>{st === 'online' ? t('st.online') : t('st.offline')}</b></span></div>
        <p className="muted small">{t('st.aiHelp')}</p>
        <label className="field">{t('st.avKey')} <input className="inp" type="password" value={ai.avKey || ''} onChange={(e) => setAi({ ...ai, avKey: e.target.value })} /></label>
      </Section>
      <Section title={t('st.saves')}>
        <div className="row"><input className="inp" placeholder={t('st.saveName')} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" onClick={async () => { await saveGame(w, name || fmtDate(w, w.t, lang)); setName(''); refresh(); toast(t('st.saved'), 'ok'); }}>{t('st.saveNow')}</button></div>
        <table className="tbl"><tbody>{saves.map((s) => <tr key={s.id}><td><b>{s.name}</b><br /><small className="muted">{new Date(s.date).toLocaleString(lang)} · {s.player || '—'} · {(s.size / 1e6).toFixed(1)} MB</small></td>
          <td className="r"><button className="btn sm primary" onClick={async () => load(await loadGame(s.id))}>{t('st.load')}</button>
            <button className="btn sm" onClick={async () => { const nm = (document.getElementById('rn-' + s.id) as HTMLInputElement)?.value; if (nm) { await renameSave(s.id, nm); refresh(); } }}>{t('st.rename')}</button>
            <input id={'rn-' + s.id} className="inp sm" placeholder={s.name} aria-label={t('st.rename')} />
            <button className="btn sm ghost" onClick={async () => { await deleteSave(s.id); refresh(); }}>{t('st.delete')}</button></td></tr>)}
          {!saves.length && <tr><td className="muted">{t('st.noSaves')}</td></tr>}</tbody></table>
        <div className="actions"><button className="btn" onClick={() => exportFile(w, 'atlas-' + (w.player || 'world') + '-' + w.t)}>{t('st.export')}</button>
          <label className="btn file">{t('st.importFile')}<input type="file" accept=".json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await importFile(f)); }} /></label></div>
        <label className="field">{t('st.autosave')} <select className="sel" value={w.settings.autosaveMonths} onChange={(e) => { w.settings.autosaveMonths = +e.target.value; bump(); }}>{[0, 3, 6, 12].map((m) => <option key={m} value={m}>{m || '—'}</option>)}</select></label>
        <p className="muted small">{t('st.storageWarn')}</p>
      </Section>
      <Section title={t('st.status')}>
        {FEATURES.map((g) => <div key={g.area}><h4>{g.area}</h4><ul className="status">{g.items.map(([txt, s, note]) => <li key={txt} className={'st-' + s}><span className="badge">{t('status.' + s)}</span> {txt}{note && <small className="muted"> — {note}</small>}</li>)}</ul></div>)}
      </Section>
      <Section title={t('st.sources')}>
        <ul className="small">{WORLD.meta.sources.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> — {s.license}</li>)}
          <li>Alpha Vantage — market snapshot (Brent, gold, FX), 2026-11-21</li><li>Reference estimates: EIU Democracy Index 2024 categories, SIPRI 2024, IMF WEO 2024 (debt) — labelled “Estimate”.</li></ul>
      </Section>
    </div>
  );
}
