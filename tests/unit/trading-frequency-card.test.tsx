import { render, screen } from "@testing-library/react";
import { TradingFrequencyCard } from "@/components/risk-simulator/trading-frequency-card";
import { Trade } from "@/lib/models/trade";

const SUMMARY_TEST_ID = "frequency-summary";
const RATE_TEST_ID = "frequency-rate";

function createMockTrades(count: number, startDate: Date, endDate: Date): Trade[] {
  if (count === 0) {
    return [];
  }

  const trades: Trade[] = [];
  const span = endDate.getTime() - startDate.getTime();

  for (let i = 0; i < count; i++) {
    const progress = count === 1 ? 0 : i / (count - 1);
    const date = new Date(startDate.getTime() + span * progress);
    trades.push({
      dateOpened: date,
      dateClosed: date,
      timeOpened: "09:30:00",
      timeClosed: "10:30:00",
      openingPrice: 100,
      closingPrice: 101,
      legs: "SPY 100C",
      premium: 500,
      strategy: "Test Strategy",
      numContracts: 1,
      pl: 1,
      openingCommissionsFees: 0,
      closingCommissionsFees: 0,
      fundsAtClose: 100001,
      marginReq: 1000,
      openingShortLongRatio: 1.0,
    });
  }

  return trades;
}

describe("TradingFrequencyCard", () => {
  it("shows annual frequency details for a regular trader", () => {
    const trades = createMockTrades(252, new Date("2023-01-01"), new Date("2024-01-01"));

    render(<TradingFrequencyCard trades={trades} tradesPerYear={252} />);

    expect(screen.getByText("trades/year")).toBeInTheDocument();
    expect(screen.getByTestId(RATE_TEST_ID)).toHaveTextContent("21 trades/month");
    expect(screen.getByTestId(SUMMARY_TEST_ID)).toHaveTextContent(/252 trades over/i);
  });

  it("shows daily rate for a high-frequency trader", () => {
    const trades = createMockTrades(800, new Date("2024-01-01"), new Date("2024-01-31"));

    render(<TradingFrequencyCard trades={trades} tradesPerYear={10400} />);

    expect(screen.getByTestId(RATE_TEST_ID)).toHaveTextContent(/40 trades\/day/i);
    expect(screen.getByTestId(SUMMARY_TEST_ID)).toHaveTextContent(/800 trades over/i);
  });

  it("shows weekly rate for an active trader", () => {
    const trades = createMockTrades(1000, new Date("2023-01-01"), new Date("2023-06-30"));

    render(<TradingFrequencyCard trades={trades} tradesPerYear={2000} />);

    expect(screen.getByTestId(RATE_TEST_ID)).toHaveTextContent(/38 trades\/week/i);
    expect(screen.getByTestId(SUMMARY_TEST_ID)).toHaveTextContent(/1,000 trades over/i);
  });

  it("shows yearly rate for an occasional trader", () => {
    const trades = createMockTrades(100, new Date("2022-01-01"), new Date("2024-01-01"));

    render(<TradingFrequencyCard trades={trades} tradesPerYear={50} />);

    expect(screen.getByTestId(RATE_TEST_ID)).toHaveTextContent(/50 trades\/year/i);
    expect(screen.getByTestId(SUMMARY_TEST_ID)).toHaveTextContent(/100 trades over/i);
  });

  it("handles minimal trade history", () => {
    const trades = createMockTrades(1, new Date("2024-01-01"), new Date("2024-01-01"));

    render(<TradingFrequencyCard trades={trades} tradesPerYear={252} />);

    expect(screen.getByTestId(SUMMARY_TEST_ID)).toHaveTextContent(/1 trade over/i);
    expect(screen.getByTestId(RATE_TEST_ID)).toHaveTextContent(/21 trades\/month/i);
  });

  it("handles empty trade history", () => {
    render(<TradingFrequencyCard trades={[]} tradesPerYear={252} />);

    expect(screen.getByTestId(SUMMARY_TEST_ID)).toHaveTextContent(/0 trades over/i);
    expect(screen.getByTestId(RATE_TEST_ID)).toHaveTextContent(/21 trades\/month/i);
  });
});
