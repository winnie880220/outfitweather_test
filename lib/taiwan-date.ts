/** 台灣日曆日（換日為 Asia/Taipei 午夜 00:00） */
export const TAIWAN_TIME_ZONE = "Asia/Taipei";

/** YYYY-MM-DD，依台灣時區 */
export function taiwanDateString(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIWAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/** 台灣當日 00:00 的 ISO 字串（寫入 Notion Started At） */
export function taiwanDayStartIso(dateYmd: string): string {
  return `${dateYmd}T00:00:00+08:00`;
}
