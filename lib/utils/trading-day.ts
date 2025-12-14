import { format, parse } from "date-fns";
import { toZonedTime } from "date-fns-tz";

// Convert a raw opened-on value (string or Date) plus optional time into a stable ET trading-day key.
// Returns yyyy-MM-dd; falls back to 1970-01-01 if parsing fails so callers can skip invalid rows.
export function getTradingDayKey(
  rawOpenedOn: string | Date,
  timeOpened?: string
): string {
  if (!rawOpenedOn) return "1970-01-01";

  const tryParse = (value: string, formats: string[]): Date | null => {
    for (const fmt of formats) {
      const parsed = parse(value, fmt, new Date());
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  let base: Date | null = null;

  if (rawOpenedOn instanceof Date) {
    base = new Date(rawOpenedOn.getTime());
  } else {
    const raw = rawOpenedOn.trim();
    const composite = timeOpened ? `${raw} ${timeOpened}` : raw;
    const hasSeconds = timeOpened
      ? timeOpened.split(":").length >= 3
      : raw.split(":").length >= 3;
    const formats = [
      ...(hasSeconds
        ? ["yyyy-MM-dd HH:mm:ss", "MM/dd/yyyy HH:mm:ss"]
        : ["yyyy-MM-dd HH:mm", "MM/dd/yyyy HH:mm"]),
      "yyyy-MM-dd",
      "MM/dd/yyyy",
    ];
    base = tryParse(composite, formats);
    if (!base || isNaN(base.getTime())) {
      const fallback = new Date(composite);
      base = isNaN(fallback.getTime()) ? null : fallback;
    }
  }
  if (!base || isNaN(base.getTime())) return "1970-01-01";
  const et = toZonedTime(base, "America/New_York");
  return format(et, "yyyy-MM-dd");
}
