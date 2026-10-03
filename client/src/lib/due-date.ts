/** "No due date", or "Due Thu 8 Oct" in the device's format, for a YYYY-MM-DD string. */
export function formatDueDate(dueDate: string | null, locale?: string): string {
  if (!dueDate) return "No due date";
  const [year, month, day] = dueDate.split("-").map(Number);
  // A local date at midnight, so the device's time zone can't shift the day.
  const local = new Date(year, month - 1, day);
  const text = local.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  return `Due ${text.replace(/,/g, "")}`;
}

/** The device's local calendar day as YYYY-MM-DD (not UTC, so it matches the user's "today"). */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
