import type { ParsedNotionRecord } from "./parse-page";
import type { FeelMetrics } from "./feel-metrics";
import { queryRecordsByTemperature } from "./query-records";

export type OutfitTagStat = {
  name: string;
  count: number;
  percent: number;
  emoji: string;
};

export type InspirationItem = {
  id: string;
  emoji: string;
  bg: string;
  match: string;
  temp: string;
  who: string;
  date: string;
  feelMetrics: FeelMetrics;
  tags: string[];
  humidity: string;
  location: string;
  photoUrl?: string;
};

export type OutfitInsights = {
  targetTemp: number;
  tempMin: number;
  tempMax: number;
  sampleCount: number;
  upperTop3: OutfitTagStat[];
  lowerTop3: OutfitTagStat[];
  inspiration: InspirationItem[];
};

const TAG_EMOJI: Record<string, string> = {
  背心: "🎽",
  內搭衣: "👕",
  "薄 T": "👕",
  薄長袖: "👔",
  "T 恤": "👕",
  襯衫: "👔",
  "Polo 衫": "👕",
  薄針織: "🧶",
  薄衛衣: "🧥",
  外套: "🧥",
  夾克: "🧥",
  牛仔外套: "🧥",
  開襟衫: "🧥",
  毛衣外罩: "🧶",
  羽絨外套: "🧥",
  "刷毛外套/大衣": "🧥",
  短褲: "🩳",
  短裙: "👗",
  薄長褲: "👖",
  涼感褲: "👖",
  牛仔褲: "👖",
  卡其褲: "👖",
  棉褲: "👖",
  直筒裙: "👗",
  "A 字裙": "👗",
  厚棉褲: "👖",
  刷毛褲: "👖",
  厚牛仔褲: "👖",
  針織裙: "👗",
  保暖長裙: "👗",
};

const CARD_BGS = ["#e8f4ff", "#fef3e2", "#f0e8ff", "#e8f5ee", "#fff4e6"];

function tagEmoji(name: string): string {
  return TAG_EMOJI[name] ?? "👔";
}

function countTagFrequency(
  records: ParsedNotionRecord[],
  pickTags: (r: ParsedNotionRecord) => string[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const tags = pickTags(record).filter(Boolean);
    const seen = new Set<string>();
    for (const tag of tags) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

function toTop3(counts: Map<string, number>, total: number): OutfitTagStat[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({
      name,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      emoji: tagEmoji(name),
    }));
}

function formatRelativeDate(iso?: string): string {
  if (!iso) return "近期";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "近期";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
}

function matchPercent(
  record: ParsedNotionRecord,
  upperTop: OutfitTagStat[],
  lowerTop: OutfitTagStat[]
): string {
  let score = 55;
  const uppers = new Set(record.upperBodyTags);
  const lowers = new Set(record.lowerBodyTags);
  upperTop.forEach((t, i) => {
    if (uppers.has(t.name)) score += (3 - i) * 12;
  });
  lowerTop.forEach((t, i) => {
    if (lowers.has(t.name)) score += (3 - i) * 10;
  });
  return `${Math.min(99, score)}%`;
}

function toInspirationCard(
  record: ParsedNotionRecord,
  index: number,
  upperTop: OutfitTagStat[],
  lowerTop: OutfitTagStat[]
): InspirationItem {
  const feelMetrics: FeelMetrics = {
    breathability: record.breathability,
    wrapping: record.wrapping,
    stuffiness: record.stuffiness,
  };
  const tags = [...record.upperBodyTags, ...record.lowerBodyTags];
  const tempNum = record.temperature ?? 0;
  const emoji =
    record.upperBodyTags[0] ? tagEmoji(record.upperBodyTags[0]) : tagEmoji(record.lowerBodyTags[0] ?? "");

  return {
    id: record.id,
    emoji,
    bg: CARD_BGS[index % CARD_BGS.length],
    match: matchPercent(record, upperTop, lowerTop),
    temp: `${Math.round(tempNum)}°C・${record.weather ?? "—"}`,
    who: record.userName,
    date: formatRelativeDate(record.startedAt),
    feelMetrics,
    tags: tags.slice(0, 4),
    humidity: record.humidity != null ? `${record.humidity}%` : "—",
    location: record.location?.split(" ")[0] || record.location || "—",
    photoUrl: record.photoUrl,
  };
}

export async function getOutfitInsights(
  temp: number,
  delta = 1
): Promise<OutfitInsights> {
  const rounded = Math.round(temp);
  const records = await queryRecordsByTemperature(rounded, delta);
  const total = records.length;

  const upperCounts = countTagFrequency(records, (r) => r.upperBodyTags);
  const lowerCounts = countTagFrequency(records, (r) => r.lowerBodyTags);

  const upperTop3 = toTop3(upperCounts, total);
  const lowerTop3 = toTop3(lowerCounts, total);

  const inspiration = records
    .filter((r) => r.upperBodyTags.length > 0 || r.lowerBodyTags.length > 0)
    .slice(0, 20)
    .map((r, i) => toInspirationCard(r, i, upperTop3, lowerTop3));

  return {
    targetTemp: rounded,
    tempMin: rounded - delta,
    tempMax: rounded + delta,
    sampleCount: total,
    upperTop3,
    lowerTop3,
    inspiration,
  };
}
