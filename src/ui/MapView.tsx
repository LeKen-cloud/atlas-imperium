import { useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';
import { feature, mesh } from 'topojson-client';
import { WORLD } from '../sim/geo';
import { useGame } from './common';
import { modeFor, MAP_MODES, type MapMode } from './mapModes';
import { tradeView } from '../sim/trade';
import { editorAssign } from '../sim/scenarios';
import { CAT_COLORS } from './theme';
import type { WorldState } from '../sim/types';

const W0 = 1600, H0 = 820;
const projection = geoNaturalEarth1().fitExtent([[10, 10], [W0 - 10, H0 - 10]], { type: 'Sphere' } as any);
const pathGen = geoPath(projection);
const FEATURES: any[] = (feature(WORLD.topology, WORLD.topology.objects.countries) as any).features;
const PATHS = FEATURES.map((f) => pathGen(f) || '');
const AREAS = FEATURES.map((f) => pathGen.area(f));
const CENTROIDS = FEATURES.map((f) => pathGen.centroid(f));
const SPHERE = pathGen({ type: 'Sphere' } as any) || '';
const GRATICULE = pathGen(geoGraticule10()) || '';

// Decorative world backdrop (main menu): political colours of a world, no interaction.
export function WorldBackdrop({ w }: { w: WorldState }) {
  return <svg viewBox={`0 0 ${W0} ${H0}`} className="backdrop" preserveAspectRatio="xMidYMid slice" aria-hidden>
    <defs><radialGradient id="bgOcean" cx="50%" cy="45%" r="75%"><stop offset="0%" className="oc1" /><stop offset="100%" className="oc2" /></radialGradient></defs>
    <path d={SPHERE} fill="url(#bgOcean)" /><path d={GRATICULE} className="grat" />
    {PATHS.map((d, i) => <path key={i} d={d} fill={w.countries[w.territories[i].owner]?.color || '#888'} className="bd-land" />)}
  </svg>;
}

export function MapView() {
  const g = useGame();
  const { w, v, t, lang, selected, select: sel, mapMode, setMapMode, editor, setEditor } = g;
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>();
  const [k, setK] = useState(1);
  const gRef = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [showArcs, setShowArcs] = useState(false);
  const [showCities, setShowCities] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    const svg = select(svgRef.current!);
    const z = d3zoom<SVGSVGElement, unknown>().scaleExtent([1, 40]).translateExtent([[-200, -100], [W0 + 200, H0 + 100]])
      .on('start', () => svgRef.current?.classList.add('zooming'))
      .on('zoom', (e) => { gRef.current?.setAttribute('transform', e.transform.toString()); })
      .on('end', (e) => { svgRef.current?.classList.remove('zooming'); setK(e.transform.k); });
    svg.call(z); zoomRef.current = z;
    return () => { svg.on('.zoom', null); };
  }, []);

  // Borders between different owners are recomputed only when ownership changes.
  const ownKey = w.territories.map((x) => x.owner).join(',');
  const borders = useMemo(() => {
    const own = (gg: any) => w.territories[WORLD.topology.objects.countries.geometries.indexOf(gg)]?.owner;
    const idx = new Map(WORLD.topology.objects.countries.geometries.map((gg: any, i: number) => [gg, i]));
    const ownerOf = (gg: any) => w.territories[idx.get(gg) as number]?.owner;
    void own;
    return {
      intl: pathGen(mesh(WORLD.topology, WORLD.topology.objects.countries, (a: any, b: any) => a !== b && ownerOf(a) !== ownerOf(b)) as any) || '',
      internal: pathGen(mesh(WORLD.topology, WORLD.topology.objects.countries, (a: any, b: any) => a !== b && ownerOf(a) === ownerOf(b)) as any) || '',
      coast: pathGen(mesh(WORLD.topology, WORLD.topology.objects.countries, (a: any, b: any) => a === b) as any) || '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownKey]);

  // Label anchor: centroid of each owner's largest territory
  const labels = useMemo(() => {
    const best: Record<string, { i: number; a: number; tot: number }> = {};
    w.territories.forEach((tt, i) => { const b = best[tt.owner]; const a = AREAS[i]; if (!b) best[tt.owner] = { i, a, tot: a }; else { b.tot += a; if (a > b.a) { b.i = i; b.a = a; } } });
    return Object.entries(best).map(([iso, b]) => ({ iso, x: CENTROIDS[b.i][0], y: CENTROIDS[b.i][1], a: b.tot }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownKey]);

  const mode = modeFor(mapMode, w, selected || w.player, t);
  const fills = useMemo(() => w.territories.map((tt) => { const c = w.countries[tt.owner]; return tt.owner === 'ATA' ? 'var(--bg3)' : c ? mode.color(c) : '#333'; }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v, mapMode, selected, ownKey, lang]);

  const arcs = useMemo(() => {
    if (!showArcs && mapMode !== 'trade') return [];
    const tv = tradeView(); const focus = selected || w.player;
    const list = focus && mapMode === 'trade' ? (tv.partners[focus] || []).slice(0, 12).map((p) => [focus, p.iso, p.ex + p.im] as [string, string, number]) : tv.flows.slice(0, 40);
    const max = Math.max(...list.map((x) => x[2]), 1);
    return list.map(([a, b, val]) => {
      const A = w.countries[a]?.capitalLL, B = w.countries[b]?.capitalLL; if (!A || !B) return null;
      const p = projection(A), q = projection(B); if (!p || !q) return null;
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2 - Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.22;
      return { d: `M${p[0]},${p[1]} Q${mx},${my} ${q[0]},${q[1]}`, wgt: 0.6 + (val / max) * 3.4, key: a + b };
    }).filter(Boolean) as { d: string; wgt: number; key: string }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, showArcs, mapMode, selected]);

  const markers = useMemo(() => {
    const out: { key: string; x: number; y: number; color: string; kind: 'event' | 'war' | 'me'; iso: string; title: string }[] = [];
    const proj = (iso: string) => { const ll = w.countries[iso]?.capitalLL; return ll ? projection(ll) : null; };
    const seen = new Set<string>();
    for (const n of w.news) {
      if (n.t < w.t - 2) break; if (n.severity < 2 || !n.countries[0] || seen.has(n.countries[0]) || n.cat === 'meta') continue;
      const p = proj(n.countries[0]); if (!p) continue; seen.add(n.countries[0]);
      out.push({ key: 'n' + n.id, x: p[0], y: p[1], color: CAT_COLORS[n.cat] || '#fb923c', kind: 'event', iso: n.countries[0], title: t(n.key, n.params) });
      if (out.length > 30) break;
    }
    for (const war of w.wars) {
      if (war.ceasefire) continue; const a = proj(war.attackers[0]), d = proj(war.defenders[0]); if (!a || !d) continue;
      const near = Math.hypot(a[0] - d[0], a[1] - d[1]) < 140; const x = near ? (a[0] + d[0]) / 2 : d[0], y = near ? (a[1] + d[1]) / 2 : d[1];
      out.push({ key: 'w' + war.id, x, y, color: '#ef4444', kind: 'war', iso: war.defenders[0], title: (w.countries[war.attackers[0]]?.name || '') + ' ⚔ ' + (w.countries[war.defenders[0]]?.name || '') });
    }
    if (w.player) { const p = proj(w.player); if (p) out.push({ key: 'me', x: p[0], y: p[1], color: '#f5b942', kind: 'me', iso: w.player, title: w.countries[w.player].name }); }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, lang]);

  const cities = useMemo(() => WORLD.cities.map((c) => { const p = projection(c.ll); return p ? { ...c, x: p[0], y: p[1] } : null; }).filter(Boolean) as any[], []);

  const click = (i: number) => {
    const tt = w.territories[i];
    if (editor.on) {
      if (editor.owner) { editorAssign(w, i, editor.owner); g.bump(); }
      else setEditor({ ...editor, selection: editor.selection.includes(i) ? editor.selection.filter((x) => x !== i) : [...editor.selection, i] });
      return;
    }
    sel(tt.owner === selected ? null : tt.owner);
  };
  const zoomTo = (iso: string) => {
    const idxs = w.territories.filter((x) => x.owner === iso).map((x) => x.i); if (!idxs.length || !zoomRef.current) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of idxs) { if (AREAS[i] < 2 && idxs.length > 1) continue; const b = pathGen.bounds(FEATURES[i]); x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); }
    const s = Math.min(12, 0.75 / Math.max((x1 - x0) / W0, (y1 - y0) / H0));
    select(svgRef.current!).transition().duration(600).call(zoomRef.current.transform as any, zoomIdentity.translate(W0 / 2 - s * (x0 + x1) / 2, H0 / 2 - s * (y0 + y1) / 2).scale(s));
  };
  useEffect(() => { (window as any).__atlasZoomTo = zoomTo; });

  const hovered = hover ? w.territories[hover.i] : null; const hc = hovered ? w.countries[hovered.owner] : null;
  const hv = hc ? mode.value(hc) : null;
  const hlKey = g.highlights.join(',');
  // The land layer is the expensive part (≈240 large paths): rebuilt only when colours/selection change.
  const landLayer = useMemo(() => PATHS.map((d, i) => {
    const tt = w.territories[i]; const isSel = tt.owner === selected || (editor.on && editor.selection.includes(i));
    return <path key={i} d={d} data-i={i} fill={fills[i]} className={'land' + (isSel ? ' sel' : '') + (tt.owner === w.player ? ' mine' : '') + (g.highlights.includes(i) ? ' changed' : '')} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [fills, selected, editor.on, editor.selection.join(','), w.player, hlKey]);
  const idxOf = (e: React.MouseEvent) => { const a = (e.target as Element).getAttribute('data-i'); return a === null ? -1 : +a; };
  const onLandClick = (e: React.MouseEvent) => { const i = idxOf(e); if (i >= 0) click(i); };
  const lastMove = useRef(0);
  const onLandMove = (e: React.MouseEvent) => {
    const now = performance.now(); if (now - lastMove.current < 40) return; lastMove.current = now;
    const i = idxOf(e); if (i < 0) return; const r = svgRef.current!.getBoundingClientRect(); setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
  };
  return (
    <div className="map-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${W0} ${H0}`} className="map" role="img" aria-label={t('nav.map')} onMouseLeave={() => setHover(null)}>
        <defs>
          {[...new Set(w.territories.filter((x) => x.controller !== x.owner).map((x) => x.controller))].map((c) => (
            <pattern key={c} id={'occ-' + c} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="6" height="6" fill="transparent" /><rect width="3" height="6" fill={w.countries[c]?.color || '#900'} /></pattern>
          ))}
        </defs>
        <defs>
          <radialGradient id="oceanGrad" cx="50%" cy="42%" r="78%"><stop offset="0%" className="oc1" /><stop offset="100%" className="oc2" /></radialGradient>
        </defs>
        <g ref={gRef}>
          <path d={SPHERE} fill="url(#oceanGrad)" className="ocean" />
          <path d={GRATICULE} className="grat" strokeWidth={0.6 / Math.sqrt(k)} />
          <path d={borders.coast} className="shore" strokeWidth={5 / Math.sqrt(k)} />
          <g onClick={onLandClick} onMouseMove={onLandMove}>{landLayer}</g>
          {w.territories.filter((x) => x.controller !== x.owner).map((x) => <path key={'o' + x.i} d={PATHS[x.i]} fill={`url(#occ-${x.controller})`} className="occ" pointerEvents="none" />)}
          <path d={borders.coast} className="coast" strokeWidth={0.5 / k} />
          <path d={borders.internal} className="b-int" strokeWidth={0.35 / k} />
          <path d={borders.intl} className="b-intl" strokeWidth={1.1 / Math.sqrt(k)} />
          {selected && w.territories.filter((x) => x.owner === selected).map((x) => <path key={'s' + x.i} d={PATHS[x.i]} className="sel-outline" strokeWidth={2.2 / k} pointerEvents="none" />)}
          {arcs.map((a) => <path key={a.key} d={a.d} className="arc" strokeWidth={a.wgt / Math.sqrt(k)} pointerEvents="none" />)}
          {showCities && cities.filter((c) => c.cap || k > 3.5).map((c, i) => <g key={i} pointerEvents="none"><circle cx={c.x} cy={c.y} r={(c.cap ? 2.2 : 1.5) / k} className={c.cap ? 'capital' : 'city'} />{k > 2.5 && <text x={c.x + 3 / k} y={c.y + 3 / k} fontSize={9 / k} className="city-l">{c.n}</text>}</g>)}
          {markers.map((m) => <g key={m.key} transform={`translate(${m.x},${m.y}) scale(${1 / Math.sqrt(k)})`} className={'mk mk-' + m.kind} style={{ ['--mc' as any]: m.color }} onClick={(e) => { e.stopPropagation(); g.setPanel(m.kind === 'war' ? 'military' : 'news'); sel(m.iso); }}>
            <title>{m.title}</title>
            <circle r={9} className="mk-pulse" /><circle r={m.kind === 'war' ? 7 : 4.5} className="mk-dot" />{m.kind === 'war' && <text y={3.5} textAnchor="middle" className="mk-ic">⚔</text>}{m.kind === 'me' && <text y={3.5} textAnchor="middle" className="mk-ic">★</text>}
          </g>)}
          {showLabels && labels.filter((l) => l.a * k * k > 900 && w.countries[l.iso]?.alive).map((l) => {
            const c = w.countries[l.iso]; const fs = Math.min(22, Math.max(8, Math.sqrt(l.a) / 6)) / Math.max(1, k * 0.85);
            return <text key={l.iso} x={l.x} y={l.y} fontSize={fs} className="clabel" textAnchor="middle" pointerEvents="none">{lang === 'fr' ? c.nameFr : c.name}</text>;
          })}
        </g>
      </svg>
      <div className="map-tools">
        <select className="sel" value={mapMode} onChange={(e) => setMapMode(e.target.value as MapMode)} aria-label="Map mode">
          {MAP_MODES.map((m) => <option key={m} value={m}>{t('mode.' + m)}</option>)}
        </select>
        <label className="chk"><input type="checkbox" checked={showArcs} onChange={(e) => setShowArcs(e.target.checked)} />{t('map.tradeArcs')}</label>
        <label className="chk"><input type="checkbox" checked={showCities} onChange={(e) => setShowCities(e.target.checked)} />{t('map.capitals')}</label>
        <label className="chk"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />{t('map.labels')}</label>
        <button className="btn ghost sm" onClick={() => select(svgRef.current!).transition().duration(500).call(zoomRef.current!.transform as any, zoomIdentity)}>{t('map.reset')}</button>
        {selected && <button className="btn ghost sm" onClick={() => zoomTo(selected)}>⌖</button>}
      </div>
      <div className="legend-box">
        <b>{t('mode.' + mapMode)}</b>
        {mode.legend.kind === 'scale' ? <div className="lg-scale"><span>{mode.legend.lo}</span><i style={{ background: `linear-gradient(90deg, ${mode.legend.stops.join(',')})` }} /><span>{mode.legend.hi}</span></div>
          : <div className="lg-cats">{mode.legend.items.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>}
        {(mapMode === 'relations' || mapMode === 'trade') && !(selected || w.player) && <div className="muted">{t('map.select')}</div>}
        {w.territories.some((x) => x.controller !== x.owner) && <div className="lg-cats"><span><i className="hatch" />{t('map.occupied')}</span></div>}
      </div>
      {hover && hovered && hc && (
        <div className="hover" style={{ left: Math.min(hover.x + 14, (svgRef.current?.clientWidth || 800) - 220), top: hover.y + 14 }}>
          <b>{hc.flag} {lang === 'fr' ? hc.nameFr : hc.name}</b>
          {hovered.name !== hc.name && hovered.iso !== hc.iso && <div className="muted">{lang === 'fr' ? hovered.nameFr : hovered.name}</div>}
          {hv !== null && isFinite(hv as number) && <div>{t('mode.' + mapMode)}: {mode.fmt(hv as number)}</div>}
          {hovered.controller !== hovered.owner && <div className="warn">{t('map.occupied')}: {w.countries[hovered.controller]?.name}</div>}
          {editor.on && <div className="muted">#{hovered.i}</div>}
        </div>
      )}
    </div>
  );
}
