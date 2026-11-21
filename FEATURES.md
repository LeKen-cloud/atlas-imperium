# Feature status
Legend: ✅ implemented · 🟡 partial · ⛔ not yet implemented

## Map & geography
- ✅ Real Natural Earth 1:50m borders, coastlines, islands; zoom/pan; selection; hover
- ✅ Capitals and major cities (GeoNames)
- ✅ 21 map modes incl. all 16 requested
- ✅ Trade-flow arcs on the map
- ✅ Dynamic borders: annexation, cession, secession, new/dissolved countries, occupation hatching
- ⛔ Sub-national administrative divisions (admin-1) — Countries are split only where Natural Earth admin-0 splits them (e.g. dependencies, Somaliland, N. Cyprus).

## Real-world data
- ✅ Bundled dated snapshot: World Bank GDP/population/inflation, OWID energy, market prices (Brent, gold, FX)
- ✅ Provenance badge on figures (Verified / Estimate / Simulated / AI)
- 🟡 Live feeds: World Bank API, Wikidata leaders, GDELT news, ECB FX, optional Alpha Vantage — Work when run locally; blocked in the hosted preview.
- 🟡 Current leaders for every country — 4 verified in the bundle; the rest via the live Wikidata fetch.
- 🟡 Debt, unemployment, military spending for all countries from live sources — Major economies use labelled reference estimates; others are model-derived estimates.

## Simulation
- ✅ Monthly macro model: growth, potential, output gap, inflation, unemployment, Taylor-rule central banks, ECB for euro area
- ✅ Public finances: revenue, spending by ministry, interest, deficit, debt
- ✅ 15 economic sectors with growth/health and strategic support
- ✅ Sovereign bonds, ratings, CDS, FX with PPP anchor, equity indices, commodities, global risk index
- ✅ Gravity-model bilateral trade with blocs, FTAs, sanctions, wars, tariffs; contagion via partners
- ✅ Politics: approval, stability, legitimacy, corruption, parties, elections, coalitions, coups, revolutions, protests
- ✅ Diplomacy: 6 treaty types, sanctions, aid, mediation, summits, organisations (join/leave/found), AI acceptance logic, memory & trust
- ✅ Military: power projection, alliances called to arms, war score, occupation, peace terms, exhaustion, nuclear deterrence
- ✅ Corporations: 80 real companies (simulated figures), M&A, bankruptcies, expansion, new firms, nationalisation
- ✅ Sovereign wealth fund portfolio and watchlist
- ✅ Events: recessions, inflation, debt/bank/currency crises, crashes, disasters, pandemics, breakthroughs, supply shocks
- 🟡 Population groups reacting to policy (workers, business, youth, retirees) — Shown as indices; groups do not yet have their own parties or actions.
- 🟡 Infrastructure as separate assets (railways, ports…) — Represented by an infrastructure index fed by spending.

## AI
- ✅ Rule-based country brains for every AI country (always on)
- ✅ Local open-weight model via Ollama / OpenAI-compatible API (default qwen3:8b)
- ✅ Diplomatic chat in character; game rules decide outcomes
- ✅ Natural-language orders → validated actions (LLM, with rule-based parser fallback)
- ✅ Analyst Q&A with counterfactual simulation (rates), rankings, LLM commentary
- ✅ LLM strategic layer for major AI countries (structured JSON, validated)

## Scenarios & persistence
- ✅ Contemporary world (Nov 2026), peaceful sandbox, USSR endures, European Federation
- ✅ Scenario editor: paint territories, create countries, regime, economy, relations, memberships; export/import
- ⛔ Cold War, WWII, WWI, interwar scenarios — Need historical border datasets (e.g. historical-basemaps) and historical economic series.
- ✅ Saves in IndexedDB, rename/delete, autosave, session recovery, export/import files

## Interface
- ✅ 16 interconnected interfaces, floating country dashboard, news ticker, compare tool
- ✅ French and English, instant switching, centralised dictionaries
- ✅ Dark and light themes
- ⛔ Drag-to-rearrange custom layouts
