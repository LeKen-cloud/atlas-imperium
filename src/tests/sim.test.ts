import { newGame } from '../sim/scenarios';
import { tick } from '../sim/engine';
import { perform } from '../sim/actions';
import { SCENARIOS } from '../sim/scenarios';

function finite(w: any) {
  const bad: string[] = [];
  for (const c of Object.values<any>(w.countries)) {
    if (!c.alive) continue;
    for (const [k, v] of Object.entries(c.econ)) if (typeof v === 'number' && !isFinite(v)) bad.push(c.iso + '.econ.' + k);
    for (const [k, v] of Object.entries(c.fin)) if (typeof v === 'number' && !isFinite(v)) bad.push(c.iso + '.fin.' + k);
    for (const [k, v] of Object.entries(c.gov)) if (typeof v === 'number' && !isFinite(v)) bad.push(c.iso + '.gov.' + k);
  }
  return bad;
}

describe('simulation', () => {
  it('runs 10 years of the contemporary world without NaN', () => {
    const w = newGame('contemporary', 'FRA');
    const t0 = Date.now();
    for (let i = 0; i < 120; i++) { tick(w); const b = finite(w); if (b.length) throw new Error('month ' + i + ': ' + b.slice(0, 5).join(',')); }
    const ms = (Date.now() - t0) / 120;
    const big = ['USA', 'CHN', 'DEU', 'FRA', 'JPN', 'IND', 'BRA', 'RUS', 'SAU', 'NGA'].map((i) => { const c = w.countries[i]; return `${i} gdp=${(c.econ.gdp / 1e6).toFixed(2)}T g=${c.econ.growth.toFixed(1)} pi=${c.econ.inflation.toFixed(1)} u=${c.econ.unemployment.toFixed(1)} r=${c.econ.policyRate.toFixed(1)} y=${c.fin.bond10y.toFixed(1)} ${c.fin.rating} debt=${(c.econ.debt / c.econ.gdp * 100).toFixed(0)}% stab=${c.gov.stability.toFixed(0)} fx=${c.fin.fx.toFixed(3)} eq=${c.fin.equity.toFixed(0)} gov=${c.gov.type}`; });
    console.log('ms/tick', ms.toFixed(1)); console.log(big.join('\n'));
    console.log('brent', w.commodities.brent.price.toFixed(1), 'gold', w.commodities.gold.price.toFixed(0), 'risk', w.global.risk.toFixed(1), 'wars', w.wars.filter((x) => !x.ceasefire).map((x) => x.attackers[0] + '>' + x.defenders[0] + ' ' + x.score.toFixed(0)).join(';'));
    console.log('news', w.news.length, w.news.slice(0, 12).map((n) => n.key + JSON.stringify(n.params)).join('\n'));
    console.log('alive', Object.values<any>(w.countries).filter((c) => c.alive).length, 'treaties', w.treaties.length, 'sanctions', w.sanctions.length, 'companies', w.companies.filter((c) => c.alive).length);
    expect(w.t).toBe(120);
  });
  it('save/load round trip keeps state', () => {
    const w = newGame('contemporary', 'DEU');
    for (let i = 0; i < 6; i++) tick(w);
    const s = JSON.stringify(w); const w2 = JSON.parse(s);
    tick(w); tick(w2);
    expect(JSON.stringify(w2.countries.DEU.econ)).toBe(JSON.stringify(w.countries.DEU.econ));
    console.log('save size KB', (s.length / 1024).toFixed(0));
  });
  it('player actions: policy, treaty, sanction, war, peace', () => {
    const w = newGame('contemporary', 'FRA');
    expect(perform(w, 'FRA', { type: 'setPolicy', patch: { policyRate: 5 } }).ok).toBe(false); // euro area: no own monetary policy
    expect(perform(w, 'FRA', { type: 'setPolicy', patch: { taxBurden: 40 } }).ok).toBe(true);
    const r = perform(w, 'FRA', { type: 'proposeTreaty', target: 'MAR', treaty: 'fta' }); console.log('FTA MAR', r.key, r.reasons);
    expect(perform(w, 'FRA', { type: 'sanction', target: 'IRN', level: 3 }).ok).toBe(true);
    const war = perform(w, 'RUS', { type: 'declareWar', target: 'GEO' }); console.log('RUS>GEO', war.key);
    for (let i = 0; i < 24; i++) tick(w);
    console.log(w.wars.map((x) => x.attackers.join('+') + '>' + x.defenders.join('+') + ' score ' + x.score.toFixed(0) + ' occ ' + x.occupied.length + (x.ceasefire ? ' ended' : '')).join('\n'));
  });
  it('alternate scenarios build and run', () => {
    for (const s of SCENARIOS.filter((x) => x.status !== 'planned')) {
      const w = newGame(s.id, null); for (let i = 0; i < 12; i++) tick(w);
      expect(finite(w)).toEqual([]);
    }
  });
});
