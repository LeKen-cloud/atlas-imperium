// Core world-state types. WorldState is the single source of truth; it is plain JSON so it can be saved.

export type Prov = 'verified' | 'estimate' | 'simulated' | 'ai' | 'historical';
export interface Tag { prov: Prov; src?: string; date?: string }

export const SECTORS = ['agriculture', 'manufacturing', 'construction', 'technology', 'finance', 'energy', 'mining', 'transport', 'telecom', 'tourism', 'health', 'education', 'retail', 'logistics', 'realestate'] as const;
export type Sector = (typeof SECTORS)[number];

export const GOV_TYPES = ['full_democracy', 'flawed_democracy', 'hybrid', 'authoritarian', 'absolute_monarchy', 'theocracy', 'one_party'] as const;
export type GovType = (typeof GOV_TYPES)[number];
export const isDemocracy = (g: GovType) => g === 'full_democracy' || g === 'flawed_democracy' || g === 'hybrid';

export const SPEND_KEYS = ['health', 'education', 'infrastructure', 'defense', 'social', 'research', 'subsidies', 'admin'] as const;
export type SpendKey = (typeof SPEND_KEYS)[number];

export interface Party {
  id: string; bloc: string; // bloc key: far_left, left, green, centre, centre_right, right, nationalist, regime
  econ: number; // -1 left .. +1 right
  auth: number; // 0 liberal .. 1 authoritarian
  support: number; // 0..1
  seats: number; inGov: boolean;
}

export interface Policy {
  taxBurden: number; // revenue target, % of GDP
  corpTax: number; // headline corporate rate %
  spending: Record<SpendKey, number>; // % of GDP
  policyRate: number | null; // null = let the central bank (rule) decide
  tariff: number; // average tariff %
  fdiOpenness: number; // 0..1
  regulation: number; // 0 light .. 1 heavy
  migration: number; // 0 closed .. 1 open
  energy: 'balanced' | 'green' | 'fossil' | 'nuclear';
  strategic: Sector[]; // sectors receiving targeted support
  cbIndependent: boolean;
  capitalControls: boolean;
}

export interface SectorState { share: number; growth: number; health: number } // share of GDP, annual growth %, 0..100 health

export interface Economy {
  gdp: number; // nominal GDP, USD millions
  gdpReal: number; // real index (start = 100)
  growth: number; // real growth, annualized %
  potential: number; // potential growth %
  gap: number; // output gap %
  inflation: number; // %
  unemployment: number; // %
  nairu: number;
  debt: number; // public debt, USD millions
  privateDebt: number; // % GDP
  revenue: number; expenditure: number; interest: number; // USD m / year
  deficit: number; // % GDP (positive = deficit)
  exports: number; imports: number; // USD m / year
  fdiInflow: number; // USD m / year
  productivity: number; // index 100
  sectors: Record<Sector, SectorState>;
  consumption: number; investment: number; // % GDP
  bankHealth: number; // 0..100
  tradeK: number; // trade calibration constant (set on first trade pass)
  effRate: number; // average interest rate paid on public debt %
  policyRate: number; // current central bank rate %
}

export interface Finance {
  fx: number; // units of local currency per USD (or index if refFx=false)
  fxRef: boolean; // whether fx started from a verified reference rate
  fxAnchor: number; // fundamental (relative-PPP) value the market rate reverts to
  equity: number; // national equity index level (simulated)
  bond10y: number; // %
  cds: number; // bps
  rating: string; // AAA..D (simulated)
  reserves: number; // USD m
  vol: number; // equity volatility %
  reserveCurrency: number; // 0..1 reserve status
}

export interface Society {
  pop: number; popGrowth: number; // % / year
  urban: number; // %
  education: number; health: number; // 0..100 indices
  gini: number; cohesion: number; // 0..100
  netMigration: number; // per 1000 / yr
  medianAge: number;
}

export interface Military {
  spendPct: number; // % GDP (mirrors policy.spending.defense)
  capital: number; // accumulated military capital, USD m
  personnel: number; // thousands
  tech: number; // 0..100
  readiness: number; // 0..100
  nuclear: boolean;
  exhaustion: number; // 0..100
}

export interface Government {
  type: GovType;
  headOfState: string | null; headOfGov: string | null; leaderTag: Tag;
  approval: number; stability: number; legitimacy: number; corruption: number; // 0..100
  nextElection: number; // month index
  cycle: number; // years between elections
  parties: Party[];
  centralBank: boolean; // has own monetary authority
  reforms: { id: string; until: number }[];
  regionalAutonomy: number; // 0..1
}

export interface MemoryEntry { t: number; with: string; kind: string; delta: number }

export interface AIState {
  aggression: number; cooperation: number; ambition: number; // 0..1 personality (simulated)
  goals: string[]; // short-term goal keys
  longGoal: string;
  memory: MemoryEntry[];
  lastAct: number;
}

export interface Country {
  iso: string; name: string; nameFr: string; flag: string; color: string;
  custom?: boolean; // created in-game
  capital: string | null; capitalLL: [number, number] | null;
  region: string; subregion: string; currency: string | null; currencyName: string | null; languages: string[];
  area: number;
  alive: boolean;
  econ: Economy; fin: Finance; soc: Society; mil: Military; gov: Government; policy: Policy;
  infra: number; tech: number; influence: number; // 0..100 indices
  diploPoints: number; // diplomatic capacity
  resources: { oil: number; gas: number; coal: number; minerals: number; agri: number }; // oil/gas/coal = TWh/yr production
  energyUse: number; // TWh/yr primary energy
  renewables: number; // % of energy
  ai: AIState;
  tags: Record<string, Tag>; // provenance per field
  hist: { t: number[]; gdp: number[]; growth: number[]; infl: number[]; unemp: number[]; debt: number[]; approval: number[]; stability: number[]; fx: number[]; equity: number[]; bond: number[] };
  core: number[]; // territory indices considered core (historical claims)
}

export interface Territory { i: number; owner: string; controller: string; unrest: number; baseGdp: number; basePop: number; area: number; iso: string | null; name: string; nameFr: string }

export type TreatyType = 'alliance' | 'defense' | 'fta' | 'nap' | 'investment' | 'tech' | 'peace' | 'ceasefire';
export interface Treaty { id: string; type: TreatyType; a: string; b: string; start: number; until?: number }
export interface Sanction { from: string; to: string; level: number; start: number } // level 1..3
export interface War { id: string; attackers: string[]; defenders: string[]; start: number; score: number; goals: number[]; occupied: number[]; casualties: number; ceasefire?: boolean }
export interface Org { id: string; name: string; nameFr: string; kind: 'military' | 'economic' | 'political' | 'financial' | 'energy'; members: string[]; custom?: boolean; tag: Tag }

export interface Company {
  id: string; name: string; hq: string; sector: Sector; real: boolean; state: boolean;
  revenue: number; margin: number; marketCap: number; employees: number; rd: number; share: number; // share of home sector output
  alive: boolean; hist: number[]; // market cap history
  intl: string[]; // countries with operations
}

export interface Commodity { id: string; price: number; base: number; unit: string; hist: number[]; ref?: { price: number; date: string; src: string } }

export interface NewsItem {
  id: string; t: number; cat: string; key: string; params: Record<string, string | number>;
  countries: string[]; severity: number; // 1..3
  causes: string[]; effects: string[]; // i18n keys with params embedded via `key|param=value`
  prov: Prov; link?: { kind: 'country' | 'company' | 'market' | 'war' | 'org'; id: string };
}

export interface Holding { kind: 'equity' | 'bond' | 'commodity' | 'company'; id: string; units: number; cost: number }

export interface WorldState {
  version: number;
  scenario: string; scenarioName: string;
  seed: number; rng: number;
  t: number; // months since start
  startYear: number; startMonth: number; // calendar of t=0
  day: number; // 0..29 visual day within month
  player: string | null;
  countries: Record<string, Country>;
  territories: Territory[];
  treaties: Treaty[]; sanctions: Sanction[]; wars: War[]; orgs: Org[];
  rel: Record<string, number>; // sparse opinion "A|B" (sorted) -> -100..100 ; default derived
  companies: Company[];
  commodities: Record<string, Commodity>;
  global: { risk: number; demand: number; ecbRate: number; usRate: number; riskHist: number[]; climate: number; pandemic: number; oilPrev?: number; riskPrev?: number };
  news: NewsItem[];
  portfolio: { cash: number; holdings: Holding[]; history: number[] };
  watchlist: string[];
  settings: { aiEnabled: boolean; realDataMode: 'reference' | 'off'; difficulty: number; autosaveMonths: number };
  diverged: boolean; // true once the timeline left real-world reference
  log: { t: number; actor: string; action: string; ok: boolean; detail?: string }[];
  proposals: { from: string; to: string; treaty: string; t: number }[];
  chats: Record<string, { role: 'player' | 'them'; text: string; t: number; prov: Prov }[]>;
}
