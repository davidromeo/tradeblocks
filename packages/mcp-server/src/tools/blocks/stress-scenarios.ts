/**
 * Stress Test Scenarios
 *
 * Built-in market stress scenarios for stress_test tool.
 * All scenarios are post-2013 since backtests typically start there.
 */

/**
 * Built-in stress scenarios with date ranges and descriptions
 */
export const STRESS_SCENARIOS: Record<
  string,
  { startDate: string; endDate: string; description: string }
> = {
  // Crashes & Corrections
  china_deval_2015: {
    startDate: "2015-08-11",
    endDate: "2015-08-25",
    description: "China yuan devaluation, global selloff",
  },
  brexit: {
    startDate: "2016-06-23",
    endDate: "2016-06-27",
    description: "UK Brexit vote shock",
  },
  volmageddon: {
    startDate: "2018-02-02",
    endDate: "2018-02-09",
    description: "VIX spike, XIV blowup, largest VIX jump since 1987",
  },
  q4_2018: {
    startDate: "2018-10-01",
    endDate: "2018-12-24",
    description: "Fed rate hike selloff",
  },
  covid_crash: {
    startDate: "2020-02-19",
    endDate: "2020-03-23",
    description: "COVID-19 pandemic crash, peak to trough",
  },
  bear_2022: {
    startDate: "2022-01-03",
    endDate: "2022-10-12",
    description: "Fed tightening bear market",
  },
  svb_crisis: {
    startDate: "2023-03-08",
    endDate: "2023-03-15",
    description: "Silicon Valley Bank collapse, regional bank contagion",
  },
  vix_aug_2024: {
    startDate: "2024-08-01",
    endDate: "2024-08-15",
    description: "Yen carry trade unwind, VIX spike",
  },
  liberation_day: {
    startDate: "2025-04-02",
    endDate: "2025-04-08",
    description: "Trump tariffs, largest drop since COVID",
  },
  // Recoveries
  covid_recovery: {
    startDate: "2020-03-23",
    endDate: "2020-08-18",
    description: "V-shaped recovery from COVID crash",
  },
  liberation_recovery: {
    startDate: "2025-04-09",
    endDate: "2025-05-02",
    description: "Post 90-day tariff pause rally, S&P +9.5% single day",
  },
};
