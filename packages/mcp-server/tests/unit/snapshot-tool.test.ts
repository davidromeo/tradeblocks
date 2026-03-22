import { jest } from "@jest/globals";
import { handleGetOptionSnapshot } from "../../src/tools/snapshot.js";

/**
 * Unit tests for handleGetOptionSnapshot handler.
 * Uses injected fetcher to isolate from HTTP layer.
 */

function makeMockContract(overrides: Record<string, unknown> = {}) {
  return {
    ticker: "SPX251219C05000000",
    underlying_ticker: "SPX",
    underlying_price: 5234.56,
    contract_type: "call",
    strike: 5000,
    expiration: "2025-12-19",
    exercise_style: "european",
    delta: 0.45,
    gamma: 0.012,
    theta: -0.85,
    vega: 2.5,
    iv: 0.18,
    greeks_source: "massive" as const,
    bid: 12.5,
    ask: 13.5,
    midpoint: 13.0,
    last_price: 13.0,
    open_interest: 1500,
    volume: 500,
    break_even: 5050.0,
    ...overrides,
  };
}

function makeContracts(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeMockContract({ strike: 5000 + i })
  );
}

function makeMockFetcher(contracts: ReturnType<typeof makeMockContract>[]) {
  return jest.fn<() => Promise<{ contracts: typeof contracts; underlying_price: number; underlying_ticker: string }>>()
    .mockResolvedValue({
      contracts,
      underlying_price: 5234.56,
      underlying_ticker: "SPX",
    });
}

describe("handleGetOptionSnapshot", () => {
  it("returns JSON with underlying_ticker, underlying_price, contracts_returned, contracts_total, and contracts array", async () => {
    const contracts = makeContracts(10);
    const fetcher = makeMockFetcher(contracts);

    const output = await handleGetOptionSnapshot(
      { underlying: "SPX", limit: 50 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetcher as any
    );
    const parsed = JSON.parse(output);

    expect(parsed.underlying_ticker).toBe("SPX");
    expect(parsed.underlying_price).toBe(5234.56);
    expect(parsed.contracts_returned).toBe(10);
    expect(parsed.contracts_total).toBe(10);
    expect(Array.isArray(parsed.contracts)).toBe(true);
    expect(parsed.contracts).toHaveLength(10);
  });

  it("truncates contracts to limit when fetchOptionSnapshot returns more", async () => {
    const contracts = makeContracts(100);
    const fetcher = makeMockFetcher(contracts);

    const output = await handleGetOptionSnapshot(
      { underlying: "SPX", limit: 50 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetcher as any
    );
    const parsed = JSON.parse(output);

    expect(parsed.contracts_returned).toBe(50);
    expect(parsed.contracts_total).toBe(100);
    expect(parsed.contracts).toHaveLength(50);
  });

  it("applies limit truncation when explicit limit is provided", async () => {
    const contracts = makeContracts(80);
    const fetcher = makeMockFetcher(contracts);

    const output = await handleGetOptionSnapshot(
      { underlying: "SPX", limit: 25 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetcher as any
    );
    const parsed = JSON.parse(output);

    expect(parsed.contracts_returned).toBe(25);
    expect(parsed.contracts_total).toBe(80);
    expect(parsed.contracts).toHaveLength(25);
  });

  it("returns error JSON when fetchOptionSnapshot throws", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetcher = jest.fn<() => Promise<any>>()
      .mockRejectedValue(new Error("MASSIVE_API_KEY environment variable is not set"));

    const output = await handleGetOptionSnapshot(
      { underlying: "SPX", limit: 50 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetcher as any
    );
    const parsed = JSON.parse(output);

    expect(parsed.error).toBe("MASSIVE_API_KEY environment variable is not set");
    expect(parsed.contracts).toBeUndefined();
  });

  it("preserves all OptionContract fields in output contracts", async () => {
    const contract = makeMockContract();
    const fetcher = makeMockFetcher([contract]);

    const output = await handleGetOptionSnapshot(
      { underlying: "SPX", limit: 50 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetcher as any
    );
    const parsed = JSON.parse(output);
    const c = parsed.contracts[0];

    expect(c.ticker).toBe("SPX251219C05000000");
    expect(c.strike).toBe(5000);
    expect(c.delta).toBe(0.45);
    expect(c.greeks_source).toBe("massive");
    expect(c.bid).toBe(12.5);
    expect(c.open_interest).toBe(1500);
  });
});
