import { calculateCorrelationMatrix } from '@/lib/calculations/correlation';
import { Trade } from '@/lib/models/trade';

describe('Correlation Calculations', () => {
  it('should match pandas pearson correlation', () => {
    // Test data matching Python example
    const trades: Trade[] = [
      // Strategy1: [100, 200, -50, 0, 150]
      { dateOpened: new Date('2025-01-01'), strategy: 'Strategy1', pl: 100 } as Trade,
      { dateOpened: new Date('2025-01-02'), strategy: 'Strategy1', pl: 200 } as Trade,
      { dateOpened: new Date('2025-01-03'), strategy: 'Strategy1', pl: -50 } as Trade,
      { dateOpened: new Date('2025-01-04'), strategy: 'Strategy1', pl: 0 } as Trade,
      { dateOpened: new Date('2025-01-05'), strategy: 'Strategy1', pl: 150 } as Trade,

      // Strategy2: [90, 210, -40, 10, 140]
      { dateOpened: new Date('2025-01-01'), strategy: 'Strategy2', pl: 90 } as Trade,
      { dateOpened: new Date('2025-01-02'), strategy: 'Strategy2', pl: 210 } as Trade,
      { dateOpened: new Date('2025-01-03'), strategy: 'Strategy2', pl: -40 } as Trade,
      { dateOpened: new Date('2025-01-04'), strategy: 'Strategy2', pl: 10 } as Trade,
      { dateOpened: new Date('2025-01-05'), strategy: 'Strategy2', pl: 140 } as Trade,

      // Strategy3: [-100, 50, 200, -30, 80]
      { dateOpened: new Date('2025-01-01'), strategy: 'Strategy3', pl: -100 } as Trade,
      { dateOpened: new Date('2025-01-02'), strategy: 'Strategy3', pl: 50 } as Trade,
      { dateOpened: new Date('2025-01-03'), strategy: 'Strategy3', pl: 200 } as Trade,
      { dateOpened: new Date('2025-01-04'), strategy: 'Strategy3', pl: -30 } as Trade,
      { dateOpened: new Date('2025-01-05'), strategy: 'Strategy3', pl: 80 } as Trade,
    ];

    const result = calculateCorrelationMatrix(trades, 'pearson');

    console.log('Strategies:', result.strategies);
    console.log('Correlation Matrix:');
    result.correlationData.forEach((row, i) => {
      console.log(`${result.strategies[i]}:`, row.map(v => v.toFixed(6)));
    });

    // Expected values from pandas
    // Strategy1 x Strategy2 = 0.994914
    // Strategy1 x Strategy3 = -0.296639
    // Strategy2 x Strategy3 = -0.264021

    expect(result.strategies).toEqual(['Strategy1', 'Strategy2', 'Strategy3']);

    // Check diagonal (should be 1.0)
    expect(result.correlationData[0][0]).toBeCloseTo(1.0, 6);
    expect(result.correlationData[1][1]).toBeCloseTo(1.0, 6);
    expect(result.correlationData[2][2]).toBeCloseTo(1.0, 6);

    // Check Strategy1 x Strategy2
    expect(result.correlationData[0][1]).toBeCloseTo(0.994914, 5);
    expect(result.correlationData[1][0]).toBeCloseTo(0.994914, 5);

    // Check Strategy1 x Strategy3
    expect(result.correlationData[0][2]).toBeCloseTo(-0.296639, 5);
    expect(result.correlationData[2][0]).toBeCloseTo(-0.296639, 5);

    // Check Strategy2 x Strategy3
    expect(result.correlationData[1][2]).toBeCloseTo(-0.264021, 5);
    expect(result.correlationData[2][1]).toBeCloseTo(-0.264021, 5);
  });
});
