// Honest feature inventory, shown in Settings and mirrored in FEATURES.md.
export type St = 'implemented' | 'partial' | 'missing';
export const FEATURES: { area: string; items: [string, St, string?][] }[] = [
  { area: 'Map & geography', items: [
    ['Real Natural Earth 1:50m borders, coastlines, islands; zoom/pan; selection; hover', 'implemented'],
    ['Capitals and major cities (GeoNames)', 'implemented'],
    ['21 map modes incl. all 16 requested', 'implemented'],
    ['Trade-flow arcs on the map', 'implemented'],
    ['Dynamic borders: annexation, cession, secession, new/dissolved countries, occupation hatching', 'implemented'],
    ['Sub-national administrative divisions (admin-1)', 'missing', 'Countries are split only where Natural Earth admin-0 splits them (e.g. dependencies, Somaliland, N. Cyprus).'],
  ] },
  { area: 'Real-world data', items: [
    ['Bundled dated snapshot: World Bank GDP/population/inflation, OWID energy, market prices (Brent, gold, FX)', 'implemented'],
    ['Provenance badge on figures (Verified / Estimate / Simulated / AI)', 'implemented'],
    ['Live feeds: World Bank API, Wikidata leaders, GDELT news, ECB FX, optional Alpha Vantage', 'partial', 'Work when run locally; blocked in the hosted preview.'],
    ['Current leaders for every country', 'partial', '4 verified in the bundle; the rest via the live Wikidata fetch.'],
    ['Debt, unemployment, military spending for all countries from live sources', 'partial', 'Major economies use labelled reference estimates; others are model-derived estimates.'],
  ] },
  { area: 'Simulation', items: [
    ['Monthly macro model: growth, potential, output gap, inflation, unemployment, Taylor-rule central banks, ECB for euro area', 'implemented'],
    ['Public finances: revenue, spending by ministry, interest, deficit, debt', 'implemented'],
    ['15 economic sectors with growth/health and strategic support', 'implemented'],
    ['Sovereign bonds, ratings, CDS, FX with PPP anchor, equity indices, commodities, global risk index', 'implemented'],
    ['Gravity-model bilateral trade with blocs, FTAs, sanctions, wars, tariffs; contagion via partners', 'implemented'],
    ['Politics: approval, stability, legitimacy, corruption, parties, elections, coalitions, coups, revolutions, protests', 'implemented'],
    ['Diplomacy: 6 treaty types, sanctions, aid, mediation, summits, organisations (join/leave/found), AI acceptance logic, memory & trust', 'implemented'],
    ['Military: power projection, alliances called to arms, war score, occupation, peace terms, exhaustion, nuclear deterrence', 'implemented'],
    ['Corporations: 80 real companies (simulated figures), M&A, bankruptcies, expansion, new firms, nationalisation', 'implemented'],
    ['Sovereign wealth fund portfolio and watchlist', 'implemented'],
    ['Events: recessions, inflation, debt/bank/currency crises, crashes, disasters, pandemics, breakthroughs, supply shocks', 'implemented'],
    ['Population groups reacting to policy (workers, business, youth, retirees)', 'partial', 'Shown as indices; groups do not yet have their own parties or actions.'],
    ['Infrastructure as separate assets (railways, ports…)', 'partial', 'Represented by an infrastructure index fed by spending.'],
  ] },
  { area: 'AI', items: [
    ['Rule-based country brains for every AI country (always on)', 'implemented'],
    ['Local open-weight model via Ollama / OpenAI-compatible API (default qwen3:8b)', 'implemented'],
    ['Diplomatic chat in character; game rules decide outcomes', 'implemented'],
    ['Natural-language orders → validated actions (LLM, with rule-based parser fallback)', 'implemented'],
    ['Analyst Q&A with counterfactual simulation (rates), rankings, LLM commentary', 'implemented'],
    ['LLM strategic layer for major AI countries (structured JSON, validated)', 'implemented'],
  ] },
  { area: 'Scenarios & persistence', items: [
    ['Contemporary world (Nov 2026), peaceful sandbox, USSR endures, European Federation', 'implemented'],
    ['Scenario editor: paint territories, create countries, regime, economy, relations, memberships; export/import', 'implemented'],
    ['Cold War, WWII, WWI, interwar scenarios', 'missing', 'Need historical border datasets (e.g. historical-basemaps) and historical economic series.'],
    ['Saves in IndexedDB, rename/delete, autosave, session recovery, export/import files', 'implemented'],
  ] },
  { area: 'Interface', items: [
    ['16 interconnected interfaces, floating country dashboard, news ticker, compare tool', 'implemented'],
    ['French and English, instant switching, centralised dictionaries', 'implemented'],
    ['Dark and light themes', 'implemented'],
    ['Drag-to-rearrange custom layouts', 'missing'],
  ] },
];
