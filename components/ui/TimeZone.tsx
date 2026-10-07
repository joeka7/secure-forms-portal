"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIME_ZONE, formatDate, formatDateTime, formatUtcOffset } from "@/lib/time";

/** The configured display time zone (PORTAL_TIMEZONE), provided by the server layout. */
const TimeZoneContext = createContext<string>(DEFAULT_TIME_ZONE);

export function TimeZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>;
}

export const useTimeZone = () => useContext(TimeZoneContext);

/** A stored UTC timestamp rendered in the display time zone, with the exact instant as a tooltip. */
export function LocalTime({ iso, format = "datetime", withOffset }: { iso: string; format?: "datetime" | "date"; withOffset?: boolean }) {
  const timeZone = useTimeZone();
  const text = format === "date" ? formatDate(iso, timeZone) : formatDateTime(iso, timeZone);
  return (
    <time dateTime={iso} title={`${iso} (UTC)`}>
      {text}
      {withOffset && ` ${formatUtcOffset(Date.parse(iso), timeZone)}`}
    </time>
  );
}
