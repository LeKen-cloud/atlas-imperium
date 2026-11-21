// Builds src/data/generated/world.json from real open datasets.
// Inputs (downloaded into ../rawdata):
//  - world-atlas countries-50m (Natural Earth 1:50m, public domain)
//  - world-countries (mledoze/countries, ODbL)
//  - datasets/gdp, datasets/population, datasets/inflation (World Bank WDI mirrors, ODC-PDDL)
//  - owid/energy-data (Our World in Data, CC BY 4.0)
//  - all-the-cities (GeoNames, CC BY 4.0): capitals + cities >= 1.5M
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const RAW = process.argv[2] || '../rawdata';
const OUT = 'src/data/generated/world.json';

const topo = require('world-atlas/countries-50m.json');
const wc = require('world-countries');

function csv(file) {
  const txt = fs.readFileSync(path.join(RAW, file), 'utf8');
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const parseLine = (l) => {
    const out = []; let cur = ''; let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out;
  };
  const head = parseLine(lines[0]);
  return lines.slice(1).map((l) => { const v = parseLine(l); const o = {}; head.forEach((h, i) => (o[h] = v[i])); return o; });
}
function latest(rows, codeKey, yearKey, valKey) {
  const m = {};
  for (const r of rows) {
    const v = parseFloat(r[valKey]); const y = parseInt(r[yearKey]);
    if (!isFinite(v) || !r[codeKey]) continue;
    if (!m[r[codeKey]] || m[r[codeKey]].y < y) m[r[codeKey]] = { v, y };
  }
  return m;
}
const gdp = latest(csv('gdp.csv'), 'Country Code', 'Year', 'Value');
const pop = latest(csv('population.csv'), 'Country Code', 'Year', 'Value');
const infl = latest(csv('inflation-consumer.csv'), 'Country Code', 'Year', 'Inflation');
// GDP history (last 15 years) for charts
const gdpHist = {};
for (const r of csv('gdp.csv')) {
  const y = +r.Year; if (y < 2009) continue;
  (gdpHist[r['Country Code']] ||= []).push([y, Math.round(+r.Value / 1e6)]);
}
const energyRows = csv('owid-energy-data.csv');
const EN_KEYS = ['oil_production', 'gas_production', 'coal_production', 'primary_energy_consumption', 'renewables_share_energy', 'nuclear_share_energy', 'fossil_share_energy'];
const energy = {};
for (const r of energyRows) {
  if (!r.iso_code || r.iso_code.startsWith('OWID')) continue;
  const y = +r.year; if (y < 2015) continue;
  const e = (energy[r.iso_code] ||= {});
  for (const k of EN_KEYS) { const v = parseFloat(r[k]); if (isFinite(v) && (!e[k] || e[k].y <= y)) e[k] = { v: +v.toFixed(2), y }; }
}
const cities = JSON.parse(fs.readFileSync(path.join(RAW, 'cities.json'), 'utf8'));

// Sovereign of dependent territories (de jure administration as of 2026; game-start ownership).
const SOVEREIGN = {
  GRL: 'DNK', FRO: 'DNK', PYF: 'FRA', NCL: 'FRA', WLF: 'FRA', SPM: 'FRA', BLM: 'FRA', MAF: 'FRA', ATF: 'FRA',
  PRI: 'USA', GUM: 'USA', VIR: 'USA', ASM: 'USA', MNP: 'USA', UMI: 'USA',
  BMU: 'GBR', CYM: 'GBR', VGB: 'GBR', TCA: 'GBR', MSR: 'GBR', AIA: 'GBR', FLK: 'GBR', SHN: 'GBR', PCN: 'GBR', IOT: 'GBR', GIB: 'GBR', SGS: 'GBR', GGY: 'GBR', JEY: 'GBR', IMN: 'GBR',
  ABW: 'NLD', CUW: 'NLD', SXM: 'NLD', HKG: 'CHN', MAC: 'CHN', NFK: 'AUS', HMD: 'AUS', CCK: 'AUS', CXR: 'AUS', COK: 'NZL', NIU: 'NZL', ALA: 'FIN',
};
const byNum = {}; for (const c of wc) if (c.ccn3) byNum[c.ccn3] = c;
const byA3 = {}; for (const c of wc) byA3[c.cca3] = c;
const UNMATCHED = { Somaliland: 'SOM', Kosovo: 'UNK', 'N. Cyprus': 'CYP', 'Indian Ocean Ter.': 'AUS', 'Siachen Glacier': 'IND' };

const geoms = topo.objects.countries.geometries;
const territories = geoms.map((g, i) => {
  let meta = g.id ? byNum[g.id] : null;
  let a3 = meta ? meta.cca3 : UNMATCHED[g.properties.name];
  if (g.properties.name === 'Kosovo') { meta = byA3.UNK || wc.find((c) => c.name.common === 'Kosovo'); a3 = meta ? meta.cca3 : 'UNK'; }
  const own = SOVEREIGN[a3] || a3;
  const iso = meta ? meta.cca3 : a3;
  const isSubUnit = !meta || (UNMATCHED[g.properties.name] && g.properties.name !== 'Kosovo');
  return {
    i, name: g.properties.name, nameFr: meta && !isSubUnit ? meta.translations?.fra?.common || meta.name.common : g.properties.name,
    iso: isSubUnit ? null : iso, owner: own,
    area: meta && !isSubUnit ? meta.area : 0,
    gdp: !isSubUnit && gdp[iso] ? Math.round(gdp[iso].v / 1e6) : 0, // USD millions
    pop: !isSubUnit && pop[iso] ? pop[iso].v : 0,
  };
});
// Remove duplicate economic weight when two geometries share the same ISO (e.g. AUS '036' x2).
const seen = new Set();
for (const t of territories) { if (t.iso && seen.has(t.iso)) { t.gdp = 0; t.pop = 0; t.area = 0; } if (t.iso) seen.add(t.iso); }

const ownerSet = [...new Set(territories.map((t) => t.owner))].filter(Boolean);
const countries = {};
for (const a3 of ownerSet) {
  const m = byA3[a3];
  const wb = a3 === 'UNK' ? 'XKX' : a3;
  if (!m) { console.warn('no meta for', a3); continue; }
  const cap = cities.find((c) => c.c === m.cca2 && c.cap);
  const cur = Object.entries(m.currencies || {})[0];
  countries[a3] = {
    iso: a3, iso2: m.cca2, name: m.name.common, nameFr: m.translations?.fra?.common || m.name.common,
    official: m.name.official, flag: m.flag, region: m.region, subregion: m.subregion,
    capital: (m.capital || [])[0] || null, capitalLL: cap ? cap.ll : m.latlng ? [m.latlng[1], m.latlng[0]] : null,
    currency: cur ? { code: cur[0], name: cur[1].name, symbol: cur[1].symbol } : null,
    languages: Object.values(m.languages || {}), landlocked: !!m.landlocked, unMember: !!m.unMember, independent: !!m.independent,
    area: m.area,
    real: {
      gdp: gdp[wb] ? { v: Math.round(gdp[wb].v / 1e6), y: gdp[wb].y } : null,
      pop: pop[wb] ? { v: pop[wb].v, y: pop[wb].y } : null,
      infl: infl[wb] ? { v: +infl[wb].v.toFixed(2), y: infl[wb].y } : null,
      energy: energy[a3] || null,
      gdpHist: (gdpHist[a3] || []).sort((a, b) => a[0] - b[0]),
    },
  };
}
const cityOut = cities.map((c) => ({ ...c, c: Object.values(countries).find((k) => k.iso2 === c.c)?.iso || null })).filter((c) => c.c);
const out = {
  meta: {
    built: new Date().toISOString().slice(0, 10),
    sources: [
      { id: 'ne', name: 'Natural Earth 1:50m admin-0 via world-atlas 2.0.2', license: 'Public domain', url: 'https://www.naturalearthdata.com/' },
      { id: 'wc', name: 'mledoze/countries via world-countries 5.1.0', license: 'ODbL', url: 'https://github.com/mledoze/countries' },
      { id: 'wb-gdp', name: 'World Bank WDI GDP (current US$) via datasets/gdp', license: 'CC BY 4.0 / ODC-PDDL', url: 'https://github.com/datasets/gdp' },
      { id: 'wb-pop', name: 'World Bank WDI population via datasets/population', license: 'CC BY 4.0 / ODC-PDDL', url: 'https://github.com/datasets/population' },
      { id: 'wb-infl', name: 'World Bank WDI CPI inflation via datasets/inflation', license: 'CC BY 4.0 / ODC-PDDL', url: 'https://github.com/datasets/inflation' },
      { id: 'owid', name: 'Our World in Data energy dataset (Energy Institute, EIA, Ember)', license: 'CC BY 4.0', url: 'https://github.com/owid/energy-data' },
      { id: 'geonames', name: 'GeoNames cities via all-the-cities', license: 'CC BY 4.0', url: 'https://www.geonames.org/' },
    ],
  },
  topology: topo, territories, countries, cities: cityOut,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('territories', territories.length, 'countries', Object.keys(countries).length, 'cities', cityOut.length, 'bytes', fs.statSync(OUT).size);
console.log('missing gdp:', Object.values(countries).filter((c) => !c.real.gdp).map((c) => c.iso).join(' '));
