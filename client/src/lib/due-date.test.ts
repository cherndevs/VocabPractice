import { describe, expect, it } from "vitest";
import { formatDueDate } from "./due-date";

describe("formatDueDate", () => {
  it("says there is no due date for null", () => {
    expect(formatDueDate(null)).toBe("No due date");
  });

  it("shows weekday, day and month in the given locale", () => {
    expect(formatDueDate("2026-10-08", "en-GB")).toBe("Due Thu 8 Oct");
  });

  it("shows the calendar day it was set, whatever the device time zone", () => {
    // 2026-01-01 and 2026-12-31 sit on the edges where a UTC parse drifts a day.
    expect(formatDueDate("2026-01-01", "en-GB")).toBe("Due Thu 1 Jan");
    expect(formatDueDate("2026-12-31", "en-GB")).toBe("Due Thu 31 Dec");
  });
});
