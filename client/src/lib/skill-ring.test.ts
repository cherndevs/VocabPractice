import { describe, expect, it } from "vitest";
import { ringPercent, ringState } from "./skill-ring";

describe("skill ring", () => {
  it("buckets retrievability: ≥80% fresh, 50–80% aging, <50% due, ungraded new", () => {
    expect(ringState(0.95)).toBe("fresh");
    expect(ringState(0.8)).toBe("fresh");
    expect(ringState(0.79)).toBe("aging");
    expect(ringState(0.5)).toBe("aging");
    expect(ringState(0.49)).toBe("due");
    expect(ringState(0)).toBe("due");
    expect(ringState(null)).toBe("new");
    expect(ringState(undefined)).toBe("new");
  });

  it("fills a rounded, clamped percentage, and nothing for a new session", () => {
    expect(ringPercent(0.744)).toBe(74);
    expect(ringPercent(1.2)).toBe(100);
    expect(ringPercent(null)).toBe(0);
  });
});
