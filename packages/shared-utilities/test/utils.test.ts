import { describe, expect, it } from "vitest";
import { formatMeasurement, formatNumber, formatTimestamp, humanAge, slugify } from "../src";

describe("shared utilities", () => {
  it("formats measurements with units", () => {
    expect(formatMeasurement(12.3456, "mm", 2)).toBe("12.35 mm");
    expect(formatMeasurement(null, "mm")).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });
  it("always labels timestamp zone", () => {
    expect(formatTimestamp("2026-01-02T03:04:05Z")).toMatch(/UTC$/);
    expect(formatTimestamp("not a date")).toBe("—");
  });
  it("describes ages and slugs", () => {
    expect(humanAge(30)).toBe("30 s ago");
    expect(humanAge(null)).toBe("never");
    expect(slugify("Hydrostatic–Season–Time (HST)")).toBe("hydrostaticseasontime-hst");
  });
});
