import { truncateStrategyName } from "@tradeblocks/lib";

describe("truncateStrategyName", () => {
  it("should not truncate short strategy names", () => {
    const shortName = "short name";
    expect(truncateStrategyName(shortName)).toBe(shortName);
  });

  it("should truncate long strategy names at 40 characters by default", () => {
    const longName =
      "move downic super long description that makes the correlation chart look really bad because the strategy name is really really long so we can test truncating it";
    const result = truncateStrategyName(longName);
    expect(result).toBe("move downic super long description that ...");
    expect(result.length).toBe(43); // 40 + "..."
  });

  it("should not truncate strategy names exactly at the max length", () => {
    const exactName = "exactly forty characters in this name!!"; // 40 chars
    expect(truncateStrategyName(exactName)).toBe(exactName);
  });

  it("should handle empty strings", () => {
    expect(truncateStrategyName("")).toBe("");
  });

  it("should respect custom max length parameter", () => {
    const name = "this is a test strategy name";
    const result = truncateStrategyName(name, 10);
    expect(result).toBe("this is a ...");
  });

  it("should handle strategy names from test data", () => {
    const strategyNames = [
      "chudfly long",
      "Spx sps",
      "move downic super long description that makes the correlation chart look really bad because the strategy name is really really long so we can test truncating it",
      "2 weekly new v",
      "11:00 Next day",
      "updated ric",
      "Put hedge",
    ];

    strategyNames.forEach((name) => {
      const truncated = truncateStrategyName(name);
      expect(truncated.length).toBeLessThanOrEqual(43); // Max 40 + "..."
      if (name.length <= 40) {
        expect(truncated).toBe(name);
      } else {
        expect(truncated).toContain("...");
      }
    });
  });
});
