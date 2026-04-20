import { jest } from "@jest/globals";
import {
  ThetaDataProvider,
  fetchOptionHistoryQuoteGroups,
} from "../../../src/utils/providers/thetadata.js";

const provider = new ThetaDataProvider();
const ORIG_ENV = process.env;
let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "application/json" },
  });
}

function mockTextResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * Mock an NDJSON streaming response — one JSON object per line, no trailing
 * newline. Used by `streamThetaNdjson` consumers (e.g. `fetchOptionHistoryQuoteGroups`)
 * which read response.body chunk-by-chunk to avoid V8's 512MB string cap.
 */
function mockNdjsonResponse(rows: unknown[], status = 200): Response {
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  return new Response(body, {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

beforeEach(() => {
  process.env = {
    ...ORIG_ENV,
    THETADATA_SKIP_AUTO_START: "1",
    THETADATA_BASE_URL: "http://127.0.0.1:25503",
    THETADATA_RETRY_BASE_MS: "0",
  };
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  process.env = ORIG_ENV;
  jest.restoreAllMocks();
});

describe("ThetaDataProvider.fetchQuotes", () => {
  it("builds option quote history URL from OCC ticker and returns minute quotes", async () => {
    fetchSpy.mockResolvedValueOnce(mockJsonResponse([
      {
        symbol: "SPX",
        expiration: "2024-03-15",
        strike: 200,
        right: "call",
        timestamp: "2024-03-01T09:30:00.000",
        bid: 1.1,
        ask: 1.3,
      },
      {
        symbol: "SPX",
        expiration: "2024-03-15",
        strike: 200,
        right: "call",
        timestamp: "2024-03-01T09:30:59.000",
        bid: 1.2,
        ask: 1.4,
      },
    ]));

    const quotes = await provider.fetchQuotes("SPX240315C00200000", "2024-03-01", "2024-03-01");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/v3/option/history/quote");
    expect(url).toContain("symbol=SPX");
    expect(url).toContain("expiration=20240315");
    expect(url).toContain("strike=200.000");
    expect(url).toContain("right=call");
    expect(url).toContain("date=20240301");
    expect(url).toContain("interval=1m");
    expect(quotes.get("2024-03-01 09:30")).toEqual({ bid: 1.2, ask: 1.4 });
  });

  it("surfaces plain-text entitlement errors from ThetaTerminal", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockTextResponse("Requesting an option endpoint requiring a value subscription")
    );

    await expect(
      provider.fetchQuotes("SPX240315C00200000", "2024-03-01", "2024-03-01")
    ).rejects.toThrow("Requesting an option endpoint requiring a value subscription");
  });

  it("retries retryable ThetaData 429 responses and then succeeds", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response("OS request throttled", {
          status: 429,
          statusText: "429",
          headers: { "Content-Type": "text/plain" },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({
        response: [
          {
            contract: {
              symbol: "SPX",
              expiration: "2024-03-15",
              strike: 200,
              right: "CALL",
            },
            data: [
              {
                timestamp: "2024-03-01T09:30:00.000",
                bid: 1.1,
                ask: 1.3,
              },
            ],
          },
        ],
      }));

    const quotes = await provider.fetchQuotes("SPX240315C00200000", "2024-03-01", "2024-03-01");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(quotes.get("2024-03-01 09:30")).toEqual({ bid: 1.1, ask: 1.3 });
  });

  it("preserves ThetaData error labels for non-retryable terminal errors", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("You cannot switch between 127.0.0.1 and localhost", {
        status: 476,
        statusText: "476",
        headers: { "Content-Type": "text/plain" },
      })
    );

    await expect(
      provider.fetchQuotes("SPX240315C00200000", "2024-03-01", "2024-03-01")
    ).rejects.toThrow("ThetaData 476 WRONG_IP");
  });
});

describe("fetchOptionHistoryQuoteGroups", () => {
  it("requests NDJSON format and groups two quotes from one contract", async () => {
    fetchSpy.mockResolvedValueOnce(mockNdjsonResponse([
      {
        symbol: "SPXW",
        expiration: "20220808",
        strike: 4165,
        right: "P",
        timestamp: "2022-08-02T09:30:00.000",
        bid: 80.6,
        ask: 81.4,
      },
      {
        symbol: "SPXW",
        expiration: "20220808",
        strike: 4165,
        right: "P",
        timestamp: "2022-08-02T09:31:00.000",
        bid: 77.0,
        ask: 77.7,
      },
    ]));

    const groups = await fetchOptionHistoryQuoteGroups({
      symbol: "SPXW",
      date: "2022-08-02",
      expiration: "*",
      strike: "*",
      right: "put",
      interval: "1m",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/v3/option/history/quote");
    expect(url).toContain("expiration=*");
    expect(url).toContain("strike=*");
    expect(url).toContain("format=ndjson");
    expect(groups).toEqual([
      {
        symbol: "SPXW",
        expiration: "2022-08-08",
        strike: 4165,
        right: "put",
        data: [
          {
            timestamp: "2022-08-02T09:30:00.000",
            bid: 80.6,
            ask: 81.4,
          },
          {
            timestamp: "2022-08-02T09:31:00.000",
            bid: 77,
            ask: 77.7,
          },
        ],
      },
    ]);
  });

  it("groups flat NDJSON wildcard rows by contract identity", async () => {
    fetchSpy.mockResolvedValueOnce(mockNdjsonResponse([
      {
        symbol: "SPXW",
        expiration: "20220808",
        strike: 4165,
        right: "P",
        timestamp: "2022-08-02T09:30:00.000",
        bid: 80.6,
        ask: 81.4,
      },
      {
        symbol: "SPXW",
        expiration: "20220808",
        strike: 4165,
        right: "P",
        timestamp: "2022-08-02T09:31:00.000",
        bid: 77.0,
        ask: 77.7,
      },
      {
        symbol: "SPXW",
        expiration: "20220808",
        strike: 4170,
        right: "P",
        timestamp: "2022-08-02T09:30:00.000",
        bid: 82.1,
        ask: 82.8,
      },
    ]));

    const groups = await fetchOptionHistoryQuoteGroups({
      symbol: "SPXW",
      date: "2022-08-02",
      expiration: "*",
      strike: "*",
      right: "put",
      interval: "1m",
    });

    expect(groups).toEqual([
      {
        symbol: "SPXW",
        expiration: "2022-08-08",
        strike: 4165,
        right: "put",
        data: [
          {
            timestamp: "2022-08-02T09:30:00.000",
            bid: 80.6,
            ask: 81.4,
          },
          {
            timestamp: "2022-08-02T09:31:00.000",
            bid: 77,
            ask: 77.7,
          },
        ],
      },
      {
        symbol: "SPXW",
        expiration: "2022-08-08",
        strike: 4170,
        right: "put",
        data: [
          {
            timestamp: "2022-08-02T09:30:00.000",
            bid: 82.1,
            ask: 82.8,
          },
        ],
      },
    ]);
  });
});

describe("ThetaDataProvider.fetchContractList", () => {
  it("maps listed contracts to OCC tickers and filters by expiration range", async () => {
    fetchSpy
      .mockResolvedValueOnce(mockJsonResponse([]))
      .mockResolvedValueOnce(mockJsonResponse([
        { symbol: "SPXW", expiration: "2024-03-15", strike: 200, right: "call" },
        { symbol: "SPXW", expiration: "2024-04-19", strike: 210, right: "put" },
      ]));

    const result = await provider.fetchContractList({
      underlying: "SPX",
      as_of: "2024-03-01",
      expired: true,
      expiration_date_gte: "2024-03-10",
      expiration_date_lte: "2024-03-31",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstUrl = String(fetchSpy.mock.calls[0][0]);
    const secondUrl = String(fetchSpy.mock.calls[1][0]);
    expect(firstUrl).toContain("/v3/option/list/contracts/quote");
    expect(firstUrl).toContain("symbol=SPX");
    expect(secondUrl).toContain("symbol=SPXW");
    expect(secondUrl).toContain("date=20240301");
    expect(secondUrl).toContain("max_dte=30");
    expect(result.contracts).toEqual([
      {
        ticker: "SPXW240315C00200000",
        contract_type: "call",
        strike: 200,
        expiration: "2024-03-15",
        exercise_style: "european",
      },
    ]);
  });
});

describe("ThetaDataProvider.fetchBars", () => {
  it("maps option intraday OHLC rows", async () => {
    fetchSpy.mockResolvedValueOnce(mockJsonResponse([
      {
        symbol: "SPX",
        expiration: "2024-03-15",
        strike: 200,
        right: "call",
        timestamp: "2024-03-01T09:30:00.000",
        open: 1.1,
        high: 1.5,
        low: 1.0,
        close: 1.4,
        volume: 25,
      },
    ]));

    const rows = await provider.fetchBars({
      ticker: "SPX240315C00200000",
      from: "2024-03-01",
      to: "2024-03-01",
      timespan: "minute",
      multiplier: 5,
      assetClass: "option",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/v3/option/history/ohlc");
    expect(url).toContain("interval=5m");
    expect(rows).toEqual([
      {
        date: "2024-03-01",
        time: "09:30",
        open: 1.1,
        high: 1.5,
        low: 1,
        close: 1.4,
        volume: 25,
        ticker: "SPX240315C00200000",
      },
    ]);
  });

  it("maps index daily EOD rows including bid/ask", async () => {
    fetchSpy.mockResolvedValueOnce(mockJsonResponse([
      {
        date: "2024-03-01",
        open: 5100,
        high: 5110,
        low: 5090,
        close: 5105,
        volume: 0,
        bid: 5104.5,
        ask: 5105.5,
      },
    ]));

    const rows = await provider.fetchBars({
      ticker: "SPX",
      from: "2024-03-01",
      to: "2024-03-01",
      assetClass: "index",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/v3/index/history/eod");
    expect(rows).toEqual([
      {
        date: "2024-03-01",
        open: 5100,
        high: 5110,
        low: 5090,
        close: 5105,
        volume: 0,
        ticker: "SPX",
        bid: 5104.5,
        ask: 5105.5,
      },
    ]);
  });

  it("returns empty bars when ThetaData responds with 472 no-data", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("No data found for your request", {
        status: 472,
        statusText: "472",
        headers: { "Content-Type": "application/json" },
      })
    );

    const rows = await provider.fetchBars({
      ticker: "SPXW240315C00200000",
      from: "2024-03-01",
      to: "2024-03-01",
      timespan: "minute",
      multiplier: 1,
      assetClass: "option",
    });

    expect(rows).toEqual([]);
  });

  it("returns empty bars when ThetaData responds with 472 no-data plus symbology note", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        "No data found for your request. Note: Index options have special symbols.",
        {
          status: 472,
          statusText: "472",
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const rows = await provider.fetchBars({
      ticker: "SPX240315P06700000",
      from: "2024-03-01",
      to: "2024-03-01",
      timespan: "minute",
      multiplier: 1,
      assetClass: "option",
    });

    expect(rows).toEqual([]);
  });

  it("emits start_date+end_date (not date=) for single-day index OHLC requests", async () => {
    fetchSpy.mockResolvedValueOnce(mockJsonResponse([]));

    await provider.fetchBars({
      ticker: "SPX",
      from: "2024-08-05",
      to: "2024-08-05",
      timespan: "minute",
      multiplier: 1,
      assetClass: "index",
    });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/v3/index/history/ohlc");
    expect(url).toContain("start_date=20240805");
    expect(url).toContain("end_date=20240805");
    expect(url).not.toMatch(/[?&]date=20240805/);
  });

  it("emits start_date+end_date (not date=) for single-day option OHLC requests", async () => {
    fetchSpy.mockResolvedValueOnce(mockJsonResponse([]));

    await provider.fetchBars({
      ticker: "SPX240315C00200000",
      from: "2024-03-01",
      to: "2024-03-01",
      timespan: "minute",
      multiplier: 1,
      assetClass: "option",
    });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/v3/option/history/ohlc");
    expect(url).toContain("start_date=20240301");
    expect(url).toContain("end_date=20240301");
    expect(url).not.toMatch(/[?&]date=20240301/);
  });
});

describe("ThetaDataProvider.fetchOptionSnapshot", () => {
  it("combines first-order greeks, open interest, and trades into snapshot contracts", async () => {
    fetchSpy
      .mockResolvedValueOnce(mockJsonResponse([
        {
          symbol: "SPXW",
          expiration: "2024-03-15",
          strike: 200,
          right: "call",
          timestamp: "2024-03-01T10:00:00.000",
          bid: 1.1,
          ask: 1.3,
          delta: 0.42,
          theta: "-0.08",
          vega: 0.11,
          implied_vol: 0.19,
          underlying_price: 5035.2,
        },
      ]))
      .mockResolvedValueOnce(mockJsonResponse([
        {
          symbol: "SPXW",
          expiration: "2024-03-15",
          strike: 200,
          right: "call",
          open_interest: 1234,
        },
      ]))
      .mockResolvedValueOnce(mockJsonResponse([
        {
          symbol: "SPXW",
          expiration: "2024-03-15",
          strike: 200,
          right: "call",
          price: 1.25,
          size: 10,
        },
      ]));

    const result = await provider.fetchOptionSnapshot({
      underlying: "SPX",
      contract_type: "call",
      expiration_date_gte: "2024-03-01",
      expiration_date_lte: "2024-03-31",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/v3/option/snapshot/greeks/first_order");
    expect(String(fetchSpy.mock.calls[1][0])).toContain("/v3/option/snapshot/open_interest");
    expect(String(fetchSpy.mock.calls[2][0])).toContain("/v3/option/snapshot/trade");
    expect(result.underlying_ticker).toBe("SPX");
    expect(result.underlying_price).toBe(5035.2);
    expect(result.contracts).toEqual([
      {
        ticker: "SPXW240315C00200000",
        underlying_ticker: "SPX",
        underlying_price: 5035.2,
        contract_type: "call",
        strike: 200,
        expiration: "2024-03-15",
        exercise_style: "european",
        delta: 0.42,
        gamma: null,
        theta: -0.08,
        vega: 0.11,
        iv: 0.19,
        greeks_source: "thetadata",
        bid: 1.1,
        ask: 1.3,
        midpoint: 1.2,
        last_price: 1.25,
        open_interest: 1234,
        volume: 0,
        break_even: 201.2,
      },
    ]);
  });
});
