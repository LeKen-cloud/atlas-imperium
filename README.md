# Atlas Imperium

A turn-based geopolitical, economic and financial sandbox in French and English, in the spirit of PAX Historia. You can play any of ~200 countries on a real world map. The world starts from real, dated data and then evolves in its own simulated timeline. AI governments run on a local open-weight model, with rule-based fallbacks.

## Run it

Pick whichever suits you:

1. **Desktop app:** unzip `AtlasImperium-Windows.zip` and double-click **Atlas Imperium.exe**. No install needed. Windows SmartScreen may warn because the app isn't code-signed: click *More info → Run anyway*. Press F11 for full screen.
2. **Online:** https://leken-cloud.github.io/atlas-imperium/
3. **Single file:** double-click **Play Atlas Imperium.html**. It works offline in Chrome, Edge or Firefox.
4. **Developer version:** run `start-windows.bat` (needs [Node.js](https://nodejs.org)). It installs everything, then opens the browser once the server is ready.

Do not open the `index.html` at the root of the project. That file is the source template, and it shows a blank page.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # simulation, AI-fallback and translation tests
npm run build      # rebuilds dist/index.html
npm run desktop    # rebuilds the Windows .exe into release/
```

**Local AI (optional):**
1. Install [Ollama](https://ollama.com).
2. Run `ollama pull qwen3:8b` (use `qwen3:14b` if your GPU has 16 GB).
3. Keep Ollama running. The .exe and the developer version connect on their own.

For the online version, allow that site once before starting Ollama. In PowerShell:
`setx OLLAMA_ORIGINS "https://leken-cloud.github.io"`. Then restart Ollama.

## How a turn works

1. **Chat (free):** talk to any government. They tell you whether they would accept a deal.
2. **Orders (3 per turn by default):** write anything ("ally with Japan and invest in railways", "back the separatists in X", "launch a space programme"), or use the Diplomacy, Government and Corporations buttons. Each order is interpreted and shown to you before it counts. Tax, budget and rate sliders are free.
3. **Time jump:** choose 1, 3, 6 or 12 months, then press **End turn** (Ctrl+Enter). Every country plays the same months.
4. **Chapter report:** a narrative of what happened, your orders' results, your country before → after, headlines, map changes, incoming proposals and your advisor's recommendations. You can rewind any of the last 10 turns.

## Architecture

```
src/
  data/generated/world.json   real data bundle (built by scripts/build-data.mjs)
  data/reference.ts           dated snapshots and labelled estimates (markets, leaders, orgs, SIPRI/IMF/EIU references)
  sim/                        deterministic simulation (pure TypeScript, no UI)
    types.ts                  WorldState: the single source of truth (plain JSON, saved as-is)
    init.ts  scenarios.ts     build worlds from data; alternate-history scenarios; editor ops
    engine.ts                 monthly tick: global → trade → economy → finance → politics → wars → markets → AI → events
    economy.ts                growth, potential, output gap, inflation, labour, Taylor-rule central banks, ECB, budget, sectors, bonds, FX, equities
    trade.ts                  gravity model of bilateral trade (blocs, FTAs, sanctions, wars, tariffs, relations)
    politics.ts               approval, stability, parties, elections, coalitions, coups, revolutions, protests
    relations.ts actions.ts   relations, trust and memory; every action validated here (player, rules AI and LLM alike)
    military.ts borders.ts    war model, occupation, peace terms; transfers, secession, new and dissolved states
    markets.ts events.ts      commodities, corporations, portfolio; emergent and exogenous events
    countryAI.ts              rule-based country brain (always on)
  ai/                         local LLM client, agents (diplomat, orders, analyst, strategist), rule-based analyst
  realdata/live.ts            live feeds: World Bank API, Wikidata, GDELT, ECB (Frankfurter), Alpha Vantage
  save/save.ts                IndexedDB saves, autosave, session recovery, JSON export/import
  i18n/                       en.ts / fr.ts dictionaries (add a language by adding a file)
  ui/                         React interface: map, country card, 16 interfaces
```

The design is **hybrid**. Numbers come from a deterministic simulation; the language model supplies words and intentions. An LLM never changes the world directly. It returns structured JSON, and `sim/actions.perform()` validates every action against the game rules. When a player sends a diplomatic proposal, the game engine decides the outcome and the model only phrases the reply in character. Without a model, the same features run on rules.

## Data strategy (and honesty rules)

Every figure carries a badge: **Verified** (dated external source), **Estimate** (reference value not verified live), **Simulated** (produced by the game) or **AI** (model interpretation). Simulated events never present themselves as real.

| Layer | Source | Licence |
|---|---|---|
| Borders, coastlines, islands | Natural Earth 1:50m via `world-atlas` | Public domain |
| Capitals, currencies, area, names FR/EN | mledoze/countries via `world-countries` | ODbL |
| Capitals and cities ≥1.5 M | GeoNames via `all-the-cities` | CC BY 4.0 |
| GDP, population, CPI inflation (latest year per country) | World Bank WDI via datasets/gdp, population, inflation | CC BY 4.0 |
| Oil, gas and coal production; energy use; renewables | Our World in Data energy dataset | CC BY 4.0 |
| Brent (monthly to Oct 2026), gold, EUR/GBP/JPY/CNY rates | Alpha Vantage, fetched 2026-11-21 | free API |
| Wars in progress, 4 heads of state | Al Jazeera, ISW and AP reporting, Nov 2026 | cited in-game |
| Regime type, military spending, public debt (major economies) | EIU 2024 categories, SIPRI 2024, IMF WEO 2024 — **labelled Estimate** | reference |

Live feeds only work when the game runs locally; the hosted preview blocks outside connections. They are the World Bank API, Wikidata heads of state and government, GDELT news, ECB rates and optional Alpha Vantage quotes. They appear in *Real-world intelligence* and never overwrite the simulation. Leaders can be applied only while the timeline has not diverged.

## Recommended model

**Qwen3 8B through Ollama** is the default. It is Apache-2.0 licensed, strong in French, and follows JSON-schema structured output reliably. It fits an 8 GB GPU at Q4. **Qwen3 14B** is better on a 16 GB GPU. Mistral Small and gpt-oss-20b also work through the same settings. Larger models are not needed: the simulation does the arithmetic, and the model writes, chooses and explains.

## Mechanics beyond the brief

These were added because they make the existing systems interact:
- Euro area with one ECB rate and one euro. Members cannot set their own policy rate.
- Sovereign risk score driving yields, ratings and CDS, so debt spirals emerge.
- FX anchored to relative inflation (PPP), with interest differentials, current account and risk.
- Sanctions that reroute trade, and wars that collapse it. Contagion runs through trade partners.
- Diplomatic capacity as a resource; trust and memory per country pair, decaying over about 5 years.
- Organisations you can join, leave or found. Membership raises trade and relations.
- Regional unrest in annexed or occupied territories, leading to secession and new states.
- Counterfactual analysis: the analyst clones the world and simulates a rate hike to compare.
- A sovereign wealth fund with real-time mark-to-market of simulated instruments.

## Feature status

See `FEATURES.md`, or *Settings & AI → Feature status* in the game.

## Known limitations

- There are no sub-national provinces: territories are Natural Earth admin-0 units, so splitting France into regions is not possible yet.
- Historical scenarios (1914, 1925, 1939, 1962) are not implemented. They need historical border datasets and historical economic series.
- Sector shares, unemployment, education and infrastructure indices start as model-derived estimates, labelled as such.
- Real stock-index levels are not bundled, because they are premium on the free data key. The national equity indices are simulated (base 1000).
- Party names are generic ideological blocs, not real parties.
- The war model is abstract: no unit movement.
- Saves live in the browser (IndexedDB). Export a file to move or share a game.
