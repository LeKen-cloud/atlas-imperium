import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorldState } from './sim/types';
import { tick } from './sim/engine';
import { perform, type Action } from './sim/actions';
import { newGame, SCENARIOS } from './sim/scenarios';
import { translate, bindWorld, fmtDate, type Lang } from './i18n';
import { Ctx, type Panel, type GameCtx } from './ui/common';
import { MapView } from './ui/MapView';
import { CountryCard } from './ui/CountryCard';
import { PanelHost, NAV } from './ui/panels';
import { PANEL_COLORS, CAT_COLORS, CAT_ICONS } from './ui/theme';
import type { NewsItem } from './sim/types';
import { NewsTicker } from './ui/NewsTicker';
import { MainMenu } from './ui/MainMenu';
import { loadAIConfig, saveAIConfig, ping, type AIConfig } from './ai/llm';
import { strategicRound } from './ai/agents';
import { saveGame, storeSession, SESSION_ID } from './save/save';
import { computeTrade } from './sim/trade';
import type { MapMode } from './ui/mapModes';

const SPEEDS = [0, 6000, 3000, 1500, 700, 250]; // ms per month
const pref = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const setPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (pref('atlas.lang', navigator.language?.startsWith('fr') ? 'fr' : 'en') as Lang));
  const [theme, setTheme] = useState(() => pref('atlas.theme', 'dark'));
  const wRef = useRef<WorldState | null>(null);
  const [v, setV] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [panel, setPanel] = useState<Panel>('none');
  const [panelWide, setPanelWide] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('political');
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const [ai, setAiState] = useState<AIConfig>(loadAIConfig);
  const [editor, setEditor] = useState({ on: false, owner: null as string | null, selection: [] as number[] });
  const [compare, setCompare] = useState<string[]>([]);
  const [day, setDay] = useState(0);
  const [breaking, setBreaking] = useState<NewsItem | null>(null);
  const seenNews = useRef<string>('');
  const bump = useCallback(() => setV((x) => x + 1), []);
  const t = useCallback((k: string, p?: Record<string, string | number>) => translate(lang, k, p), [lang]);
  const toast = useCallback((msg: string, kind: 'ok' | 'err' | 'info' = 'info') => { const id = Date.now() + Math.random(); setToasts((s) => [...s.slice(-3), { id, msg, kind }]); setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4200); }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; setPref('atlas.theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.lang = lang; setPref('atlas.lang', lang); }, [lang]);
  useEffect(() => { ping(ai); }, [ai]);

  const startWorld = useCallback((w: WorldState) => { wRef.current = w; bindWorld(w); computeTrade(w); setSelected(w.player); setPanel('none'); setSpeed(0); setV((x) => x + 1); }, []);

  // Simulation clock: days advance visually; the model steps monthly.
  useEffect(() => {
    if (!speed || !wRef.current) return;
    const ms = SPEEDS[speed] / 30;
    const id = setInterval(() => {
      const w = wRef.current; if (!w) return;
      w.day = (w.day + 1) % 30;
      if (w.day === 0) {
        const before = w.news[0]?.id; tick(w); bump();
        const freshNews: NewsItem[] = []; for (const n of w.news) { if (n.id === before) break; freshNews.push(n); }
        const big = freshNews.find((n) => n.severity >= 3 && n.cat !== 'meta' && (n.countries.includes(w.player || '') || n.countries.some((c) => (w.countries[c]?.econ.gdp || 0) > 8e5)));
        if (big && big.id !== seenNews.current) { seenNews.current = big.id; setBreaking(big); }
        if (ai.enabled && w.t % 2 === 0) strategicRound(w, ai).then(() => bump());
        if (w.settings.autosaveMonths && w.t % w.settings.autosaveMonths === 0) saveGame(w, 'Autosave', 'autosave');
        if (w.t % 3 === 0) storeSession(w);
        const fresh = w.player ? w.proposals.filter((p) => p.to === w.player && p.t === w.t - 1) : [];
        for (const p of fresh) toast('✉ ' + translate(lang, 'treaty.' + p.treaty) + ' — ' + (lang === 'fr' ? w.countries[p.from].nameFr : w.countries[p.from].name), 'info');
      }
      setDay(w.day);
    }, Math.max(8, ms));
    return () => clearInterval(id);
  }, [speed, ai, bump, t, toast, lang]);

  useEffect(() => {
    const h = () => { if (wRef.current && document.visibilityState === 'hidden') storeSession(wRef.current); };
    document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.code === 'Space') { e.preventDefault(); setSpeed((s) => (s ? 0 : 2)); }
      if (/^Digit[1-5]$/.test(e.code)) setSpeed(+e.code.slice(5));
      if (e.code === 'Escape') { setPanel('none'); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const w = wRef.current;
  const ctx: GameCtx | null = useMemo(() => w && ({
    w, v, lang, t, bump, selected, panel, mapMode, setMapMode, toast, ai, editor, setEditor, compare, setCompare,
    setAi: (c: AIConfig) => { setAiState(c); saveAIConfig(c); },
    select: (iso: string | null) => setSelected(iso),
    setPanel: (p: Panel) => setPanel(p),
    act: (a: Action, actor?: string) => {
      const who = actor || w.player; if (!who) { toast(t('err.observer'), 'err'); return { ok: false, key: 'err.observer' }; }
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
    setPlayer: (iso: string | null) => { w.player = iso; if (iso && !w.portfolio.cash && !w.portfolio.holdings.length) w.portfolio.cash = Math.round(w.countries[iso].econ.gdp * 0.02); bump(); },
  }), [w, v, lang, t, bump, selected, panel, mapMode, toast, ai, editor, compare]);

  if (!w || !ctx) return <MainMenu lang={lang} setLang={setLang} onStart={(scn, player) => startWorld(newGame(scn, player))} onLoad={startWorld} />;
  const P = w.player ? w.countries[w.player] : null;
  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <header className="top">
          <div className="brand" title={t('app.tagline')}><span className="logo" aria-hidden>◈</span><span className="bname">{t('app.name')}</span></div>
          <div className="clock">
            <span className="date">{fmtDate(w, w.t, lang, day)}</span>
            <div className="speeds" role="group" aria-label={t('top.speed')}>
              <button className={'btn sm ' + (speed === 0 ? 'on' : '')} onClick={() => setSpeed(0)} title={t('top.pause') + ' (Space)'}>❚❚</button>
              {[1, 2, 3, 4, 5].map((s) => <button key={s} className={'btn sm ' + (speed === s ? 'on' : '')} onClick={() => setSpeed(s)} title={t('top.speed') + ' ' + s}>{'▶'.repeat(Math.min(3, Math.ceil(s / 2)))}<sub>{s}</sub></button>)}
              <button className="btn sm" onClick={() => { tick(w); w.day = 0; setDay(0); bump(); }} title={t('top.advance')}>+1</button>
            </div>
          </div>
          <div className="who">
            {P ? <button className="btn ghost pchip" style={{ ['--pc' as any]: P.color }} onClick={() => { setSelected(P.iso); setPanel('government'); }}>{P.flag} {lang === 'fr' ? P.nameFr : P.name}</button> : <span className="muted">{t('top.observer')}</span>}
            <span className="scn muted">{lang === 'fr' && w.scenario !== 'custom' ? t('scn.' + w.scenario) : t('scn.' + w.scenario)}</span>
          </div>
          <div className="topr">
            <button className="btn sm" onClick={async () => { const m = await saveGame(w, (P?.name || 'World') + ' · ' + fmtDate(w, w.t, lang)); toast(m ? t('st.saved') : 'Error', m ? 'ok' : 'err'); }}>{t('top.save')}</button>
            <button className="btn sm" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} aria-label="Language">{lang === 'fr' ? 'EN' : 'FR'}</button>
            <button className="btn sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('top.theme')}>{theme === 'dark' ? '☀' : '☾'}</button>
            <button className="btn sm" onClick={() => { storeSession(w); wRef.current = null; setSpeed(0); setV((x) => x + 1); }}>{t('top.menu')}</button>
          </div>
        </header>
        <nav className="rail" aria-label="Interfaces">
          {NAV.map(([p, icon]) => <button key={p} style={{ ['--c' as any]: PANEL_COLORS[p] }} className={panel === p ? 'on' : ''} onClick={() => setPanel(panel === p ? 'none' : p)} title={t('nav.' + p)} aria-label={t('nav.' + p)}><span aria-hidden>{icon}</span><em>{t('nav.' + p)}</em></button>)}
        </nav>
        <main className="stage">
          <MapView />
          {selected && w.countries[selected] && <CountryCard iso={selected} />}
          {panel !== 'none' && <aside className={'drawer' + (panelWide ? ' wide' : '')} style={{ ['--c' as any]: PANEL_COLORS[panel] }}>
            <div className="drawer-h"><h2><span className="dh-ic" aria-hidden>{NAV.find((x) => x[0] === panel)?.[1]}</span>{t('nav.' + panel)}</h2><span>
              <button className="btn ghost sm" onClick={() => setPanelWide(!panelWide)}>{panelWide ? t('ui.collapse') : t('ui.expand')}</button>
              <button className="btn ghost sm" onClick={() => setPanel('none')} aria-label={t('ui.close')}>✕</button></span></div>
            <div className="drawer-b"><PanelHost panel={panel} /></div>
          </aside>}
          {editor.on && <div className="editor-banner">{t('ed.on')} <button className="btn sm" onClick={() => setEditor({ on: false, owner: null, selection: [] })}>{t('ed.done')}</button></div>}
        </main>
        <NewsTicker />
        {breaking && <div className="breaking" role="status" style={{ ['--c' as any]: CAT_COLORS[breaking.cat] || '#f87171' }} onAnimationEnd={(e) => { if (e.animationName === 'bkout') setBreaking(null); }}>
          <span className="bk-ic" aria-hidden>{CAT_ICONS[breaking.cat] || '◈'}</span>
          <div><b className="bk-l">{lang === 'fr' ? 'Flash info' : 'Breaking'} · {t('cat.' + breaking.cat)} · {fmtDate(w, breaking.t, lang)}</b><p>{t(breaking.key, breaking.params)}</p></div>
          <button className="btn sm" onClick={() => { setPanel('news'); if (breaking.link) ctx?.focus(breaking.link); setBreaking(null); }}>{t('news.goTo')}</button>
          <button className="btn ghost sm" aria-label={t('ui.close')} onClick={() => setBreaking(null)}>✕</button>
        </div>}
        <div className="toasts" aria-live="polite">{toasts.map((x) => <div key={x.id} className={'toast ' + x.kind}>{x.msg}</div>)}</div>
      </div>
    </Ctx.Provider>
  );
}
void SCENARIOS; void SESSION_ID;
