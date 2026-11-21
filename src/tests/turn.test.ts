import { newGame } from '../sim/scenarios';
import { endTurn, queueOrder, ordersLeft } from '../sim/turn';
import { parseOrders } from '../ai/agents';
import { perform } from '../sim/actions';

describe('turn-based loop', () => {
  it('queues at most 3 orders, resolves them, jumps time and reports', async () => {
    const w = newGame('contemporary', 'FRA');
    expect(queueOrder(w, { actions: [{ type: 'proposeTreaty', target: 'MAR', treaty: 'fta' }], source: 'ui' })).toBeTruthy();
    expect(queueOrder(w, { actions: [{ type: 'mobilize' }], source: 'ui' })).toBeTruthy();
    expect(queueOrder(w, { actions: [{ type: 'custom', text: 'Launch a national space programme', effects: [{ target: 'FRA', stat: 'tech', value: 99 }, { target: 'FRA', stat: 'approval', value: 4 }] }], source: 'ai' })).toBeTruthy();
    expect(queueOrder(w, { actions: [{ type: 'propaganda' }], source: 'ui' })).toBeNull();
    expect(ordersLeft(w)).toBe(0);
    const tech0 = w.countries.FRA.tech;
    w.turn.jump = 3;
    const r = await endTurn(w);
    expect(w.t).toBe(3); expect(w.turn.n).toBe(2); expect(w.turn.orders.length).toBe(0);
    expect(r.orders.length).toBe(3); expect(r.deltas.length).toBeGreaterThan(5); expect(r.tips.length).toBeGreaterThan(0);
    // the custom effect was clamped to +1.5 tech, not +99
    expect(w.countries.FRA.tech - tech0).toBeLessThan(3);
    console.log(r.orders.map((o) => o.text + ' => ' + o.results.map((x) => x.key).join(',')).join('\n'));
    console.log('tips', r.tips.map((x) => x.key).join(','), 'headlines', r.headlines.length);
  });
  it('parses PAX-style free orders', () => {
    const w = newGame('contemporary', 'FRA');
    expect(parseOrders(w, 'FRA', 'Secretly support the separatist movement in Spain').map((a) => a.type)).toEqual(['supportSeparatists']);
    expect(parseOrders(w, 'FRA', 'Mobiliser l’armée').map((a) => a.type)).toEqual(['mobilize']);
    expect(parseOrders(w, 'FRA', 'Lancer une opération d’espionnage contre la Russie').map((a) => a.type)).toEqual(['covertOp']);
    expect(perform(w, 'FRA', { type: 'covertOp', target: 'RUS' }).ok).toBe(true);
  });
});
