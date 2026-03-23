import {
  evaluateTrigger,
  analyzeExitTriggers,
  type ExitTriggerConfig,
  type TriggerType,
} from '../../dist/utils/exit-triggers.js';
import type { PnlPoint, ReplayLeg, GreeksResult } from '../../dist/utils/trade-replay.js';

// Basic smoke test for TDD RED phase
describe('evaluateTrigger - smoke', () => {
  it('profitTarget fires when P&L >= threshold', () => {
    const path: PnlPoint[] = [
      { timestamp: '2026-01-05 09:30', strategyPnl: 0, legPrices: [5.0, 3.0] },
      { timestamp: '2026-01-05 09:31', strategyPnl: 100, legPrices: [5.5, 2.5] },
    ];
    const trigger: ExitTriggerConfig = { type: 'profitTarget', threshold: 100 };
    const legs: ReplayLeg[] = [
      { occTicker: 'SPY260105C00470000', quantity: 1, entryPrice: 5.0, multiplier: 100 },
      { occTicker: 'SPY260105C00465000', quantity: -1, entryPrice: 3.0, multiplier: 100 },
    ];
    const result = evaluateTrigger(trigger, path, legs);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('profitTarget');
    expect(result!.pnlAtFire).toBe(100);
  });
});
