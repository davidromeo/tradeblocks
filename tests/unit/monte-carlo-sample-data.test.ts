import { CsvTestDataLoader } from "../data/csv-loader";
import { runMonteCarloSimulation, type MonteCarloParams } from "@/lib/calculations/monte-carlo";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";

/**
 * Integration test that runs the Monte Carlo simulator against the real CSV sample data.
 * This acts as a regression safety net for the risk simulator when fed with actual trade history.
 */
describe("Monte Carlo Simulation (sample data)", () => {
  it("produces deterministic statistics for the provided trade log", async () => {
    const testData = await CsvTestDataLoader.loadTestData();

    expect(testData.sources.trades).toBe("csv");
    const { trades } = testData;

    const initialCapital = PortfolioStatsCalculator.calculateInitialCapital(trades);

    const params: MonteCarloParams = {
      numSimulations: 200,
      simulationLength: Math.min(120, trades.length),
      resampleMethod: "trades",
      initialCapital,
      tradesPerYear: 252,
      randomSeed: 42,
    };

    const result = runMonteCarloSimulation(trades, params);

    expect(result.statistics).toMatchInlineSnapshot(`
{
  "meanAnnualizedReturn": 3.198050032676915,
  "meanFinalValue": 966776.0379000002,
  "meanMaxDrawdown": 0.20977232088667655,
  "meanSharpeRatio": 3.330841942843971,
  "meanTotalReturn": 0.9352172915750541,
  "medianAnnualizedReturn": 2.9882793739585547,
  "medianFinalValue": 965343.5900000001,
  "medianMaxDrawdown": 0.1873018494954539,
  "medianTotalReturn": 0.9323499284664468,
  "probabilityOfProfit": 0.99,
  "stdFinalValue": 200530.08553329247,
  "valueAtRisk": {
    "p10": 0.5190873923193438,
    "p25": 0.6619996974997029,
    "p5": 0.2449221606207716,
  },
}
`);
  });
});
