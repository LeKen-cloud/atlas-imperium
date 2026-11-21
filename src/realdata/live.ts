// Live real-world feeds (only reachable when the game runs locally; the hosted preview blocks
// outside connections). Every item carries source, date and coverage. Nothing here writes into the
// simulation unless the player explicitly applies it while the timeline has not diverged.
export interface RealItem { title: string; url?: string; source: string; date: string; coverage: string; reliability: 'high' | 'medium'; detail?: string }

async function getJSON(url: string, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); } finally { clearTimeout(t); }
}

export async function fetchNews(query = '(economy OR election OR "central bank" OR sanctions OR summit)'): Promise<RealItem[]> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query + ' sourcelang:english')}&mode=artlist&format=json&maxrecords=40&sort=datedesc`;
  const j = await getJSON(url);
  return (j.articles || []).map((a: any) => ({ title: a.title, url: a.url, source: a.domain, date: (a.seendate || '').replace(/T(\d\d)(\d\d).*/, ' $1:$2').replace(/^(\d{4})(\d\d)(\d\d)/, '$1-$2-$3'), coverage: a.sourcecountry || '—', reliability: 'medium' }));
}

export const WB_INDICATORS: [string, string][] = [['NY.GDP.MKTP.CD', 'GDP (current US$)'], ['NY.GDP.MKTP.KD.ZG', 'GDP growth (%)'], ['FP.CPI.TOTL.ZG', 'Inflation (%)'], ['SL.UEM.TOTL.ZS', 'Unemployment (%)'], ['GC.DOD.TOTL.GD.ZS', 'Central gov. debt (% GDP)'], ['MS.MIL.XPND.GD.ZS', 'Military spending (% GDP)'], ['SP.POP.TOTL', 'Population']];
export async function fetchWorldBank(iso3: string): Promise<RealItem[]> {
  const out: RealItem[] = [];
  await Promise.all(WB_INDICATORS.map(async ([id, label]) => {
    try {
      const j = await getJSON(`https://api.worldbank.org/v2/country/${iso3}/indicator/${id}?format=json&mrnev=1`);
      const row = j?.[1]?.[0]; if (!row || row.value == null) return;
      out.push({ title: `${label}: ${Number(row.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, source: 'World Bank WDI', date: String(row.date), coverage: row.country?.value || iso3, reliability: 'high', detail: id });
    } catch { /* indicator unavailable */ }
  }));
  return out;
}

export async function fetchLeaders(): Promise<Record<string, { hos?: string; hog?: string }>> {
  const q = `SELECT ?iso ?hosLabel ?hogLabel WHERE { ?c wdt:P298 ?iso ; wdt:P31 wd:Q3624078 .
    OPTIONAL { ?c p:P35 ?s . ?s ps:P35 ?hos . FILTER NOT EXISTS { ?s pq:P582 ?e } }
    OPTIONAL { ?c p:P6 ?g . ?g ps:P6 ?hog . FILTER NOT EXISTS { ?g pq:P582 ?e2 } }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" } }`;
  const j = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), 25000);
  const out: Record<string, { hos?: string; hog?: string }> = {};
  for (const b of j.results.bindings) { const iso = b.iso.value; const o = (out[iso] ||= {}); if (b.hosLabel) o.hos = b.hosLabel.value; if (b.hogLabel) o.hog = b.hogLabel.value; }
  return out;
}

export async function fetchFX(): Promise<RealItem[]> {
  const j = await getJSON('https://api.frankfurter.app/latest?from=USD');
  return Object.entries(j.rates || {}).map(([k, v]) => ({ title: `USD/${k}: ${v}`, source: 'Frankfurter (European Central Bank reference rates)', date: j.date, coverage: k, reliability: 'high' as const }));
}

export async function fetchQuotes(key: string): Promise<RealItem[]> {
  const syms: [string, string][] = [['SPY', 'S&P 500 ETF'], ['QQQ', 'Nasdaq-100 ETF'], ['DIA', 'Dow Jones ETF'], ['EWQ', 'France ETF'], ['EWG', 'Germany ETF'], ['EWU', 'UK ETF'], ['EWJ', 'Japan ETF'], ['FXI', 'China large-cap ETF']];
  const out: RealItem[] = [];
  for (const [s, label] of syms) {
    try {
      const j = await getJSON(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${s}&apikey=${encodeURIComponent(key)}`);
      const q = j['Global Quote']; if (!q?.['05. price']) continue;
      out.push({ title: `${label} (${s}): ${q['05. price']} (${q['10. change percent']})`, source: 'Alpha Vantage', date: q['07. latest trading day'], coverage: 'US-listed proxy', reliability: 'high' });
      await new Promise((r) => setTimeout(r, 1200)); // free tier: 1 request/second
    } catch { /* skip */ }
  }
  return out;
}
