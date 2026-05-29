import type { ApiResponse } from "../types";
import { getNotionDatabaseId, isNotionConfigured } from "../env";
import { queryRecordsByRecordIds } from "./query-records";
import { notionRequest } from "./client";
import { readRecordIdFromProperties, type NotionProp } from "./parse-page";
import {
  recordsToInspirationCards,
  type InspirationItem,
} from "./outfit-insights";
import { RECORDS_DB } from "./schema";
import {
  activeRecordBandTemp,
  ensureActiveUserRecord,
  tempBandCenter,
  validateActiveUserPage,
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

type OutfitPageMeta = {
  owner: string;
  recordId: string;
};

let cachedIdFieldType: string | null = null;

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

/** 一次 GET 穿搭 page：作者 + ID 欄位 */
async function fetchOutfitPageMeta(outfitPageId: string): Promise<OutfitPageMeta> {
  const page = await notionRequest<PageResponse>(`/pages/${outfitPageId}`, {
    method: "GET",
  });
  const recordId = readRecordIdFromProperties(page.properties);
  if (!recordId) {
    throw new Error("此穿搭缺少 ID 欄位，無法收藏");
  }
  return {
    owner: pageOwnerName(page.properties).trim(),
    recordId,
  };
}

async function readActiveFavoriteIds(activePageId: string): Promise<string[]> {
  const page = await notionRequest<PageResponse>(`/pages/${activePageId}`, {
    method: "GET",
  });
  return readFavoriteIds(page.properties);
}

/** 加入收藏：GET active → 合併 ID → PATCH */
async function addFavoriteOnActiveRow(
  activePageId: string,
  outfitRecordId: string
): Promise<string[]> {
  const current = await readActiveFavoriteIds(activePageId);
  const merged = [...current];
  if (!merged.some((id) => favoriteRecordIdsMatch(id, outfitRecordId))) {
    merged.push(outfitRecordId);
  }
  await setFavoriteIds(activePageId, merged);
  return merged;
}

/** 取消收藏：只更新今日 active 列 */
async function removeFavoriteOnActiveRow(
  activePageId: string,
  outfitRecordId: string
): Promise<string[]> {
  const current = await readActiveFavoriteIds(activePageId);
  const next = withoutFavoriteRecordId(current, outfitRecordId);
  await setFavoriteIds(activePageId, next);
  return next;
}

function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function resolveActiveUserRecordForFavorites(
  favoriter: string,
  options?: QueryFavoritedOutfitsOptions
): Promise<ActiveUserRecordState | null> {
  const userName = favoriter.trim();
  const temp = options?.profile?.temp ?? 26;
  const ctx: ActiveUserRecordContext = {
    userName,
    temp,
    apparentTemp: options?.profile?.apparentTemp ?? temp,
    location: options?.profile?.location,
    gender: options?.profile?.gender,
    weather: options?.profile?.weather,
  };
  const bandTemp = activeRecordBandTemp(ctx);
  const date = localDateString();

  const candidatePageId =
    options?.activePageId?.trim() || options?.activeRecord?.pageId?.trim();
  if (candidatePageId) {
    const valid = await validateActiveUserPage(
      candidatePageId,
      userName,
      date,
      bandTemp
    );
    if (valid) return valid;
  }

  let existingForEnsure: ActiveUserRecordState | null = options?.activeRecord ?? null;
  if (candidatePageId) {
    existingForEnsure = null;
  }

  const ensured = await ensureActiveUserRecord(ctx, existingForEnsure);
  if (!ensured.ok || !ensured.data) return null;
  return {
    pageId: ensured.data.pageId,
    date: ensured.data.date,
    tempBand: ensured.data.tempBand,
  };
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

export type QueryFavoritedOutfitsOptions = {
  activePageId?: string;
  activeRecord?: ActiveUserRecordState | null;
  profile?: ToggleFavoriteParams["profile"];
  /** 剛寫入 Favorite 後，直接讀此 pageId，不重新 resolve（避免溫區判斷指到另一列） */
  readPageIdDirectly?: boolean;
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

  let outfitRecordId: string;
  try {
    const meta = await fetchOutfitPageMeta(outfitPageId);
    if (params.favorited && meta.owner && meta.owner === favoriter) {
      return { ok: false, error: "無法收藏自己的穿搭" };
    }
    outfitRecordId = meta.recordId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法讀取穿搭 ID";
    return { ok: false, error: message };
  }

  const active = await resolveActiveUserRecordForFavorites(favoriter, {
    activeRecord: params.activeRecord ?? null,
    profile: params.profile,
  });

  if (!active) {
    return { ok: false, error: "無法取得 active 列" };
  }

  try {
    const favoriteIds = params.favorited
      ? await addFavoriteOnActiveRow(active.pageId, outfitRecordId)
      : await removeFavoriteOnActiveRow(active.pageId, outfitRecordId);

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

export type FavoritedOutfitsQueryResult = {
  cards: InspirationItem[];
  activeUserRecord: ActiveUserRecordState | null;
};

/** 僅讀取「今日 active 列」Favorite，不回溯歷史列 */
export async function queryFavoritedOutfits(
  favoriterUserName: string,
  options?: QueryFavoritedOutfitsOptions
): Promise<ApiResponse<FavoritedOutfitsQueryResult>> {
  const favoriter = favoriterUserName.trim();
  if (!favoriter) {
    return { ok: false, error: "缺少 favoriterUserName" };
  }

  if (!isNotionConfigured()) {
    return {
      ok: true,
      data: { cards: [], activeUserRecord: null },
      source: "notion",
    };
  }

  try {
    const directPageId = options?.readPageIdDirectly
      ? options.activePageId?.trim() || options?.activeRecord?.pageId?.trim()
      : "";
    let active: ActiveUserRecordState | null = null;

    if (directPageId) {
      const temp = options?.profile?.temp ?? 26;
      const bandTemp = activeRecordBandTemp({
        userName: favoriter,
        temp,
        apparentTemp: options?.profile?.apparentTemp ?? temp,
      });
      active =
        options?.activeRecord?.pageId === directPageId
          ? options.activeRecord
          : {
              pageId: directPageId,
              date: localDateString(),
              tempBand: tempBandCenter(bandTemp),
            };
    } else {
      active = await resolveActiveUserRecordForFavorites(favoriter, options);
    }

    if (!active) {
      return {
        ok: true,
        data: { cards: [], activeUserRecord: null },
        source: "notion",
      };
    }

    const recordIds = await readActiveFavoriteIds(active.pageId);
    if (recordIds.length === 0) {
      return {
        ok: true,
        data: { cards: [], activeUserRecord: active },
        source: "notion",
      };
    }

    const idFieldType = await getRecordIdFieldType();
    const records = await queryRecordsByRecordIds(recordIds, idFieldType);
    const cards = recordsToInspirationCards(records);
    return {
      ok: true,
      data: { cards, activeUserRecord: active },
      source: "notion",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "收藏查詢失敗";
    return { ok: false, error: message };
  }
}

/** @deprecated */
export const queryOutfitsFavoritedByUser = queryFavoritedOutfits;
