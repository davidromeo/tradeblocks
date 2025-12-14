import { getTradingDayKey } from "../lib/utils/trading-day";

// Simulate the scenario: Friday Evening Trade (ET)
// Date: 2023-10-27 (Friday)
// Time: 19:30:00 (7:30 PM ET) -> Should be Friday 2023-10-27
// Prior failure mode: treated as Saturday 2023-10-28 due to UTC shift

console.log("Verifying getTradingDayKey logic...");

const fridayDate = "2023-10-27";
const fridayTime = "19:30:00";
// Note: In Node (often UTC), "2023-10-27 19:30:00" might be parsed as local or UTC.
// getTradingDayKey uses new Date(composite) which uses local system time.
// Crucially, toZonedTime should handle the timezone conversion to NY.

const key = getTradingDayKey(fridayDate, fridayTime);
console.log(`Input: ${fridayDate} ${fridayTime}`);
console.log(`Generated Key: ${key}`);

if (key === "2023-10-27") {
  console.log("✅ SUCCESS: Key is Friday (2023-10-27)");
} else {
  console.error(`❌ FAILURE: Key is ${key} (Expected 2023-10-27)`);
  process.exit(1);
}

// Check fallback/empty
const emptyKey = getTradingDayKey("");
console.log(`Empty Input Key: ${emptyKey}`);
if (emptyKey === "1970-01-01") {
  console.log("✅ SUCCESS: Empty input returns fallback");
} else {
  console.error(`❌ FAILURE: Empty input returned ${emptyKey}`);
}
