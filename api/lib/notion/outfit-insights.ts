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
import { TAIWAN_COUNTIES, type TaiwanCounty } from "../../../lib/taiwan-county";
import type { MapFillLocaleSpec } from "../../../lib/map-fill-locales";
import { pickTopRegionColorNames } from "../../../lib/map-region-color-rank";
import { rankingColorsFromRecord } from "../../../lib/outfit-colors";
import {
  canonicalColorName,
  colorNameToHex,
} from "../../../src/lib/color-lexicon";
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

/** 各縣市／行政區在目前體感溫度區間的顏色排行第一（地圖填色用） */
export type RegionColorFill = {
  regionKey: string;
  county: TaiwanCounty;
  district?: TaipeiDistrict;
  colorName: string;
  hex: string;
  /** 與 colorName 並列第一時的第二色 */
  colorName2?: string;
  hex2?: string;
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
  const refTemp = record.apparentTemp ?? record.temperature;
  const tempNum = refTemp ?? 0;
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
    ...(refTemp != null ? { referenceTemp: Math.round(refTemp) } : {}),
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
  district?: string,
  options?: { fallbackTemp?: number }
): Promise<OutfitInsights> {
  const rounded = Math.round(temp);
  const fallbackRounded =
    options?.fallbackTemp != null && Number.isFinite(options.fallbackTemp)
      ? Math.round(options.fallbackTemp)
      : null;

  let records = await queryRecordsByTemperature(rounded, delta);
  let usedTemp = rounded;
  if (
    records.length === 0 &&
    fallbackRounded != null &&
    fallbackRounded !== rounded
  ) {
    records = await queryRecordsByTemperature(fallbackRounded, delta);
    usedTemp = fallbackRounded;
  }

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
  const withoutPhoto = records.filter((r) => !r.photoUrl);

  const upperCounts = countTagFrequency(records, (r) => r.upperBodyTags);
  const lowerCounts = countTagFrequency(records, (r) => r.lowerBodyTags);
  const colorCounts = countTagFrequency(records, (r) =>
    colorsForRegionAggregation(r)
  );

  const upperTop3 = toTop3(upperCounts, total);
  const lowerTop3 = toTop3(lowerCounts, total);
  const colorTop3 = toColorTop3(colorCounts, total);

  /** 有照片優先；無照片仍以 emoji 卡片顯示（避免 Notion 有性別／標籤卻被完全排除） */
  const inspiration = [...withPhoto, ...withoutPhoto]
    .slice(0, 20)
    .map((r, i) => toInspirationCard(r, i, upperTop3, lowerTop3));

  return {
    targetTemp: usedTemp,
    tempMin: usedTemp - delta,
    tempMax: usedTemp + delta,
    sampleCount: total,
    photoCount: withPhoto.length,
    upperTop3,
    lowerTop3,
    colorTop3,
    inspiration,
  };
}

/** 地圖填色／colorTop3：每筆紀錄只計第一主色（正規化後） */
function colorsForRegionAggregation(record: ParsedNotionRecord): string[] {
  return rankingColorsFromRecord(record.colors)
    .map((raw) => canonicalColorName(raw))
    .filter((c): c is string => Boolean(c));
}

function tempQueryKey(refTemp: number, delta: number, airTemp: number): string {
  return `${Math.round(refTemp)}@d${delta}@a${Math.round(airTemp)}`;
}

function fillFromLocaleRecords(
  locale: MapFillLocaleSpec,
  records: ParsedNotionRecord[]
): RegionColorFill | null {
  const filtered = records.filter((r) =>
    recordMatchesRegion(r, locale.county, locale.district)
  );
  const colorCounts = new Map<string, number>();
  for (const record of filtered) {
    const [colorName] = colorsForRegionAggregation(record);
    if (!colorName) continue;
    colorCounts.set(colorName, (colorCounts.get(colorName) ?? 0) + 1);
  }
  const top = pickTopRegionColorNames(colorCounts);
  if (!top) return null;
  return {
    regionKey: locale.regionKey,
    county: locale.county,
    ...(locale.district ? { district: locale.district } : {}),
    colorName: top.colorName,
    hex: colorNameToHex(top.colorName),
    ...(top.colorName2
      ? {
          colorName2: top.colorName2,
          hex2: colorNameToHex(top.colorName2),
        }
      : {}),
  };
}

async function queryRecordsForLocaleTemp(
  refTemp: number,
  delta: number,
  airTemp: number
): Promise<ParsedNotionRecord[]> {
  const rounded = Math.round(refTemp);
  const airRounded = Math.round(airTemp);
  let records = await queryRecordsByTemperature(rounded, delta);
  if (records.length === 0 && airRounded !== rounded) {
    records = await queryRecordsByTemperature(airRounded, delta);
  }
  return records;
}

/**
 * 各地圖區塊依「該區當下體感溫度」各自查穿搭排行色（同一溫區共用 Notion 查詢）。
 */
export async function getRegionColorFillsForLocales(
  locales: MapFillLocaleSpec[]
): Promise<RegionColorFill[]> {
  if (locales.length === 0) return [];

  const groups = new Map<string, MapFillLocaleSpec[]>();
  for (const locale of locales) {
    const key = tempQueryKey(locale.refTemp, locale.delta, locale.airTemp);
    const list = groups.get(key) ?? [];
    list.push(locale);
    groups.set(key, list);
  }

  const fills: RegionColorFill[] = [];
  for (const [, group] of groups) {
    const sample = group[0]!;
    const records = await queryRecordsForLocaleTemp(
      sample.refTemp,
      sample.delta,
      sample.airTemp
    );
    for (const locale of group) {
      const fill = fillFromLocaleRecords(locale, records);
      if (fill) fills.push(fill);
    }
  }

  return fills;
}

/** @deprecated 單一溫度全台聚合；請改用 getRegionColorFillsForLocales */
export async function getRegionColorFills(
  temp: number,
  delta = 1,
  options?: { fallbackTemp?: number }
): Promise<RegionColorFill[]> {
  const air = options?.fallbackTemp ?? temp;
  const locales: MapFillLocaleSpec[] = TAIWAN_COUNTIES.map((county) => ({
    regionKey: county,
    county,
    refTemp: temp,
    airTemp: air,
    delta,
  }));
  return getRegionColorFillsForLocales(locales);
}

/**
 * 依定位字串與體感溫度區間，取得該區顏色排行第一（與地圖填色邏輯一致）
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

  const locales: MapFillLocaleSpec[] = [
    {
      regionKey: regionKey(region),
      county: region.county,
      ...(region.level === "district" ? { district: region.district } : {}),
      refTemp: temp,
      airTemp: temp,
      delta,
    },
  ];
  const fills = await getRegionColorFillsForLocales(locales);
  const fill = fills[0];
  if (!fill) return null;
  return fill.colorName2 ? `${fill.colorName}・${fill.colorName2}` : fill.colorName;
}
