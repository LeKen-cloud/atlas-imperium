import { newGame } from '../sim/scenarios';
import { parseOrders, findCountries, executeOrder } from '../ai/agents';
import { analyze } from '../ai/analyst';
import { DEFAULT_AI } from '../ai/llm';
import { tick } from '../sim/engine';
const w = newGame('contemporary', 'FRA');
describe('orders & analyst (no LLM)', () => {
  it('finds countries without false positives', () => {
    expect(findCountries(w, 'cut taxes and propose a free trade agreement to Japan')).toEqual(['JPN']);
    expect(findCountries(w, 'proposer un accord de libre-échange à l’Allemagne et au Brésil')).toEqual(['DEU', 'BRA']);
  });
  it('parses EN and FR orders', () => {
    const a = parseOrders(w, 'FRA', 'Cut corporate tax to 20% and invest in railways, then propose a free trade agreement to Japan');
    expect(a.map((x) => x.type)).toEqual(['setPolicy', 'setSpending', 'proposeTreaty']);
    const b = parseOrders(w, 'FRA', 'Sanctionner la Russie et augmenter le budget de la défense');
    expect(b.map((x) => x.type).sort()).toEqual(['sanction', 'setSpending']);
  });
  it('executes with rule fallback when the model is offline', async () => {
    const r = await executeOrder(w, 'FRA', 'raise tariffs to 12%', { ...DEFAULT_AI, enabled: false }, 'en', false);
    expect(r.source).toBe('rules'); expect(w.countries.FRA.policy.tariff).toBe(12);
  });
  it('analyst answers every question type in both languages', () => {
    for (let i = 0; i < 13; i++) tick(w);
    for (const q of ['Why is the currency weakening?', 'Which industries drive growth?', 'Which countries are most exposed to an energy crisis?', 'How would higher interest rates affect this economy?', 'What are the main risks to the financial system?', 'Which economies are becoming more competitive?']) {
      const a = analyze(w, 'TUR', q, 'en'); expect(a.facts.length + (a.ranking?.length || 0)).toBeGreaterThan(0);
      const f = analyze(w, 'JPN', q, 'fr'); expect(f.interpretation.length).toBeGreaterThan(0);
    }
  });
});
