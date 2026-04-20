/**
 * Unit tests for data-root module.
 *
 * Tests the setDataRoot/getDataRoot/resetDataRoot pattern
 * that allows --data-root CLI flag to override the data root directory.
 */
import { setDataRoot, getDataRoot, resetDataRoot } from "../../src/db/data-root.js";

describe("data-root", () => {
  afterEach(() => {
    resetDataRoot();
  });

  it("getDataRoot returns fallback when no data root is set", () => {
    expect(getDataRoot("/fallback")).toBe("/fallback");
  });

  it("getDataRoot returns override after setDataRoot is called", () => {
    setDataRoot("/custom");
    expect(getDataRoot("/fallback")).toBe("/custom");
  });

  it("getDataRoot returns fallback after resetDataRoot is called", () => {
    setDataRoot("/custom");
    resetDataRoot();
    expect(getDataRoot("/fallback")).toBe("/fallback");
  });

  it("getDataRoot always returns override regardless of fallback value", () => {
    setDataRoot("/custom");
    expect(getDataRoot("/any-other-fallback")).toBe("/custom");
    expect(getDataRoot("/yet-another")).toBe("/custom");
  });
});
