import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TurnReport, WorldState } from './sim/types';
import { perform, type Action } from './sim/actions';
import { newGame } from './sim/scenarios';
import { translate, bindWorld, fmtDate, cname, type Lang } from './i18n';
import { Ctx, type Panel, type GameCtx } from './ui/common';
import { MapView } from './ui/MapView';
import { CountryCard } from './ui/CountryCard';
import { PanelHost, NAV } from './ui/panels';
import { PANEL_COLORS } from './ui/theme';
import { NewsTicker } from './ui/NewsTicker';
import { MainMenu } from './ui/MainMenu';
import { TurnBar, OrdersTray, ReportModal } from './ui/Turn';
import { loadAIConfig, saveAIConfig, ping, type AIConfig } from './ai/llm';
import { strategicRound, writeChronicle } from './ai/agents';
import { saveGame, storeSession, validate } from './save/save';
import { computeTrade } from './sim/trade';
import { invalidate } from './sim/relations';
import { endTurn, isMajor, queueOrder } from './sim/turn';
import type { MapMode } from './ui/mapModes';

const pref = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const setPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const MAX_SNAPSHOTS = 10;

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (pref('atlas.lang', navigator.language?.startsWith('fr') ? 'fr' : 'en') as Lang));
  const [theme, setTheme] = useState(() => pref('atlas.theme', 'dark'));
  const wRef = useRef<WorldState | null>(null);
  const [v, setV] = useState(0);
  const [panel, setPanel] = useState<Panel>('none');
  const [panelWide, setPanelWide] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('political');
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const [ai, setAiState] = useState<AIConfig>(loadAIConfig);
  const [editor, setEditor] = useState({ on: false, owner: null as string | null, selection: [] as number[] });
  const [compare, setCompare] = useState<string[]>([]);
  const [busy, setBusy] = useState<{ i: number; n: number } | null>(null);
  const [report, setReport] = useState<TurnReport | null>(null);
  const [highlights, setHighlights] = useState<number[]>([]);
  // Rewind: snapshots of the world at the start of recent turns (kept in memory)
  const snaps = useRef<{ n: number; t: number; json: string }[]>([]);
  const bump = useCallback(() => setV((x) => x + 1), []);
  const t = useCallback((k: string, p?: Record<string, string | number>) => translate(lang, k, p), [lang]);
  const toast = useCallback((msg: string, kind: 'ok' | 'err' | 'info' = 'info') => { const id = Date.now() + Math.random(); setToasts((s) => [...s.slice(-3), { id, msg, kind }]); setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4200); }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; setPref('atlas.theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.lang = lang; setPref('atlas.lang', lang); }, [lang]);
  useEffect(() => { ping(ai); }, [ai]);

  const startWorld = useCallback((w: WorldState) => {
    wRef.current = w; bindWorld(w); invalidate(); computeTrade(w); setSelected(w.player); setPanel('none'); setReport(null); setHighlights([]);
    snaps.current = []; setV((x) => x + 1);
  }, []);

  const doEndTurn = useCallback(async () => {
    const w = wRef.current; if (!w || busy) return;
    snaps.current.push({ n: w.turn.n, t: w.t, json: JSON.stringify(w) });
    if (snaps.current.length > MAX_SNAPSHOTS) snaps.current.shift();
    setBusy({ i: 0, n: w.turn.jump });
    const r = await endTurn(w, { onMonth: async (i, n) => { setBusy({ i, n }); await new Promise((res) => setTimeout(res, 0)); } });
    setBusy(null); setHighlights(r.borders.map((b) => b.t)); setReport(r); bump();
    storeSession(w);
    if (w.settings.autosaveMonths && Math.floor(r.from / w.settings.autosaveMonths) !== Math.floor(r.to / w.settings.autosaveMonths)) saveGame(w, 'Autosave', 'autosave');
    if (ai.enabled) {
      writeChronicle(w, r, ai, lang, (k, p) => translate(lang, k, p)).then((txt) => { if (txt) { r.narrative = txt; r.narrativeProv = 'ai'; bump(); } });
      strategicRound(w, ai).then(() => bump());
    }
  }, [busy, ai, lang, bump]);

  const rewind = useCallback((n: number) => {
    const s = snaps.current.find((x) => x.n === n); if (!s) return false;
    const w = validate(JSON.parse(s.json)); if (!w) return false;
    snaps.current = snaps.current.filter((x) => x.n < n);
    startWorld(w); toast(t('turn.rewindTo') + ' → ' + t('turn.label', { n }), 'ok');
    return true;
  }, [startWorld, toast, t]);

  useEffect(() => {
    const h = () => { if (wRef.current && document.visibilityState === 'hidden') storeSession(wRef.current); };
    document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.code === 'Escape') { if (report) setReport(null); else setPanel('none'); }
      if (e.code === 'Enter' && (e.ctrlKey || e.metaKey) && wRef.current && !report) doEndTurn();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [report, doEndTurn]);

  const w = wRef.current;
  const ctx: GameCtx | null = useMemo(() => w && ({
    w, v, lang, t, bump, selected, panel, mapMode, setMapMode, toast, ai, editor, setEditor, compare, setCompare, highlights,
    setAi: (c: AIConfig) => { setAiState(c); saveAIConfig(c); },
    select: (iso: string | null) => setSelected(iso),
    setPanel: (p: Panel) => setPanel(p),
    act: (a: Action, actor?: string) => {
      const who = actor || w.player; if (!who) { toast(t('err.observer'), 'err'); return { ok: false, key: 'err.observer' }; }
      // Major actions by the player use an order slot and resolve when the turn ends (PAX-style)
      if (!actor && isMajor(a)) {
        const o = queueOrder(w, { actions: [a], source: 'ui', summary: t('act.' + a.type) + ('target' in a ? ' → ' + cname((a as any).target, lang, w) : '') + ('treaty' in a ? ' (' + t('treaty.' + (a as any).treaty) + ')' : '') });
        bump();
        if (!o) { toast(t('turn.full'), 'err'); return { ok: false, key: 'turn.full' }; }
        toast(t('ok.queued', { u: w.turn.orders.length, m: w.turn.maxOrders }), 'ok');
        return { ok: true, key: 'ok.queued' };
      }
      const r = perform(w, who, a); bump();
      toast(t(r.key, r.params) + (r.reasons?.length ? ' — ' + r.reasons.map((x) => t(x)).join(', ') : ''), r.ok ? (r.accepted === false ? 'info' : 'ok') : 'err');
      return r;
    },
    focus: (target: { kind: string; id: string }) => {
      if (target.kind === 'country') { setSelected(target.id); (window as any).__atlasZoomTo?.(target.id); }
      if (target.kind === 'company') setPanel('corporate');
      if (target.kind === 'market') setPanel('markets');
      if (target.kind === 'war') setPanel('military');
      if (target.kind === 'org') setPanel('diplomacy');
    },
    setPlayer: (iso: string | null) => { w.player = iso; if (iso && !w.portfolio.cash && !w.portfolio.holdings.length) w.portfolio.cash = Math.round(w.countries[iso].econ.gdp * 0.02); w.turn.orders = []; bump(); },
    endTurn: doEndTurn, busy: !!busy, rewind, snapshots: snaps.current.map((s) => s.n), openReport: (r: TurnReport) => setReport(r),
  }), [w, v, lang, t, bump, selected, panel, mapMode, toast, ai, editor, compare, highlights, doEndTurn, busy, rewind]);

  if (!w || !ctx) return <MainMenu lang={lang} setLang={setLang} onStart={(scn, player) => startWorld(newGame(scn, player))} onLoad={startWorld} />;
  const P = w.player ? w.countries[w.player] : null;
  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <header className="top">
          <div className="brand" title={t('app.tagline')}><span className="logo" aria-hidden>◈</span><span className="bname">{t('app.name')}</span></div>
          <TurnBar />
          <div className="who">
            {P ? <button className="btn ghost pchip" style={{ ['--pc' as any]: P.color }} onClick={() => { setSelected(P.iso); setPanel('government'); }}>{P.flag} {lang === 'fr' ? P.nameFr : P.name}</button> : <span className="muted">{t('top.observer')}</span>}
          </div>
          <div className="topr">
            <button className="btn sm" onClick={async () => { const m = await saveGame(w, (P?.name || 'World') + ' · ' + fmtDate(w, w.t, lang)); toast(m ? t('st.saved') : 'Error', m ? 'ok' : 'err'); }}>{t('top.save')}</button>
            <button className="btn sm" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} aria-label="Language">{lang === 'fr' ? 'EN' : 'FR'}</button>
            <button className="btn sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('top.theme')}>{theme === 'dark' ? '☀' : '☾'}</button>
            <button className="btn sm" onClick={() => { storeSession(w); wRef.current = null; setV((x) => x + 1); }}>{t('top.menu')}</button>
          </div>
        </header>
        <nav className="rail" aria-label="Interfaces">
          {NAV.map(([p, icon]) => <button key={p} style={{ ['--c' as any]: PANEL_COLORS[p] }} className={panel === p ? 'on' : ''} onClick={() => setPanel(panel === p ? 'none' : p)} title={t('nav.' + p)} aria-label={t('nav.' + p)}><span aria-hidden>{icon}</span><em>{t('nav.' + p)}</em></button>)}
        </nav>
        <main className="stage">
          <MapView />
          {selected && w.countries[selected] && <CountryCard iso={selected} />}
          <OrdersTray />
          {panel !== 'none' && <aside className={'drawer' + (panelWide ? ' wide' : '')} style={{ ['--c' as any]: PANEL_COLORS[panel] }}>
            <div className="drawer-h"><h2><span className="dh-ic" aria-hidden>{NAV.find((x) => x[0] === panel)?.[1]}</span>{t('nav.' + panel)}</h2><span>
              <button className="btn ghost sm" onClick={() => setPanelWide(!panelWide)}>{panelWide ? t('ui.collapse') : t('ui.expand')}</button>
              <button className="btn ghost sm" onClick={() => setPanel('none')} aria-label={t('ui.close')}>✕</button></span></div>
            <div className="drawer-b"><PanelHost panel={panel} /></div>
          </aside>}
          {editor.on && <div className="editor-banner">{t('ed.on')} <button className="btn sm" onClick={() => setEditor({ on: false, owner: null, selection: [] })}>{t('ed.done')}</button></div>}
          {busy && <div className="simulating" role="status"><div className="sim-box"><div className="globe" aria-hidden>◈</div><b>{t('turn.simulating', { i: busy.i, n: busy.n })}</b><div className="sim-bar"><span style={{ width: (busy.i / busy.n) * 100 + '%' }} /></div></div></div>}
        </main>
        <NewsTicker />
        {report && <ReportModal report={report} onClose={() => setReport(null)} />}
        <div className="toasts" aria-live="polite">{toasts.map((x) => <div key={x.id} className={'toast ' + x.kind}>{x.msg}</div>)}</div>
      </div>
    </Ctx.Provider>
  );
}
