import { useEffect, useRef, useState } from 'react';

export interface Series { name: string; data: number[]; color: string; dash?: boolean }
const PAL = ['#4fb3a9', '#e3a33b', '#6f8fd8', '#d96b6b', '#a98bd6', '#8fbf5a', '#d0a0c0', '#9ab'];
export const pal = (i: number) => PAL[i % PAL.length];

function useSize() {
  const ref = useRef<HTMLDivElement>(null); const [s, setS] = useState({ w: 300, h: 160 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setS({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, s] as const;
}
const nice = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (a >= 1e4) return (v / 1e3).toFixed(0) + 'k'; if (a >= 1000) return (v / 1e3).toFixed(1) + 'k';
  if (a >= 100) return v.toFixed(0); if (a >= 10) return v.toFixed(1); return v.toFixed(2);
};

export function LineChart({ series, height = 170, labels, unit = '', zero = false, logScale = false }: { series: Series[]; height?: number; labels?: string[]; unit?: string; zero?: boolean; logScale?: boolean }) {
  const [ref, s] = useSize();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((x) => x.data).filter((v) => isFinite(v));
  const n = Math.max(...series.map((x) => x.data.length), 0);
  if (!all.length || n < 2) return <div ref={ref} className="chart empty" style={{ height }}>—</div>;
  const tf = (v: number) => (logScale ? Math.log10(Math.max(1e-9, v)) : v);
  let lo = Math.min(...all.map(tf)), hi = Math.max(...all.map(tf));
  if (zero && !logScale) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const W = s.w, H = height, L = W < 360 ? 34 : 44, R = 8, T = 8, B = 20;
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (tf(v) - lo) / (hi - lo)) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => lo + (hi - lo) * f);
  const path = (d: number[]) => { const off = n - d.length; return d.map((v, i) => (isFinite(v) ? `${i === 0 ? 'M' : 'L'}${x(i + off).toFixed(1)},${y(v).toFixed(1)}` : '')).join(''); };
  return (
    <div ref={ref} className="chart">
      <svg width={W} height={H} onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - L) / (W - L - R)) * (n - 1)); setHover(i >= 0 && i < n ? i : null); }}>
        {ticks.map((tv, i) => <g key={i}><line x1={L} x2={W - R} y1={y(logScale ? 10 ** tv : tv)} y2={y(logScale ? 10 ** tv : tv)} className="grid" /><text x={L - 4} y={y(logScale ? 10 ** tv : tv) + 3} textAnchor="end" className="tick">{nice(logScale ? 10 ** tv : tv)}{unit}</text></g>)}
        {zero && lo < 0 && hi > 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="zero" />}
        {labels && W > 300 && [0, Math.floor((n - 1) / 2), n - 1].map((i) => labels[i] && <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="tick">{labels[i]}</text>)}
        {series.map((sr, k) => <path key={k} d={path(sr.data)} fill="none" stroke={sr.color} strokeWidth={1.8} strokeDasharray={sr.dash ? '4 3' : undefined} />)}
        {hover !== null && <g><line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cross" />
          {series.map((sr, k) => { const off = n - sr.data.length; const v = sr.data[hover - off]; return v !== undefined && isFinite(v) ? <circle key={k} cx={x(hover)} cy={y(v)} r={3} fill={sr.color} /> : null; })}</g>}
      </svg>
      {hover !== null && <div className="tip" style={{ left: Math.min(W - 150, x(hover) + 8) }}>
        {labels?.[hover] && <b>{labels[hover]}</b>}
        {series.map((sr, k) => { const off = n - sr.data.length; const v = sr.data[hover - off]; return v !== undefined ? <div key={k}><i style={{ background: sr.color }} />{sr.name}: {nice(v)}{unit}</div> : null; })}
      </div>}
      {series.length > 1 && <div className="legend">{series.map((sr, k) => <span key={k}><i style={{ background: sr.color }} />{sr.name}</span>)}</div>}
    </div>
  );
}

export function Spark({ data, color = '#4fb3a9', w = 80, h = 22 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const d = data.filter((v) => isFinite(v)); if (d.length < 2) return <svg width={w} height={h} />;
  const lo = Math.min(...d), hi = Math.max(...d) || lo + 1;
  const p = d.map((v, i) => `${i ? 'L' : 'M'}${((i / (d.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join('');
  return <svg width={w} height={h} className="spark" aria-hidden><path d={p} fill="none" stroke={color} strokeWidth={1.4} /></svg>;
}

export function Donut({ parts, size = 120 }: { parts: { v: number; color: string; label: string }[]; size?: number }) {
  const tot = parts.reduce((s, p) => s + Math.max(0, p.v), 0) || 1; let a = -Math.PI / 2; const r = size / 2 - 6, cx = size / 2;
  return <svg width={size} height={size} aria-hidden>{parts.map((p, i) => { const a0 = a; a += (Math.max(0, p.v) / tot) * Math.PI * 2; const large = a - a0 > Math.PI ? 1 : 0;
    return <path key={i} d={`M${cx + r * Math.cos(a0)},${cx + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a)},${cx + r * Math.sin(a)}`} fill="none" stroke={p.color} strokeWidth={12}><title>{p.label}</title></path>; })}</svg>;
}

// Parliament hemicycle
export function Hemicycle({ parties, size = 220 }: { parties: { seats: number; color: string; name: string; inGov: boolean }[]; size?: number }) {
  const total = parties.reduce((s, p) => s + p.seats, 0); if (!total) return null;
  const dots: { x: number; y: number; c: string; g: boolean }[] = []; const rows = 5; const R = size / 2 - 8;
  const seatsPerRow = Array.from({ length: rows }, (_, i) => Math.round((total * (R * (0.45 + 0.55 * (i / (rows - 1))))) / (R * rows * 0.725)));
  let sum = seatsPerRow.reduce((a, b) => a + b, 0); seatsPerRow[rows - 1] += total - sum; sum = total;
  const pos: { a: number; r: number }[] = [];
  seatsPerRow.forEach((n, i) => { const r = R * (0.45 + 0.55 * (i / (rows - 1))); for (let k = 0; k < n; k++) pos.push({ a: Math.PI * (1 - (n === 1 ? 0.5 : k / (n - 1))), r }); });
  pos.sort((p, q) => q.a - p.a);
  let idx = 0; for (const p of parties) for (let k = 0; k < p.seats; k++) { const q = pos[idx++]; if (q) dots.push({ x: size / 2 + q.r * Math.cos(q.a), y: size / 2 - q.r * Math.sin(q.a) + 4, c: p.color, g: p.inGov }); }
  return <svg width={size} height={size / 2 + 12} aria-hidden>{dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={size / 70} fill={d.c} opacity={d.g ? 1 : 0.55} />)}</svg>;
}
