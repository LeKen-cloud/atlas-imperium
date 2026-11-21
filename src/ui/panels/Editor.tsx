import { useState } from 'react';
import { useGame, Section, CountryPicker, Slider } from '../common';
import { editorCreateCountry, setGovType } from '../../sim/scenarios';
import { GOV_TYPES, type WorldState } from '../../sim/types';
import { addRel, getRel, invalidate } from '../../sim/relations';
import { exportFile, importFile } from '../../save/save';
import { fmtNum } from '../../i18n';
import { bindWorld } from '../../i18n';

export function EditorPanel() {
  const { w, t, lang, editor, setEditor, bump, selected, toast } = useGame();
  const [name, setName] = useState(''); const [a, setA] = useState<string | null>(selected); const [b, setB] = useState<string | null>(null);
  const C = selected ? w.countries[selected] : null;
  const loadInto = (n: WorldState) => { Object.assign(w, n); bindWorld(w); invalidate(); bump(); toast(t('st.loaded'), 'ok'); };
  return (
    <div>
      <Section title={t('ed.paint')}>
        <p className="muted small">{t('ed.paintHint')}</p>
        <div className="row"><CountryPicker value={editor.owner} onChange={(iso) => setEditor({ on: true, owner: iso || null, selection: [] })} placeholder={t('ed.owner')} />
          <button className={'btn sm ' + (editor.on && !editor.owner ? 'on' : '')} onClick={() => setEditor({ on: true, owner: null, selection: editor.selection })}>{t('ed.selection')}</button>
          {editor.on && <button className="btn sm" onClick={() => setEditor({ on: false, owner: null, selection: [] })}>{t('ed.done')}</button>}</div>
        {editor.selection.length > 0 && <>
          <p>{t('ed.selection')}: {editor.selection.map((i) => w.territories[i].name).join(', ')} <button className="btn sm ghost" onClick={() => setEditor({ ...editor, selection: [] })}>{t('ed.clear')}</button></p>
          <div className="row"><input className="inp" placeholder={t('ed.name')} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary" disabled={!name.trim()} onClick={() => { const iso = editorCreateCountry(w, editor.selection, name.trim()); setEditor({ on: true, owner: null, selection: [] }); setName(''); bump(); toast(name + ' (' + iso + ')', 'ok'); }}>{t('ed.newCountry')}</button></div>
        </>}
      </Section>
      {C && selected && <Section title={(lang === 'fr' ? C.nameFr : C.name) + ' — ' + t('ed.govType')}>
        <select className="sel" value={C.gov.type} onChange={(e) => { setGovType(w, selected, e.target.value as any); w.diverged = true; bump(); }}>{GOV_TYPES.map((g) => <option key={g} value={g}>{t('gov.' + g)}</option>)}</select>
        <h4>{t('ed.economy')}</h4>
        <Slider label={t('cd.gdp') + ' ($B)'} value={Math.round(C.econ.gdp / 1000)} min={1} max={60000} step={1} fmt={(v) => fmtNum(v, 0, lang)} onCommit={(v) => { const r = (v * 1000) / C.econ.gdp; C.econ.gdp *= r; C.econ.debt *= r; C.econ.tradeK = 0; w.diverged = true; bump(); }} />
        <Slider label={t('cd.debt') + ' %'} value={Math.round((C.econ.debt / C.econ.gdp) * 100)} min={0} max={300} step={1} onCommit={(v) => { C.econ.debt = (v / 100) * C.econ.gdp; w.diverged = true; bump(); }} />
        <Slider label={t('cd.stability')} value={Math.round(C.gov.stability)} min={0} max={100} step={1} onCommit={(v) => { C.gov.stability = v; w.diverged = true; bump(); }} />
        <Slider label={t('mil.budget') + ' %'} value={C.policy.spending.defense} min={0} max={20} step={0.1} onCommit={(v) => { C.policy.spending.defense = v; w.diverged = true; bump(); }} />
        <label className="field">{t('ed.name')} <input className="inp" defaultValue={lang === 'fr' ? C.nameFr : C.name} onBlur={(e) => { if (lang === 'fr') C.nameFr = e.target.value; else C.name = e.target.value; bump(); }} /></label>
        <label className="field">Color <input type="color" defaultValue="#4c78a8" onChange={(e) => { C.color = e.target.value; bump(); }} /></label>
        <h4>{t('ed.orgs')}</h4>
        <div className="chips">{w.orgs.filter((o) => o.id !== 'UN').map((o) => <label key={o.id} className="chk"><input type="checkbox" checked={o.members.includes(selected)} onChange={(e) => { o.members = e.target.checked ? [...o.members, selected] : o.members.filter((m) => m !== selected); invalidate(); w.diverged = true; bump(); }} />{o.id}</label>)}</div>
      </Section>}
      <Section title={t('ed.relations')}>
        <div className="row"><CountryPicker value={a} onChange={setA} /><CountryPicker value={b} onChange={setB} /></div>
        {a && b && <Slider label={t('cd.relations')} value={Math.round(getRel(w, a, b))} min={-100} max={100} step={5} onCommit={(v) => { addRel(w, a, b, v - getRel(w, a, b)); w.diverged = true; bump(); }} />}
      </Section>
      <Section title={t('ed.export') + ' / ' + t('ed.import')}>
        <div className="actions">
          <button className="btn" onClick={() => exportFile(w, 'scenario-' + w.scenario + '-' + w.t)}>{t('ed.export')}</button>
          <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(w)); toast(t('ed.copied'), 'ok'); } catch { toast('Clipboard blocked', 'err'); } }}>{t('ed.copy')}</button>
          <label className="btn file">{t('ed.import')}<input type="file" accept=".json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const n = await importFile(f); if (n) loadInto(n); } }} /></label>
        </div>
      </Section>
    </div>
  );
}
