/**
 * Time-zone aware formatting and day-boundary helpers, shared by server and client code.
 *
 * Timestamps are stored as UTC ISO strings and displayed in one configurable IANA time zone
 * (`PORTAL_TIMEZONE`, default UTC). Text is assembled from numeric `Intl` parts rather than
 * locale-formatted strings, because ICU versions differ between Node and browsers ("Sep" vs
 * "Sept", narrow spaces, …) and any difference would cause a hydration mismatch.
 */

export const DEFAULT_TIME_ZONE = "UTC";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** Whether `value` is an IANA time zone this runtime understands. */
export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Calendar fields of an instant in the given time zone. */
export function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(new Date(epochMs))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Offset of the time zone from UTC at the given instant, in minutes (e.g. 240 for UTC+4). */
export function timeZoneOffsetMinutes(epochMs: number, timeZone: string) {
  const whole = Math.floor(epochMs / 1000) * 1000;
  const p = zonedParts(whole, timeZone);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole) / 60000;
}

/** "UTC", "UTC+4", "UTC−5", "UTC+5:30". */
export function formatUtcOffset(epochMs: number, timeZone: string) {
  const offset = timeZoneOffsetMinutes(epochMs, timeZone);
  if (offset === 0) return "UTC";
  const sign = offset > 0 ? "+" : "−";
  const abs = Math.abs(offset);
  const minutes = abs % 60;
  return `UTC${sign}${Math.floor(abs / 60)}${minutes ? `:${pad(minutes)}` : ""}`;
}

function parse(iso: string) {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

/** "06 Oct 2026". */
export function formatDate(iso: string, timeZone: string) {
  const time = parse(iso);
  if (time === null) return iso;
  const p = zonedParts(time, timeZone);
  return `${pad(p.day)} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** "14:32". */
export function formatTime(iso: string, timeZone: string) {
  const time = parse(iso);
  if (time === null) return iso;
  const p = zonedParts(time, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "06 Oct 2026, 14:32". */
export function formatDateTime(iso: string, timeZone: string) {
  const time = parse(iso);
  if (time === null) return iso;
  const p = zonedParts(time, timeZone);
  return `${pad(p.day)} ${MONTHS[p.month - 1]} ${p.year}, ${pad(p.hour)}:${pad(p.minute)}`;
}

/** A value entered in a date/datetime field ("2026-10-06" or "2026-10-06T14:30"), shown as typed, with no conversion. */
export function formatEnteredDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return value;
  const [, y, m, d, hh, mm] = match;
  const date = `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
  return hh ? `${date}, ${hh}:${mm}` : date;
}

function dateParts(day: string): [number, number, number] | null {
  const m = DATE_RE.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Rejects impossible dates such as 2026-02-31.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return [y, mo, d];
}

/** Whether `day` is a real calendar date in YYYY-MM-DD form. */
export function isValidCalendarDate(day: string) {
  return dateParts(day) !== null;
}

/** UTC instant of local midnight on `[y, m, d]` in the time zone, correct across DST changes. */
function zonedMidnightUtc(y: number, m: number, d: number, timeZone: string) {
  const local = Date.UTC(y, m - 1, d);
  let guess = local - timeZoneOffsetMinutes(local, timeZone) * 60000;
  const corrected = local - timeZoneOffsetMinutes(guess, timeZone) * 60000;
  if (corrected !== guess) guess = corrected;
  return guess;
}

/** UTC ISO instant at which the given calendar day starts in the time zone. */
export function zonedDayStartUtc(day: string, timeZone: string) {
  const parts = dateParts(day);
  if (!parts) throw new Error(`Invalid date "${day}"`);
  return new Date(zonedMidnightUtc(parts[0], parts[1], parts[2], timeZone)).toISOString();
}

/** UTC ISO instant at which the given calendar day ends (exclusive): the start of the next day. */
export function zonedDayEndExclusiveUtc(day: string, timeZone: string) {
  const parts = dateParts(day);
  if (!parts) throw new Error(`Invalid date "${day}"`);
  const next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  return new Date(zonedMidnightUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone)).toISOString();
}

/** Short reference shown to the submitter (first 8 characters of the submission id). */
export const submissionReference = (id: string) => id.slice(0, 8).toUpperCase();

/** Human description of the display time zone, e.g. "UTC" or "Europe/London time (currently UTC+1)". */
export function describeTimeZone(timeZone: string, now = Date.now()) {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
  return `${timeZone.replace(/_/g, " ")} time (currently ${formatUtcOffset(now, timeZone)})`;
}
