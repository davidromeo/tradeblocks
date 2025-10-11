import { CsvTestDataLoader } from "../data/csv-loader";
import { runMonteCarloSimulation, type MonteCarloParams } from "@/lib/calculations/monte-carlo";

describe("Monte Carlo legacy comparison", () => {
 it("prints stats for legacy parameter set", async () => {
    const { trades } = await CsvTestDataLoader.loadTestData();

    const params: MonteCarloParams = {
      numSimulations: 1000,
      simulationLength: Math.min(252, trades.length),
      resampleMethod: "trades",
      initialCapital: trades[0]?.fundsAtClose - trades[0]?.pl ?? 100000,
      tradesPerYear: 125,
      randomSeed: 42,
    };

    const result = runMonteCarloSimulation(trades, params);

    expect(result.statistics).toMatchInlineSnapshot(`
{
  "meanAnnualizedReturn": 0.12127135124480794,
  "meanFinalValue": 4646170.810060007,
  "meanMaxDrawdown": 0.036990845311488094,
  "meanSharpeRatio": 2.2239415909815112,
  "meanTotalReturn": 0.26089713491389926,
  "medianAnnualizedReturn": 0.12229450511935136,
  "medianFinalValue": 4649763.850000003,
  "medianMaxDrawdown": 0.03476136833106309,
  "medianTotalReturn": 0.2618722290185265,
  "probabilityOfProfit": 0.999,
  "stdFinalValue": 301739.2143380576,
  "valueAtRisk": {
    "p10": 0.15736886951066184,
    "p25": 0.2057732842882098,
    "p5": 0.1295632260380985,
  },
}
`);
  });
});
