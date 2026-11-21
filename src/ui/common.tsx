import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Prov as ProvT, Tag, WorldState } from '../sim/types';
import type { Lang } from '../i18n';
import type { Action, Result } from '../sim/actions';
import type { AIConfig } from '../ai/llm';
import type { MapMode } from './mapModes';

export type Panel = 'none' | 'government' | 'internal' | 'international' | 'economy' | 'markets' | 'corporate' | 'trade' | 'diplomacy' | 'military' | 'society' | 'news' | 'timeline' | 'intel' | 'editor' | 'settings' | 'realworld' | 'compare';
export interface GameCtx {
  w: WorldState; v: number; lang: Lang; t: (k: string, p?: Record<string, string | number>) => string;
  act: (a: Action, actor?: string) => Result; bump: () => void;
  selected: string | null; select: (iso: string | null) => void; panel: Panel; setPanel: (p: Panel) => void;
  mapMode: MapMode; setMapMode: (m: MapMode) => void; toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
  ai: AIConfig; setAi: (c: AIConfig) => void; focus: (target: { kind: string; id: string }) => void;
  editor: { on: boolean; owner: string | null; selection: number[] }; setEditor: (e: { on: boolean; owner: string | null; selection: number[] }) => void;
  setPlayer: (iso: string | null) => void; compare: string[]; setCompare: (c: string[]) => void;
}
export const Ctx = createContext<GameCtx>(null as any);
export const useGame = () => useContext(Ctx);

export function Prov({ p, tag, compact }: { p?: ProvT; tag?: Tag; compact?: boolean }) {
  const { t } = useGame();
  const prov = tag?.prov || p || 'simulated';
  const title = [t('prov.' + prov), tag?.src, tag?.date].filter(Boolean).join(' · ');
  return <span className={'prov prov-' + prov} title={title} aria-label={title}>{compact ? t('prov.' + prov)[0] : t('prov.' + prov)}</span>;
}

export function Stat({ label, value, tag, p, sub, trend, tone }: { label: string; value: ReactNode; tag?: Tag; p?: ProvT; sub?: ReactNode; trend?: number; tone?: 'good' | 'bad' | 'warn' | null }) {
  return (
    <div className="stat">
      <div className="stat-l">{label} {(tag || p) && <Prov tag={tag} p={p} compact />}</div>
      <div className={'stat-v' + (tone ? ' t-' + tone : '')}>{value}{trend !== undefined && isFinite(trend) && Math.abs(trend) > 0.0001 && <span className={'trend ' + (trend > 0 ? 'up' : 'down')}>{trend > 0 ? '▲' : '▼'}</span>}</div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  );
}

export function Section({ title, children, right, id }: { title: ReactNode; children: ReactNode; right?: ReactNode; id?: string }) {
  return <section className="sec" id={id}><header><h3>{title}</h3>{right}</header>{children}</section>;
}

export function Slider({ label, value, min, max, step, onCommit, fmt, disabled, hint }: { label: string; value: number; min: number; max: number; step: number; onCommit: (v: number) => void; fmt?: (v: number) => string; disabled?: boolean; hint?: string }) {
  const [v, setV] = useState(value);
  const dragging = useRef(false);
  useEffect(() => { if (!dragging.current) setV(value); }, [value]);
  return (
    <label className={'slider' + (disabled ? ' dis' : '')} title={hint}>
      <span className="sl-l">{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} disabled={disabled}
        onPointerDown={() => (dragging.current = true)}
        onChange={(e) => setV(parseFloat(e.target.value))}
        onPointerUp={() => { dragging.current = false; if (v !== value) onCommit(v); }}
        onKeyUp={() => { if (v !== value) onCommit(v); }} />
      <span className="sl-v">{fmt ? fmt(v) : v}</span>
    </label>
  );
}

export function Bar({ value, max = 100, color, label, right }: { value: number; max?: number; color?: string; label: ReactNode; right?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return <div className="barrow"><span className="br-l">{label}</span><span className="br-t"><span className="br-f" style={{ width: pct + '%', background: color }} /></span><span className="br-r">{right}</span></div>;
}

export function Flag({ iso, size = 18 }: { iso: string; size?: number }) {
  const { w } = useGame(); const c = w.countries[iso];
  return <span className="flag" style={{ fontSize: size }} aria-hidden>{c?.flag || '🏳️'}</span>;
}
export function CName({ iso, link = true }: { iso: string; link?: boolean }) {
  const { w, lang, select } = useGame(); const c = w.countries[iso];
  const n = c ? (lang === 'fr' ? c.nameFr : c.name) : iso;
  if (!link || !c) return <span className="cn"><Flag iso={iso} /> {n}</span>;
  return <button className="cn link" onClick={() => select(iso)}><Flag iso={iso} /> {n}</button>;
}

export function CountryPicker({ value, onChange, exclude, placeholder }: { value: string | null; onChange: (iso: string) => void; exclude?: string[]; placeholder?: string }) {
  const { w, lang, t } = useGame();
  const list = Object.values(w.countries).filter((c) => c.alive && c.iso !== 'ATA' && !exclude?.includes(c.iso)).sort((a, b) => (lang === 'fr' ? a.nameFr : a.name).localeCompare(lang === 'fr' ? b.nameFr : b.name));
  return (
    <select className="sel" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label={placeholder || t('dip.target')}>
      <option value="">{placeholder || t('ui.select')}</option>
      {list.map((c) => <option key={c.iso} value={c.iso}>{c.flag} {lang === 'fr' ? c.nameFr : c.name}</option>)}
    </select>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (v: T) => void }) {
  return <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
