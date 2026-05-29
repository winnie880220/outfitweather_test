import type { UserGender } from "../types";
import { RECORDS_DB } from "./schema";

export type NotionProp = {
  type: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  number?: number | null;
  select?: { name: string } | null;
  multi_select?: Array<{ name: string }>;
  relation?: Array<{ id: string }>;
  unique_id?: { prefix?: string | null; number?: number };
  date?: { start?: string };
  files?: Array<{
    type?: string;
    name?: string;
    file?: { url?: string };
    external?: { url?: string };
    file_upload?: { id: string };
  }>;
};

export type ParsedNotionRecord = {
  /** Notion page id */
  id: string;
  /** 資料庫「ID」欄位值 */
  recordId: string;
  userName: string;
  gender?: UserGender;
  location: string;
  startedAt?: string;
  weather?: string;
  temperature?: number;
  humidity?: number;
  rainProb?: number;
  apparentTemp?: number;
  upperBodyTags: string[];
  lowerBodyTags: string[];
  colors: string[];
  /** 記錄當下該區顏色排行第一 */
  currentRanking?: string;
  breathability?: number;
  wrapping?: number;
  stuffiness?: number;
  photoUrl?: string;
  /** Notion File Upload API 的 id（列表查詢可能無直接 url） */
  photoFileUploadId?: string;
};

/** number 欄位；舊資料若仍為 rich_text 則嘗試解析 */
function readNumberProp(prop?: NotionProp): number | undefined {
  if (!prop) return undefined;
  if (prop.type === "number" && prop.number != null && !Number.isNaN(prop.number)) {
    return prop.number;
  }
  if (prop.type === "rich_text") {
    const text = prop.rich_text?.map((t) => t.plain_text ?? "").join("").trim();
    if (!text) return undefined;
    const n = Number(text);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function plainText(prop?: NotionProp): string {
  if (!prop) return "";
  if (prop.type === "title") {
    return prop.title?.map((t) => t.plain_text ?? "").join("") ?? "";
  }
  if (prop.type === "rich_text") {
    return prop.rich_text?.map((t) => t.plain_text ?? "").join("") ?? "";
  }
  return "";
}

/** 讀取資料庫「ID」欄位（rich_text / title / number / unique_id） */
export function readRecordIdFromProperties(
  properties: Record<string, NotionProp>
): string {
  const prop = properties[RECORDS_DB.recordId];
  if (!prop) return "";

  if (prop.type === "rich_text" || prop.type === "title") {
    return plainText(prop).trim();
  }
  if (prop.type === "number" && prop.number != null) {
    return String(prop.number);
  }
  if (prop.type === "unique_id" && prop.unique_id?.number != null) {
    const { prefix, number } = prop.unique_id;
    return prefix ? `${prefix}-${number}` : String(number);
  }
  return "";
}

function parsePhotoField(prop?: NotionProp): {
  photoUrl?: string;
  photoFileUploadId?: string;
} {
  if (!prop || prop.type !== "files" || !prop.files?.length) return {};
  const f = prop.files[0];
  if (f.file?.url) return { photoUrl: f.file.url };
  if (f.external?.url) return { photoUrl: f.external.url };
  if (f.file_upload?.id) return { photoFileUploadId: f.file_upload.id };
  return {};
}

export function parseNotionPage(page: {
  id: string;
  properties: Record<string, NotionProp>;
}): ParsedNotionRecord | null {
  const p = page.properties;
  const userName = plainText(p[RECORDS_DB.userName]);
  if (!userName) return null;

  const temperature = p[RECORDS_DB.temperature]?.number ?? undefined;
  const lowerSelect = p[RECORDS_DB.lowerBodyTags]?.select?.name;
  const genderName = p[RECORDS_DB.gender]?.select?.name;
  const gender: UserGender | undefined =
    genderName === "男生" || genderName === "女生" || genderName === "不分"
      ? genderName
      : undefined;

  return {
    id: page.id,
    recordId: readRecordIdFromProperties(p),
    userName,
    ...(gender ? { gender } : {}),
    location: plainText(p[RECORDS_DB.location]),
    startedAt: p[RECORDS_DB.startedAt]?.date?.start,
    weather: p[RECORDS_DB.weather]?.select?.name,
    temperature: temperature ?? undefined,
    humidity: p[RECORDS_DB.humidity]?.number ?? undefined,
    rainProb: p[RECORDS_DB.rainProb]?.number ?? undefined,
    apparentTemp: readNumberProp(p[RECORDS_DB.apparentTemp]),
    upperBodyTags: p[RECORDS_DB.upperBodyTags]?.multi_select?.map((t) => t.name) ?? [],
    lowerBodyTags: lowerSelect ? [lowerSelect] : [],
    colors: p[RECORDS_DB.color]?.multi_select?.map((t) => t.name) ?? [],
    currentRanking:
      p[RECORDS_DB.currentRanking]?.multi_select?.[0]?.name ||
      plainText(p[RECORDS_DB.currentRanking]) ||
      undefined,
    breathability: p[RECORDS_DB.breathability]?.number ?? undefined,
    wrapping: p[RECORDS_DB.wrapping]?.number ?? undefined,
    stuffiness: p[RECORDS_DB.stuffiness]?.number ?? undefined,
    ...parsePhotoField(p[RECORDS_DB.photo]),
  };
}
