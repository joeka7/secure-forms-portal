import { describe, expect, it } from "vitest";
import {
  describeTimeZone,
  formatDateTime,
  formatUtcOffset,
  isValidCalendarDate,
  isValidTimeZone,
  zonedDayEndExclusiveUtc,
  zonedDayStartUtc,
} from "@/lib/time";

describe("time zones", () => {
  it("validates IANA names", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("formats in the display time zone without locale differences", () => {
    expect(formatDateTime("2026-10-06T10:32:00.000Z", "UTC")).toBe("06 Oct 2026, 10:32");
    expect(formatDateTime("2026-10-06T10:32:00.000Z", "Asia/Tokyo")).toBe("06 Oct 2026, 19:32");
    expect(formatDateTime("2026-10-06T23:30:00.000Z", "Asia/Tokyo")).toBe("07 Oct 2026, 08:30");
    expect(formatUtcOffset(Date.parse("2026-10-06T00:00:00Z"), "Asia/Kolkata")).toBe("UTC+5:30");
    expect(describeTimeZone("UTC")).toBe("UTC");
  });

  it("converts whole local days to UTC ranges, including across DST changes", () => {
    expect(zonedDayStartUtc("2026-10-06", "Asia/Tokyo")).toBe("2026-10-05T15:00:00.000Z");
    expect(zonedDayEndExclusiveUtc("2026-10-06", "Asia/Tokyo")).toBe("2026-10-06T15:00:00.000Z");
    // London: BST (UTC+1) ends on 25 Oct 2026, so that day is 25 hours long.
    expect(zonedDayStartUtc("2026-10-25", "Europe/London")).toBe("2026-10-24T23:00:00.000Z");
    expect(zonedDayEndExclusiveUtc("2026-10-25", "Europe/London")).toBe("2026-10-26T00:00:00.000Z");
    // New York in winter (UTC−5).
    expect(zonedDayStartUtc("2026-01-15", "America/New_York")).toBe("2026-01-15T05:00:00.000Z");
  });

  it("rejects impossible calendar dates", () => {
    expect(isValidCalendarDate("2026-02-29")).toBe(false);
    expect(isValidCalendarDate("2028-02-29")).toBe(true);
    expect(isValidCalendarDate("2026-1-5")).toBe(false);
  });
});
