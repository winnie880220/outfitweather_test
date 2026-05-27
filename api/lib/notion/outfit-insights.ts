import type { UserGender } from "../types";
import type { ParsedNotionRecord } from "./parse-page";
import type { FeelMetrics } from "./feel-metrics";
import { parseLocationToRegion, regionKey } from "../../../lib/map-region";
import {
  isTaipeiCityLocation,
  parseLocationToCounty,
} from "../../../lib/taiwan-county";
import {
  parseTaipeiDistrict,
  TAIPEI_COUNTY,
  type TaipeiDistrict,
} from "../../../lib/taipei-district";
import type { TaiwanCounty } from "../../../lib/taiwan-county";
import { colorNameToHex } from "../../../src/lib/color-lexicon";
import { queryRecordsByTemperature } from "./query-records";
import { hydrateRecordPhotoUrls } from "./resolve-photo";

export type OutfitTagStat = {
  name: string;
  count: number;
  percent: number;
  emoji: string;
  /** 色名排行用 */
  hex?: string;
};

export type InspirationItem = {
  /** Notion page id */
  id: string;
  /** 資料庫「ID」欄位值 */
  recordId?: string;
  emoji: string;
  bg: string;
  match: string;
  temp: string;
  who: string;
  date: string;
  feelMetrics: FeelMetrics;
  tags: string[];
  colors: string[];
  humidity: string;
  location: string;
  photoUrl?: string;
  gender?: UserGender;
};

export type OutfitInsights = {
  targetTemp: number;
  tempMin: number;
  tempMax: number;
  sampleCount: number;
  photoCount?: number;
  upperTop3: OutfitTagStat[];
  lowerTop3: OutfitTagStat[];
  colorTop3: OutfitTagStat[];
  inspiration: InspirationItem[];
};

/** 各縣市／行政區在目前天氣溫度區間的顏色排行第一（地圖填色用） */
export type RegionColorFill = {
  regionKey: string;
  county: TaiwanCounty;
  district?: TaipeiDistrict;
  colorName: string;
  hex: string;
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

function toColorTop3(counts: Map<string, number>, total: number): OutfitTagStat[] {
  return toTop3(counts, total).map((stat) => ({
    ...stat,
    emoji: "",
    hex: colorNameToHex(stat.name),
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

export function recordsToInspirationCards(records: ParsedNotionRecord[]): InspirationItem[] {
  return records.map((r, i) => toInspirationCard(r, i, [], []));
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

  const county = parseLocationToCounty(record.location);
  const district = parseTaipeiDistrict(record.location);
  const locationLabel =
    county === TAIPEI_COUNTY
      ? district
        ? `${TAIPEI_COUNTY} ${district}`
        : TAIPEI_COUNTY
      : county ?? record.location?.split(" ")[0] ?? record.location ?? "—";

  return {
    id: record.id,
    ...(record.recordId ? { recordId: record.recordId } : {}),
    emoji,
    bg: CARD_BGS[index % CARD_BGS.length],
    match: matchPercent(record, upperTop, lowerTop),
    temp: `${Math.round(tempNum)}°C・${record.weather ?? "—"}`,
    who: record.userName,
    date: formatRelativeDate(record.startedAt),
    feelMetrics,
    tags: tags.slice(0, 4),
    colors: record.colors.slice(0, 3),
    humidity: record.humidity != null ? `${record.humidity}%` : "—",
    location: locationLabel,
    photoUrl: record.photoUrl,
    ...(record.gender ? { gender: record.gender } : {}),
  };
}

function recordMatchesRegion(
  record: ParsedNotionRecord,
  county?: string,
  district?: string
): boolean {
  const countyTrim = county?.trim();
  const districtTrim = district?.trim();
  if (!countyTrim) return true;

  if (!districtTrim) {
    if (countyTrim === TAIPEI_COUNTY) {
      return isTaipeiCityLocation(record.location);
    }
    return parseLocationToCounty(record.location) === countyTrim;
  }

  if (countyTrim === TAIPEI_COUNTY) {
    return parseTaipeiDistrict(record.location) === districtTrim;
  }
  return parseLocationToCounty(record.location) === countyTrim;
}

export async function getOutfitInsights(
  temp: number,
  delta = 1,
  county?: string,
  district?: string
): Promise<OutfitInsights> {
  const rounded = Math.round(temp);
  let records = await queryRecordsByTemperature(rounded, delta);

  const countyTrim = county?.trim();
  const districtTrim = district?.trim();
  if (countyTrim) {
    records = records.filter((r) =>
      recordMatchesRegion(r, countyTrim, districtTrim)
    );
  }

  await hydrateRecordPhotoUrls(records);

  const total = records.length;
  const withPhoto = records.filter((r) => Boolean(r.photoUrl));

  const upperCounts = countTagFrequency(records, (r) => r.upperBodyTags);
  const lowerCounts = countTagFrequency(records, (r) => r.lowerBodyTags);
  const colorCounts = countTagFrequency(records, (r) => r.colors);

  const upperTop3 = toTop3(upperCounts, total);
  const lowerTop3 = toTop3(lowerCounts, total);
  const colorTop3 = toColorTop3(colorCounts, total);

  const inspiration = withPhoto
    .slice(0, 20)
    .map((r, i) => toInspirationCard(r, i, upperTop3, lowerTop3));

  return {
    targetTemp: rounded,
    tempMin: rounded - delta,
    tempMax: rounded + delta,
    sampleCount: total,
    photoCount: withPhoto.length,
    upperTop3,
    lowerTop3,
    colorTop3,
    inspiration,
  };
}

/** 地圖填色：與區域排行榜 colorTop3 相同，僅統計 Color 多選 */
function colorsForRegionAggregation(record: ParsedNotionRecord): string[] {
  return record.colors.map((c) => c.trim()).filter(Boolean);
}

function pickTopColorName(counts: Map<string, number>): string | null {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function ensureColorBucket(
  buckets: Map<
    string,
    { county: TaiwanCounty; district?: TaipeiDistrict; colorCounts: Map<string, number> }
  >,
  key: string,
  county: TaiwanCounty,
  district?: TaipeiDistrict
) {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      county,
      ...(district ? { district } : {}),
      colorCounts: new Map(),
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

function addRecordColorsToBucket(
  bucket: { colorCounts: Map<string, number> },
  record: ParsedNotionRecord
) {
  const seen = new Set<string>();
  for (const colorName of colorsForRegionAggregation(record)) {
    if (seen.has(colorName)) continue;
    seen.add(colorName);
    bucket.colorCounts.set(colorName, (bucket.colorCounts.get(colorName) ?? 0) + 1);
  }
}

/** 一次查詢後依區域聚合顏色排行第一，供地圖行政區填色 */
export async function getRegionColorFills(
  temp: number,
  delta = 1
): Promise<RegionColorFill[]> {
  const rounded = Math.round(temp);
  const records = await queryRecordsByTemperature(rounded, delta);
  const buckets = new Map<
    string,
    { county: TaiwanCounty; district?: TaipeiDistrict; colorCounts: Map<string, number> }
  >();

  for (const record of records) {
    const region = parseLocationToRegion(record.location);
    if (!region) continue;

    if (region.level === "district") {
      const districtKey = regionKey(region);
      addRecordColorsToBucket(
        ensureColorBucket(buckets, districtKey, region.county, region.district),
        record
      );
    }

    if (region.county === TAIPEI_COUNTY) {
      /** 台北市大區：含「台北市」與各行政區紀錄，供縮小地圖整市填色 */
      addRecordColorsToBucket(
        ensureColorBucket(buckets, TAIPEI_COUNTY, TAIPEI_COUNTY),
        record
      );
    } else if (region.level === "county") {
      addRecordColorsToBucket(
        ensureColorBucket(buckets, region.county, region.county),
        record
      );
    }
  }

  const fills: RegionColorFill[] = [];
  for (const [regionKeyValue, bucket] of buckets) {
    const top = pickTopColorName(bucket.colorCounts);
    if (!top) continue;
    fills.push({
      regionKey: regionKeyValue,
      county: bucket.county,
      ...(bucket.district ? { district: bucket.district } : {}),
      colorName: top,
      hex: colorNameToHex(top),
    });
  }

  return fills;
}

/**
 * 依定位字串與氣溫區間，取得該區顏色排行第一（與地圖填色邏輯一致）
 */
export async function getRegionTopColorForLocation(
  temp: number,
  location: string,
  delta = 1
): Promise<string | null> {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const region = parseLocationToRegion(trimmed);
  if (!region) return null;

  const fills = await getRegionColorFills(temp, delta);
  const key = regionKey(region);
  let fill = fills.find((f) => f.regionKey === key);
  if (!fill && region.level === "district") {
    fill = fills.find((f) => f.regionKey === region.county && !f.district);
  }
  return fill?.colorName ?? null;
}
