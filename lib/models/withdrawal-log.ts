export interface WithdrawalDailyRow {
  date: Date;
  pl?: number; // daily P/L in dollars
  plPct?: number; // daily return as decimal, e.g. 0.0123 for 1.23%
  drawdownPct?: number; // not strictly needed for sim, but useful

  // Added for rigorous return calculation
  currentFunds?: number;
  totalWithdrawn?: number;
}
