import { recordInsightReferenceTemp } from "../../../lib/weather-insight-temp";
import type { ApiResponse, NotionRecordPayload, UserGender } from "../types";
import { isNotionConfigured } from "../env";
import { createRecordInNotion } from "./records";
import { notionRequest } from "./client";
import { parseNotionPage, type NotionProp } from "./parse-page";
import { RECORDS_DB } from "./schema";

type PageResponse = {
  id: string;
  properties: Record<string, NotionProp>;
};

export type ActiveUserRecordContext = {
  userName: string;
  temp: number;
  tempMin?: number;
  tempMax?: number;
  location?: string;
  gender?: UserGender;
  weather?: string;
  humidity?: number;
  rainProb?: number;
  apparentTemp?: number;
  uvIndex?: number;
};

export type ActiveUserRecordState = {
  pageId: string;
  date: string;
  tempBand: number;
};

export type EnsureActiveUserRecordResult = ActiveUserRecordState & {
  created: boolean;
};

function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function tempBandCenter(temp: number): number {
  return Math.round(temp);
}

export function isSameTempBand(a: number, b: number): boolean {
  return Math.abs(tempBandCenter(a) - tempBandCenter(b)) <= 1;
}

/** active 列溫區比對用體感溫度（無則退回氣溫） */
export function activeRecordBandTemp(ctx: ActiveUserRecordContext): number {
  if (
    typeof ctx.apparentTemp === "number" &&
    Number.isFinite(ctx.apparentTemp)
  ) {
    return ctx.apparentTemp;
  }
  return ctx.temp;
}

function pageOwnerName(properties: Record<string, NotionProp>): string {
  const prop = properties[RECORDS_DB.userName];
  if (!prop || prop.type !== "title") return "";
  return prop.title?.map((t) => t.plain_text ?? "").join("") ?? "";
}

/** 確認 page 仍為當日、同使用者、同體感溫區的 active 列 */
export async function validateActiveUserPage(
  pageId: string,
  userName: string,
  date: string,
  bandTemp: number
): Promise<ActiveUserRecordState | null> {
  if (!pageId || pageId.startsWith("local-")) return null;
  try {
    const page = await notionRequest<PageResponse>(`/pages/${pageId}`, { method: "GET" });
    if (pageOwnerName(page.properties).trim() !== userName.trim()) return null;
    const parsed = parseNotionPage({ id: page.id, properties: page.properties });
    const recordDate = parsed?.startedAt
      ? localDateString(new Date(parsed.startedAt))
      : date;
    const recordBandTemp =
      (parsed ? recordInsightReferenceTemp(parsed) : undefined) ?? bandTemp;
    if (recordDate !== date) return null;
    if (!isSameTempBand(recordBandTemp, bandTemp)) return null;
    return {
      pageId: page.id,
      date,
      tempBand: tempBandCenter(bandTemp),
    };
  } catch {
    return null;
  }
}

function buildActiveRecordPayload(ctx: ActiveUserRecordContext): NotionRecordPayload {
  return {
    userName: ctx.userName.trim(),
    startedAt: new Date().toISOString(),
    favoriteIds: [],
    ...(ctx.gender ? { gender: ctx.gender } : {}),
    ...(ctx.location ? { location: ctx.location } : {}),
    ...(ctx.weather ? { weather: ctx.weather } : {}),
    temperature: tempBandCenter(ctx.temp),
    ...(typeof ctx.tempMax === "number" && !Number.isNaN(ctx.tempMax)
      ? { maxTemp: Math.round(ctx.tempMax) }
      : {}),
    ...(typeof ctx.tempMin === "number" && !Number.isNaN(ctx.tempMin)
      ? { minTemp: Math.round(ctx.tempMin) }
      : {}),
    ...(ctx.humidity !== undefined ? { humidity: ctx.humidity } : {}),
    ...(ctx.rainProb !== undefined ? { rainProb: ctx.rainProb } : {}),
    ...(ctx.apparentTemp !== undefined
      ? { apparentTemp: Math.round(ctx.apparentTemp) }
      : {}),
    ...(ctx.uvIndex !== undefined ? { uvIndex: ctx.uvIndex } : {}),
  };
}

/**
 * 取得或建立「當日 + 當前體感溫度區間」的使用者 active 列（收藏／記錄／回饋皆寫入此列）
 */
export async function ensureActiveUserRecord(
  ctx: ActiveUserRecordContext,
  existing?: ActiveUserRecordState | null
): Promise<ApiResponse<EnsureActiveUserRecordResult>> {
  if (!isNotionConfigured()) {
    return {
      ok: false,
      error: "NOTION_API_KEY 或 NOTION_DATABASE_ID 尚未在 Vercel 設定",
    };
  }

  const userName = ctx.userName.trim();
  if (!userName) {
    return { ok: false, error: "缺少 userName" };
  }

  const date = localDateString();
  const bandTemp = activeRecordBandTemp(ctx);
  const tempBand = tempBandCenter(bandTemp);

  try {
    if (existing?.pageId) {
      const valid = await validateActiveUserPage(
        existing.pageId,
        userName,
        date,
        bandTemp
      );
      if (valid) {
        return {
          ok: true,
          data: { ...valid, created: false },
          source: "notion",
        };
      }
    }

    const created = await createRecordInNotion(buildActiveRecordPayload(ctx));
    if (!created.ok || !created.data?.id) {
      return { ok: false, error: created.error ?? "無法建立使用者資料列" };
    }

    return {
      ok: true,
      data: {
        pageId: created.data.id,
        date,
        tempBand,
        created: true,
      },
      source: "notion",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得 active 列";
    return { ok: false, error: message };
  }
}
