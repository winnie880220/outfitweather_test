import type { ApiResponse } from "../types";
import { getNotionDatabaseId, isNotionConfigured } from "../env";
import { queryRecordsByUserName, queryRecordsByRecordIds } from "./query-records";
import { notionRequest } from "./client";
import { readRecordIdFromProperties, type NotionProp } from "./parse-page";
import {
  recordsToInspirationCards,
  type InspirationItem,
} from "./outfit-insights";
import { RECORDS_DB } from "./schema";
import {
  ensureActiveUserRecord,
  type ActiveUserRecordState,
  type ActiveUserRecordContext,
} from "./user-active-record";

type PageResponse = {
  id: string;
  properties: Record<string, NotionProp>;
};

type DatabaseResponse = {
  properties: Record<string, { type: string }>;
};

let cachedIdFieldType: string | null = null;

const NOTION_WRITE_GAP_MS = 220;
const MAX_LEGACY_FAVORITE_ROW_PATCHES = 24;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNotionWriteQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("MAX_WRITE_OPERATIONS") ||
    msg.includes("rate limited") ||
    msg.includes("Rate limit")
  );
}

function notionQuotaErrorMessage(): string {
  return "Notion 寫入次數已達本小時上限，請稍後再試取消收藏";
}

async function getRecordIdFieldType(): Promise<string> {
  if (cachedIdFieldType) return cachedIdFieldType;
  const db = await notionRequest<DatabaseResponse>(
    `/databases/${getNotionDatabaseId()}`,
    { method: "GET" }
  );
  cachedIdFieldType = db.properties[RECORDS_DB.recordId]?.type ?? "rich_text";
  return cachedIdFieldType;
}

function pageOwnerName(properties: Record<string, NotionProp>): string {
  const prop = properties[RECORDS_DB.userName];
  if (!prop || prop.type !== "title") return "";
  return prop.title?.map((t) => t.plain_text ?? "").join("") ?? "";
}

/** 比對 Favorite 內的 ID（支援 "32" 與 "OUT-32" 等格式） */
function favoriteRecordIdsMatch(a: string, b: string): boolean {
  const ta = a.trim();
  const tb = b.trim();
  if (!ta || !tb) return false;
  if (ta === tb) return true;

  const normalize = (id: string): string => {
    const dash = id.lastIndexOf("-");
    if (dash > 0) {
      const suffix = id.slice(dash + 1);
      const n = Number(suffix);
      if (!Number.isNaN(n)) return String(n);
    }
    const n = Number(id);
    return Number.isNaN(n) ? id : String(n);
  };

  return normalize(ta) === normalize(tb);
}

function withoutFavoriteRecordId(ids: string[], recordId: string): string[] {
  return ids.filter((id) => !favoriteRecordIdsMatch(id, recordId));
}

/** 讀取 Favorite multi-select：被收藏穿搭的 ID 欄位值 */
function readFavoriteIds(properties: Record<string, NotionProp>): string[] {
  const prop = properties[RECORDS_DB.favorite];
  if (!prop || prop.type !== "multi_select") {
    if (prop && prop.type !== "multi_select") {
      throw new Error(
        `Notion「Favorite」欄位類型為 ${prop.type}，請使用 Multi-select`
      );
    }
    return [];
  }
  return prop.multi_select?.map((t) => t.name.trim()).filter(Boolean) ?? [];
}

async function setFavoriteIds(
  activePageId: string,
  recordIds: string[]
): Promise<void> {
  const ids = [...new Set(recordIds.map((id) => id.trim()).filter(Boolean))];

  await notionRequest(`/pages/${activePageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        [RECORDS_DB.favorite]: {
          multi_select: ids.map((name) => ({ name })),
        },
      },
    }),
  });
}

async function fetchOutfitRecordId(outfitPageId: string): Promise<string> {
  const page = await notionRequest<PageResponse>(`/pages/${outfitPageId}`, {
    method: "GET",
  });
  const recordId = readRecordIdFromProperties(page.properties);
  if (!recordId) {
    throw new Error("此穿搭缺少 ID 欄位，無法收藏");
  }
  return recordId;
}

async function fetchOutfitPageOwner(outfitPageId: string): Promise<string> {
  const page = await notionRequest<PageResponse>(`/pages/${outfitPageId}`, {
    method: "GET",
  });
  return pageOwnerName(page.properties).trim();
}

export type ToggleFavoriteParams = {
  favoriterUserName: string;
  /** 被收藏穿搭的 Notion page id（伺服器會換算成 ID 欄位值寫入 Favorite） */
  outfitPageId: string;
  favorited: boolean;
  activeRecord?: ActiveUserRecordState | null;
  profile?: Partial<
    Pick<
      ActiveUserRecordContext,
      "location" | "gender" | "temp" | "apparentTemp" | "weather"
    >
  >;
};

export async function toggleOutfitFavorite(
  params: ToggleFavoriteParams
): Promise<
  ApiResponse<{ favoriteIds: string[]; activeUserRecord: ActiveUserRecordState }>
> {
  const favoriter = params.favoriterUserName.trim();
  const outfitPageId = params.outfitPageId.trim();

  if (!favoriter) return { ok: false, error: "缺少 favoriterUserName" };
  if (!outfitPageId) return { ok: false, error: "缺少 outfitPageId" };

  const owner = await fetchOutfitPageOwner(outfitPageId);
  if (params.favorited && owner && owner === favoriter) {
    return { ok: false, error: "無法收藏自己的穿搭" };
  }

  let outfitRecordId: string;
  try {
    outfitRecordId = await fetchOutfitRecordId(outfitPageId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法讀取穿搭 ID";
    return { ok: false, error: message };
  }

  const temp = params.profile?.temp ?? 26;
  const ensured = await ensureActiveUserRecord(
    {
      userName: favoriter,
      temp,
      apparentTemp: params.profile?.apparentTemp ?? temp,
      location: params.profile?.location,
      gender: params.profile?.gender,
      weather: params.profile?.weather,
    },
    params.activeRecord ?? null
  );

  if (!ensured.ok || !ensured.data) {
    return { ok: false, error: ensured.error ?? "無法取得 active 列" };
  }

  const active = ensured.data;

  try {
    if (params.favorited) {
      const page = await notionRequest<PageResponse>(`/pages/${active.pageId}`, {
        method: "GET",
      });
      const current = readFavoriteIds(page.properties);
      const merged = [...current];
      if (!merged.some((id) => favoriteRecordIdsMatch(id, outfitRecordId))) {
        merged.push(outfitRecordId);
      }
      await setFavoriteIds(active.pageId, merged);
    } else {
      await removeFavoriteIdFromAllUserRows(
        favoriter,
        outfitRecordId,
        active.pageId
      );
    }

    const favoriteIds = params.favorited
      ? await collectFavoriteIdsForUser(favoriter)
      : await collectFavoriteIdsForUser(favoriter, active.pageId);

    return {
      ok: true,
      data: {
        favoriteIds,
        activeUserRecord: {
          pageId: active.pageId,
          date: active.date,
          tempBand: active.tempBand,
        },
      },
      source: "notion",
    };
  } catch (error) {
    if (isNotionWriteQuotaError(error)) {
      return { ok: false, error: notionQuotaErrorMessage() };
    }
    const message = error instanceof Error ? error.message : "收藏更新失敗";
    return { ok: false, error: message };
  }
}

/**
 * 彙整收藏 ID。
 * - 未傳 activePageId：合併所有歷史列（相容舊資料）
 * - 傳 activePageId：僅讀當日 active 列（取消收藏後以此為準，避免重複寫入）
 */
async function collectFavoriteIdsForUser(
  favoriterUserName: string,
  canonicalActivePageId?: string
): Promise<string[]> {
  const pages = await queryRecordsByUserName(favoriterUserName);

  if (canonicalActivePageId) {
    const active = pages.find((p) => p.id === canonicalActivePageId);
    return active ? readFavoriteIds(active.properties) : [];
  }

  const ids = new Set<string>();
  for (const page of pages) {
    for (const id of readFavoriteIds(page.properties)) {
      ids.add(id);
    }
  }
  return [...ids];
}

function mergeFavoriteIdsFromPages(
  pages: Array<{ id: string; properties: Record<string, NotionProp> }>
): string[] {
  const ids = new Set<string>();
  for (const page of pages) {
    for (const id of readFavoriteIds(page.properties)) {
      ids.add(id);
    }
  }
  return [...ids];
}

/** 取消收藏：先寫入 active 列完整清單，再循序清除歷史列上的殘留 ID */
async function removeFavoriteIdFromAllUserRows(
  favoriterUserName: string,
  outfitRecordId: string,
  activePageId: string
): Promise<void> {
  const pages = await queryRecordsByUserName(favoriterUserName);
  const merged = mergeFavoriteIdsFromPages(pages);
  const nextOnActive = withoutFavoriteRecordId(merged, outfitRecordId);

  await setFavoriteIds(activePageId, nextOnActive);

  const legacyPages = pages
    .filter((p) => p.id !== activePageId)
    .filter((p) =>
      readFavoriteIds(p.properties).some((id) =>
        favoriteRecordIdsMatch(id, outfitRecordId)
      )
    )
    .slice(0, MAX_LEGACY_FAVORITE_ROW_PATCHES);

  for (let i = 0; i < legacyPages.length; i += 1) {
    if (i > 0) await sleep(NOTION_WRITE_GAP_MS);
    const page = legacyPages[i]!;
    const current = readFavoriteIds(page.properties);
    const next = withoutFavoriteRecordId(current, outfitRecordId);
    try {
      await setFavoriteIds(page.id, next);
    } catch (error) {
      if (isNotionWriteQuotaError(error)) {
        throw new Error(notionQuotaErrorMessage());
      }
      throw error;
    }
  }
}

/** 彙整使用者所有列上的 Favorite（ID 值），回傳對應穿搭卡片 */
export async function queryFavoritedOutfits(
  favoriterUserName: string
): Promise<ApiResponse<InspirationItem[]>> {
  const favoriter = favoriterUserName.trim();
  if (!favoriter) {
    return { ok: false, error: "缺少 favoriterUserName" };
  }

  if (!isNotionConfigured()) {
    return { ok: true, data: [], source: "notion" };
  }

  try {
    const recordIds = await collectFavoriteIdsForUser(favoriter);
    if (recordIds.length === 0) {
      return { ok: true, data: [], source: "notion" };
    }

    const idFieldType = await getRecordIdFieldType();
    const records = await queryRecordsByRecordIds(recordIds, idFieldType);
    const cards = recordsToInspirationCards(records);
    return { ok: true, data: cards, source: "notion" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "收藏查詢失敗";
    return { ok: false, error: message };
  }
}

/** @deprecated */
export const queryOutfitsFavoritedByUser = queryFavoritedOutfits;
