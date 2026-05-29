import type { ApiResponse, NotionRecordPayload, UserGender } from "../types";
import { isNotionConfigured } from "../env";
import { createRecordInNotion } from "./records";
import { notionRequest } from "./client";
import { parseNotionPage, type NotionProp, type ParsedNotionRecord } from "./parse-page";
import { queryRecordsByUserName } from "./query-records";
import { RECORDS_DB } from "./schema";
import { taiwanDateString } from "../../../lib/taiwan-date";

type PageResponse = {
  id: string;
  archived?: boolean;
  properties: Record<string, NotionProp>;
};

export type ActiveUserRecordContext = {
  userName: string;
  gender?: UserGender;
};

export type ActiveUserRecordState = {
  pageId: string;
  /** 台灣時區 YYYY-MM-DD */
  date: string;
};

export type EnsureActiveUserRecordResult = ActiveUserRecordState & {
  created: boolean;
};

function pageOwnerName(properties: Record<string, NotionProp>): string {
  const prop = properties[RECORDS_DB.userName];
  if (!prop || prop.type !== "title") return "";
  return prop.title?.map((t) => t.plain_text ?? "").join("") ?? "";
}

/** 無照片、無穿搭標籤的列，視為收藏用的 active 容器（非「記錄」穿搭列） */
function isLikelyActiveContainerRow(record: ParsedNotionRecord): boolean {
  if (record.photoUrl || record.photoFileUploadId) return false;
  return record.upperBodyTags.length === 0 && record.lowerBodyTags.length === 0;
}

function recordTaiwanDate(parsed: ParsedNotionRecord): string {
  if (!parsed.startedAt) return "";
  return taiwanDateString(new Date(parsed.startedAt));
}

/** 確認 page 仍為當日（台灣）、同使用者、且為收藏容器列 */
export async function validateActiveUserPage(
  pageId: string,
  userName: string,
  date: string
): Promise<ActiveUserRecordState | null> {
  if (!pageId || pageId.startsWith("local-")) return null;
  try {
    const page = await notionRequest<PageResponse>(`/pages/${pageId}`, { method: "GET" });
    if (page.archived) return null;
    if (pageOwnerName(page.properties).trim() !== userName.trim()) return null;
    const parsed = parseNotionPage({ id: page.id, properties: page.properties });
    if (!parsed || !isLikelyActiveContainerRow(parsed)) return null;
    const recordDate = recordTaiwanDate(parsed) || date;
    if (recordDate !== date) return null;
    return {
      pageId: page.id,
      date,
    };
  } catch {
    return null;
  }
}

function readFavoriteIdsFromProperties(
  properties: Record<string, NotionProp>
): string[] {
  const prop = properties[RECORDS_DB.favorite];
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select?.map((t) => t.name.trim()).filter(Boolean) ?? [];
}

/**
 * 在 Notion 查詢「台灣當日」的收藏容器列（不建立新列；一日一列）
 */
export async function findActiveUserRecordInNotion(
  userName: string
): Promise<ActiveUserRecordState | null> {
  const trimmed = userName.trim();
  if (!trimmed || !isNotionConfigured()) return null;

  const date = taiwanDateString();
  const pages = await queryRecordsByUserName(trimmed);

  type Candidate = ActiveUserRecordState & {
    favoriteCount: number;
    startedAtMs: number;
  };
  const candidates: Candidate[] = [];

  for (const page of pages) {
    const parsed = parseNotionPage(page);
    if (!parsed || !isLikelyActiveContainerRow(parsed)) continue;
    if (recordTaiwanDate(parsed) !== date) continue;

    const favoriteCount = readFavoriteIdsFromProperties(page.properties).length;
    const startedAtMs = parsed.startedAt
      ? new Date(parsed.startedAt).getTime()
      : 0;

    candidates.push({
      pageId: page.id,
      date,
      favoriteCount,
      startedAtMs,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.favoriteCount !== a.favoriteCount) {
      return b.favoriteCount - a.favoriteCount;
    }
    return b.startedAtMs - a.startedAtMs;
  });

  const best = candidates[0];
  return {
    pageId: best.pageId,
    date: best.date,
  };
}

function buildActiveRecordPayload(ctx: ActiveUserRecordContext): NotionRecordPayload {
  return {
    userName: ctx.userName.trim(),
    startedAt: new Date().toISOString(),
    favoriteIds: [],
    ...(ctx.gender ? { gender: ctx.gender } : {}),
  };
}

export type EnsureActiveUserRecordOptions = {
  /** 預設 true；false 時僅驗證／查詢，不 POST 新列 */
  createIfMissing?: boolean;
};

/**
 * 取得或（可選）建立「台灣當日」的收藏容器列（僅 userName + 日期；穿搭記錄另列）
 */
export async function ensureActiveUserRecord(
  ctx: ActiveUserRecordContext,
  existing?: ActiveUserRecordState | null,
  options?: EnsureActiveUserRecordOptions
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

  const date = taiwanDateString();
  const createIfMissing = options?.createIfMissing !== false;

  try {
    if (existing?.pageId) {
      const valid = await validateActiveUserPage(existing.pageId, userName, date);
      if (valid) {
        return {
          ok: true,
          data: { ...valid, created: false },
          source: "notion",
        };
      }
    }

    const found = await findActiveUserRecordInNotion(userName);
    if (found) {
      return {
        ok: true,
        data: { ...found, created: false },
        source: "notion",
      };
    }

    if (!createIfMissing) {
      return { ok: false, error: "尚未建立當日收藏列" };
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
        created: true,
      },
      source: "notion",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得 active 列";
    return { ok: false, error: message };
  }
}
