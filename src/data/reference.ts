// Curated reference data. Every block carries its provenance so the UI can label it.
// "verified" = taken from a dated external source fetched while building this release.
// "estimate" = reasonable starting values from public reference publications, not live-verified.
import type { GovType, Sector, Tag } from '../sim/types';

export const BUILD_DATE = '2026-11-21';

// ---------- Real market reference snapshot (fetched 2026-11-21 via Alpha Vantage) ----------
export const MARKET_SNAPSHOT = {
  src: 'Alpha Vantage (free API)',
  fetched: '2026-11-21T15:10Z',
  brentMonthly: [
    ['2025-11', 63.8], ['2025-12', 62.54], ['2026-01', 66.6], ['2026-02', 70.89], ['2026-03', 103.13], ['2026-04', 117.29],
    ['2026-05', 107.14], ['2026-06', 85.4], ['2026-07', 83.76], ['2026-08', 91.08], ['2026-09', 114.16], ['2026-10', 123.93],
  ] as [string, number][],
  gold: { price: 3535.87, ts: '2026-11-21 15:10 UTC' },
  fx: [
    { pair: 'EUR/USD', rate: 1.09756, ts: '2026-11-21 15:10 UTC' },
    { pair: 'GBP/USD', rate: 1.30823, ts: '2026-11-21 15:10 UTC' },
    { pair: 'USD/JPY', rate: 158.513, ts: '2026-11-21 15:10 UTC' },
    { pair: 'USD/CNY', rate: 6.67726, ts: '2026-11-21 15:10 UTC' },
  ],
  unavailable: ['Stock index levels (S&P 500, CAC 40, DAX, Nikkei…) — premium endpoint on the free key; add your own key in Settings to fetch live.'],
};
// local currency units per USD, verified only for these
export const FX_REF: Record<string, number> = { EUR: 1 / 1.09756, GBP: 1 / 1.30823, JPY: 158.513, CNY: 6.67726, USD: 1 };

// ---------- Verified context for the contemporary scenario (sources checked 2026-11-21) ----------
export const CONTEXT_SOURCES = [
  { id: 'ukr', text: 'Russia–Ukraine war ongoing; peace talks held in Abu Dhabi on 10–11 Nov 2026.', src: 'Al Jazeera, 13 Nov 2026; ISW assessments, Nov 2026', url: 'https://www.aljazeera.com/news/2026/11/13/russias-demands-come-from-different-reality-as-war-efforts-stagnates' },
  { id: 'irn', text: 'US–Israel war with Iran since late Feb 2026; tanker attacks and Hormuz disruption keep Brent above $100.', src: 'AP via Jamaica Gleaner, 11 Sep 2026; Oil & Gas Journal, Sep 2026', url: 'https://jamaica-gleaner.com/article/business/20260911/oil-hits-above-us100-barrel-once-again' },
];
export const VERIFIED_LEADERS: Record<string, { hos?: string; hog?: string; src: string; date: string }> = {
  USA: { hos: 'Donald Trump', hog: 'Donald Trump', src: 'ISW, 18 Nov 2026', date: '2026-11-18' },
  RUS: { hos: 'Vladimir Putin', src: 'ISW, 14 Nov 2026', date: '2026-11-14' },
  UKR: { hos: 'Volodymyr Zelensky', src: 'ISW, 14 Nov 2026', date: '2026-11-14' },
  CHN: { hos: 'Xi Jinping', src: 'ISW, 18 Nov 2026', date: '2026-11-18' },
};

// ---------- Estimates where no bundled open dataset exists ----------
export const GDP_ESTIMATES: Record<string, { gdp: number; pop: number; note: string }> = {
  TWN: { gdp: 790000, pop: 23400000, note: 'IMF WEO-based estimate (2024 order of magnitude)' },
  PRK: { gdp: 25000, pop: 26200000, note: 'Rough external estimate; no official data' },
  VAT: { gdp: 300, pop: 800, note: 'Order-of-magnitude estimate' },
  ESH: { gdp: 900, pop: 600000, note: 'Order-of-magnitude estimate' },
};

const L = (s: string) => s.split(' ');
// EIU Democracy Index 2024 categories, approximate (estimate). Unlisted: flawed (Europe/Americas/Oceania) or hybrid.
export const GOV: Partial<Record<string, GovType>> = {};
const setGov = (g: GovType, list: string) => L(list).forEach((c) => (GOV[c] = g));
setGov('full_democracy', 'NOR NZL SWE ISL CHE FIN DNK IRL NLD AUS TWN URY LUX DEU CAN JPN GBR AUT CRI MUS EST ESP CZE GRC PRT');
setGov('one_party', 'CHN VNM LAO CUB PRK ERI');
setGov('absolute_monarchy', 'SAU OMN BRN SWZ QAT ARE BHR KWT');
setGov('theocracy', 'IRN AFG VAT');
setGov('authoritarian', 'RUS BLR TKM TJK UZB KAZ AZE SYR EGY LBY SDN SSD TCD CAF COD CMR GNQ COG BDI RWA ETH SOM DJI MLI BFA NER GIN MMR KHM NIC VEN YEM DZA PAK JOR TGO AGO MOZ ZWE HTI IRQ GAB');
setGov('hybrid', 'TUR UKR GEO ARM KGZ BGD NPL TUN MAR NGA KEN TZA UGA ZMB SEN BOL ECU SLV HND GTM MEX LBN SLE LBR MDG MWI CIV BEN MRT PNG FJI BIH SRB MNE MKD MDA ALB');
export const GOV_TAG: Tag = { prov: 'estimate', src: 'EIU Democracy Index 2024 categories (approximate)', date: '2024' };

// Military expenditure % GDP (SIPRI 2024 order of magnitude; estimate)
export const MIL_PCT: Record<string, number> = {
  USA: 3.4, CHN: 1.7, RUS: 7.1, IND: 2.3, SAU: 7.3, GBR: 2.3, DEU: 1.9, FRA: 2.1, JPN: 1.4, KOR: 2.6, UKR: 34, ISR: 8.8, POL: 4.2, ITA: 1.5, AUS: 2.0, CAN: 1.4,
  TUR: 1.9, ESP: 1.3, BRA: 1.0, IRN: 2.0, PAK: 2.7, DZA: 8.0, NLD: 2.0, TWN: 2.4, SGP: 2.8, GRC: 3.1, NOR: 2.2, SWE: 2.2, FIN: 2.4, EGY: 1.0, ARE: 5.0, QAT: 4.0,
  KWT: 4.5, OMN: 5.5, IRQ: 3.3, COL: 3.0, MEX: 0.8, IDN: 0.7, THA: 1.2, VNM: 2.0, MAR: 3.6, LTU: 3.1, LVA: 3.1, EST: 3.4, PRK: 25, BLR: 1.5, AZE: 5.0, ARM: 4.0,
};
export const MIL_TAG: Tag = { prov: 'estimate', src: 'SIPRI Military Expenditure Database 2024 (order of magnitude)', date: '2024' };
export const NUCLEAR = L('USA RUS CHN FRA GBR IND PAK ISR PRK');
export const RESERVE_CCY: Record<string, number> = { USD: 1, EUR: 0.7, JPY: 0.5, GBP: 0.5, CHF: 0.45, CNY: 0.3, CAD: 0.25, AUD: 0.25 };
export const EUROZONE = L('AUT BEL HRV CYP EST FIN FRA DEU GRC IRL ITA LVA LTU LUX MLT NLD PRT SVK SVN ESP BGR');

// ---------- International organizations (membership as of mid-2026; estimate where noted) ----------
const AFRICA_AU = L('DZA AGO BEN BWA BFA BDI CPV CMR CAF TCD COM COG COD CIV DJI EGY GNQ ERI SWZ ETH GAB GMB GHA GIN GNB KEN LSO LBR LBY MDG MWI MLI MRT MUS MAR MOZ NAM NER NGA RWA STP SEN SYC SLE SOM ZAF SSD SDN TZA TGO TUN UGA ZMB ZWE ESH');
export const ORGS: { id: string; name: string; nameFr: string; kind: 'military' | 'economic' | 'political' | 'financial' | 'energy'; members: string[] | 'UN' }[] = [
  { id: 'UN', name: 'United Nations', nameFr: 'Nations unies', kind: 'political', members: 'UN' },
  { id: 'NATO', name: 'NATO', nameFr: 'OTAN', kind: 'military', members: L('USA CAN GBR FRA DEU ITA ESP PRT NLD BEL LUX DNK NOR ISL POL CZE SVK HUN ROU BGR GRC TUR EST LVA LTU SVN HRV ALB MNE MKD FIN SWE') },
  { id: 'EU', name: 'European Union', nameFr: 'Union européenne', kind: 'economic', members: L('AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE') },
  { id: 'G7', name: 'G7', nameFr: 'G7', kind: 'political', members: L('USA JPN DEU GBR FRA ITA CAN') },
  { id: 'G20', name: 'G20', nameFr: 'G20', kind: 'financial', members: L('ARG AUS BRA CAN CHN FRA DEU IND IDN ITA JPN KOR MEX RUS SAU ZAF TUR GBR USA') },
  { id: 'BRICS', name: 'BRICS', nameFr: 'BRICS', kind: 'economic', members: L('BRA RUS IND CHN ZAF EGY ETH IRN ARE IDN') },
  { id: 'ASEAN', name: 'ASEAN', nameFr: 'ASEAN', kind: 'economic', members: L('BRN KHM IDN LAO MYS MMR PHL SGP THA VNM TLS') },
  { id: 'AU', name: 'African Union', nameFr: 'Union africaine', kind: 'political', members: AFRICA_AU },
  { id: 'OPEC', name: 'OPEC', nameFr: 'OPEP', kind: 'energy', members: L('DZA COG GNQ GAB IRN IRQ KWT LBY NGA SAU ARE VEN') },
  { id: 'SCO', name: 'Shanghai Cooperation Org.', nameFr: 'Org. de coopération de Shanghai', kind: 'political', members: L('CHN RUS IND PAK KAZ KGZ TJK UZB IRN BLR') },
  { id: 'CSTO', name: 'CSTO', nameFr: 'OTSC', kind: 'military', members: L('RUS BLR ARM KAZ KGZ TJK') },
  { id: 'MERCOSUR', name: 'Mercosur', nameFr: 'Mercosur', kind: 'economic', members: L('ARG BRA PRY URY BOL') },
  { id: 'GCC', name: 'Gulf Cooperation Council', nameFr: 'Conseil de coopération du Golfe', kind: 'economic', members: L('SAU ARE QAT KWT OMN BHR') },
  { id: 'USMCA', name: 'USMCA', nameFr: 'ACEUM', kind: 'economic', members: L('USA MEX CAN') },
  { id: 'IMF', name: 'International Monetary Fund', nameFr: 'Fonds monétaire international', kind: 'financial', members: 'UN' },
];
export const ORG_TAG: Tag = { prov: 'estimate', src: 'Official membership lists, model snapshot mid-2026 (verify)', date: '2026-06' };
// Bilateral defence treaties outside NATO (estimate)
export const DEFENSE_PACTS: [string, string][] = [['USA', 'JPN'], ['USA', 'KOR'], ['USA', 'PHL'], ['USA', 'AUS'], ['CHN', 'PRK'], ['RUS', 'PRK'], ['RUS', 'BLR'], ['USA', 'ISR']];
// Known hostile dyads at scenario start (relations seed; estimate)
export const HOSTILE: [string, string, number][] = [
  ['RUS', 'UKR', -95], ['USA', 'IRN', -95], ['ISR', 'IRN', -100], ['USA', 'RUS', -55], ['USA', 'CHN', -35], ['CHN', 'TWN', -60], ['IND', 'PAK', -60],
  ['KOR', 'PRK', -80], ['USA', 'PRK', -80], ['JPN', 'PRK', -70], ['GBR', 'RUS', -60], ['FRA', 'RUS', -55], ['DEU', 'RUS', -55], ['POL', 'RUS', -75],
  ['SAU', 'IRN', -50], ['ARM', 'AZE', -40], ['VEN', 'USA', -60], ['CUB', 'USA', -50], ['ISR', 'LBN', -60], ['CHN', 'JPN', -25], ['CHN', 'IND', -25],
];
export const FRIENDLY: [string, string, number][] = [
  ['RUS', 'CHN', 55], ['RUS', 'BLR', 85], ['RUS', 'PRK', 60], ['RUS', 'IRN', 50], ['USA', 'GBR', 75], ['USA', 'ISR', 80], ['USA', 'JPN', 70], ['USA', 'KOR', 65],
  ['FRA', 'DEU', 80], ['CHN', 'PAK', 70], ['CHN', 'PRK', 50], ['AUS', 'NZL', 85], ['USA', 'CAN', 55], ['IND', 'RUS', 40], ['SAU', 'ARE', 70], ['UKR', 'POL', 70], ['UKR', 'GBR', 70],
];

// ---------- Major corporations: names, HQ and sector are real reference facts; all financial values in-game are SIMULATED ----------
export const COMPANIES: [string, string, Sector][] = [
  ['Apple', 'USA', 'technology'], ['Microsoft', 'USA', 'technology'], ['Nvidia', 'USA', 'technology'], ['Alphabet', 'USA', 'telecom'], ['Amazon', 'USA', 'retail'],
  ['JPMorgan Chase', 'USA', 'finance'], ['ExxonMobil', 'USA', 'energy'], ['Boeing', 'USA', 'manufacturing'], ['Walmart', 'USA', 'retail'], ['UnitedHealth', 'USA', 'health'],
  ['Caterpillar', 'USA', 'manufacturing'], ['Freeport-McMoRan', 'USA', 'mining'], ['UPS', 'USA', 'logistics'], ['Marriott', 'USA', 'tourism'],
  ['TotalEnergies', 'FRA', 'energy'], ['LVMH', 'FRA', 'retail'], ['Airbus', 'FRA', 'manufacturing'], ['BNP Paribas', 'FRA', 'finance'], ['Sanofi', 'FRA', 'health'], ['Vinci', 'FRA', 'construction'], ['Orange', 'FRA', 'telecom'],
  ['Siemens', 'DEU', 'manufacturing'], ['Volkswagen', 'DEU', 'manufacturing'], ['SAP', 'DEU', 'technology'], ['Allianz', 'DEU', 'finance'], ['DHL Group', 'DEU', 'logistics'],
  ['Shell', 'GBR', 'energy'], ['HSBC', 'GBR', 'finance'], ['AstraZeneca', 'GBR', 'health'], ['Rio Tinto', 'GBR', 'mining'],
  ['Toyota', 'JPN', 'manufacturing'], ['Sony', 'JPN', 'technology'], ['Mitsubishi UFJ', 'JPN', 'finance'],
  ['Tencent', 'CHN', 'technology'], ['Alibaba', 'CHN', 'retail'], ['ICBC', 'CHN', 'finance'], ['CATL', 'CHN', 'manufacturing'], ['Sinopec', 'CHN', 'energy'], ['China State Construction', 'CHN', 'construction'], ['COSCO Shipping', 'CHN', 'logistics'],
  ['TSMC', 'TWN', 'technology'], ['Samsung Electronics', 'KOR', 'technology'], ['Hyundai Motor', 'KOR', 'manufacturing'],
  ['Saudi Aramco', 'SAU', 'energy'], ['Reliance Industries', 'IND', 'energy'], ['Tata Consultancy Services', 'IND', 'technology'], ['HDFC Bank', 'IND', 'finance'],
  ['Petrobras', 'BRA', 'energy'], ['Vale', 'BRA', 'mining'], ['Gazprom', 'RUS', 'energy'], ['Sberbank', 'RUS', 'finance'],
  ['Nestlé', 'CHE', 'agriculture'], ['Roche', 'CHE', 'health'], ['UBS', 'CHE', 'finance'], ['ASML', 'NLD', 'technology'], ['Shell Netherlands Ops', 'NLD', 'energy'],
  ['Novo Nordisk', 'DNK', 'health'], ['Maersk', 'DNK', 'logistics'], ['Equinor', 'NOR', 'energy'], ['BHP', 'AUS', 'mining'], ['Commonwealth Bank', 'AUS', 'finance'],
  ['Shopify', 'CAN', 'technology'], ['Royal Bank of Canada', 'CAN', 'finance'], ['Enel', 'ITA', 'energy'], ['Ferrari', 'ITA', 'manufacturing'], ['Iberdrola', 'ESP', 'energy'], ['Inditex', 'ESP', 'retail'],
  ['América Movil', 'MEX', 'telecom'], ['Naspers', 'ZAF', 'technology'], ['Dangote Group', 'NGA', 'construction'], ['Emirates Group', 'ARE', 'transport'], ['QatarEnergy', 'QAT', 'energy'],
  ['SQM', 'CHL', 'mining'], ['Codelco', 'CHL', 'mining'], ['Kazatomprom', 'KAZ', 'mining'], ['Pertamina', 'IDN', 'energy'], ['Turkish Airlines', 'TUR', 'transport'],
  ['Bunge', 'USA', 'agriculture'], ['Cargill', 'USA', 'agriculture'], ['Telefónica', 'ESP', 'telecom'],
];
export const STATE_OWNED = new Set(['Saudi Aramco', 'Sinopec', 'ICBC', 'China State Construction', 'COSCO Shipping', 'Petrobras', 'Gazprom', 'Sberbank', 'Equinor', 'QatarEnergy', 'Codelco', 'Kazatomprom', 'Pertamina', 'Emirates Group']);
// Strategic minerals: major producing countries (USGS Mineral Commodity Summaries, order of magnitude; estimate)
export const MINERAL_PRODUCERS: Record<string, number> = {
  CHL: 0.9, AUS: 0.9, CHN: 0.8, COD: 0.8, PER: 0.7, ZAF: 0.8, RUS: 0.7, IDN: 0.6, KAZ: 0.6, BRA: 0.6, CAN: 0.6, ARG: 0.4, BOL: 0.4, ZMB: 0.5, MNG: 0.5, GIN: 0.5, USA: 0.5, MEX: 0.4, NAM: 0.4, NER: 0.3, UZB: 0.3,
};
export const AGRI_PRODUCERS: Record<string, number> = { USA: 0.9, BRA: 0.95, ARG: 0.85, UKR: 0.8, RUS: 0.75, CAN: 0.7, AUS: 0.7, IND: 0.7, CHN: 0.6, FRA: 0.6, THA: 0.6, VNM: 0.55, IDN: 0.5, KAZ: 0.5, NZL: 0.6 };

// ---------- Commodities. Brent & gold start from the verified snapshot; others are simulated indices. ----------
export const COMMODITIES = [
  { id: 'brent', unit: '$/bbl', price: 123.93, ref: { price: 123.93, date: '2026-10 (monthly avg)', src: 'Alpha Vantage / EIA' } },
  { id: 'gas', unit: 'index', price: 100 },
  { id: 'gold', unit: '$/oz', price: 3535.87, ref: { price: 3535.87, date: '2026-11-21 15:10 UTC', src: 'Alpha Vantage' } },
  { id: 'silver', unit: 'index', price: 100 },
  { id: 'copper', unit: 'index', price: 100 },
  { id: 'lithium', unit: 'index', price: 100 },
  { id: 'uranium', unit: 'index', price: 100 },
  { id: 'wheat', unit: 'index', price: 100 },
  { id: 'corn', unit: 'index', price: 100 },
];
