import type { ApiResponse, UserGender } from "../types";
import { getNotionDatabaseId, isNotionConfigured } from "../env";
import { queryRecordsByRecordIds } from "./query-records";
import { notionRequest } from "./client";
import { readRecordIdFromProperties, type NotionProp } from "./parse-page";
import {
  recordsToInspirationCards,
  type InspirationItem,
} from "./outfit-insights";
import { RECORDS_DB } from "./schema";
import { taiwanDateString } from "../../../lib/taiwan-date";
import { isNotionArchivedError } from "./notion-errors";
import {
  ensureActiveUserRecord,
  findActiveUserRecordInNotion,
  validateActiveUserPage,
  type ActiveUserRecordState,
} from "./user-active-record";

type PageResponse = {
  id: string;
  archived?: boolean;
  properties: Record<string, NotionProp>;
};

type ReadActiveFavoriteResult =
  | { ok: true; favoriteIds: string[] }
  | { ok: false; reason: "archived" | "missing" };

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
  if (page.archived) {
    throw new Error("此穿搭已不存在");
  }
  const recordId = readRecordIdFromProperties(page.properties);
  if (!recordId) {
    throw new Error("此穿搭缺少 ID 欄位，無法收藏");
  }
  return {
    owner: pageOwnerName(page.properties).trim(),
    recordId,
  };
}

async function readActiveFavoriteIds(
  activePageId: string
): Promise<ReadActiveFavoriteResult> {
  try {
    const page = await notionRequest<PageResponse>(`/pages/${activePageId}`, {
      method: "GET",
    });
    if (page.archived) return { ok: false, reason: "archived" };
    return { ok: true, favoriteIds: readFavoriteIds(page.properties) };
  } catch (error) {
    if (isNotionArchivedError(error)) {
      return { ok: false, reason: "archived" };
    }
    return { ok: false, reason: "missing" };
  }
}

function buildActiveContext(
  favoriter: string,
  options?: QueryFavoritedOutfitsOptions
): { userName: string; gender?: UserGender } {
  const gender = options?.gender;
  return {
    userName: favoriter.trim(),
    ...(gender === "男生" || gender === "女生" || gender === "不分"
      ? { gender }
      : {}),
  };
}

/** 容器列已封存／不可用時，改找或新建當日收藏列 */
async function recoverActiveUserRecord(
  ctx: { userName: string; gender?: UserGender },
  createIfMissing: boolean
): Promise<ActiveUserRecordState | null> {
  const found = await findActiveUserRecordInNotion(ctx.userName);
  if (found) return found;
  if (!createIfMissing) return null;

  const ensured = await ensureActiveUserRecord(ctx, null, {
    createIfMissing: true,
  });
  if (!ensured.ok || !ensured.data) return null;
  return { pageId: ensured.data.pageId, date: ensured.data.date };
}

/** 從 Favorite 移除已封存或查不到的穿搭 ID，並回傳仍存在的 recordId */
function favoriteIdsWithExistingOutfits(
  favoriteIds: string[],
  records: Awaited<ReturnType<typeof queryRecordsByRecordIds>>
): string[] {
  return favoriteIds.filter((fid) =>
    records.some((r) => favoriteRecordIdsMatch(r.recordId, fid))
  );
}

/** 將 Favorite 同步為仍存在的 ID；容器已封存時改寫入新找到的列 */
async function pruneFavoritesOnActive(
  ctx: { userName: string; gender?: UserGender },
  active: ActiveUserRecordState,
  favoriteIds: string[],
  records: Awaited<ReturnType<typeof queryRecordsByRecordIds>>
): Promise<ActiveUserRecordState | null> {
  const pruned = favoriteIdsWithExistingOutfits(favoriteIds, records);
  if (pruned.length === favoriteIds.length) return active;

  try {
    await setFavoriteIds(active.pageId, pruned);
    return active;
  } catch (error) {
    if (!isNotionArchivedError(error)) throw error;
  }

  const recovered = await recoverActiveUserRecord(ctx, false);
  if (!recovered) return null;

  try {
    await setFavoriteIds(recovered.pageId, pruned);
  } catch (error) {
    if (!isNotionArchivedError(error)) throw error;
  }
  return recovered;
}

/** 加入收藏：GET active → 合併 ID → PATCH */
async function addFavoriteOnActiveRow(
  active: ActiveUserRecordState,
  outfitRecordId: string
): Promise<string[]> {
  const read = await readActiveFavoriteIds(active.pageId);
  if (!read.ok) {
    throw new Error(read.reason === "archived" ? "ACTIVE_ARCHIVED" : "ACTIVE_MISSING");
  }
  const merged = [...read.favoriteIds];
  if (!merged.some((id) => favoriteRecordIdsMatch(id, outfitRecordId))) {
    merged.push(outfitRecordId);
  }
  await setFavoriteIds(active.pageId, merged);
  return merged;
}

/** 取消收藏：只更新今日 active 列 */
async function removeFavoriteOnActiveRow(
  active: ActiveUserRecordState,
  outfitRecordId: string
): Promise<string[]> {
  const read = await readActiveFavoriteIds(active.pageId);
  if (!read.ok) {
    throw new Error(read.reason === "archived" ? "ACTIVE_ARCHIVED" : "ACTIVE_MISSING");
  }
  const next = withoutFavoriteRecordId(read.favoriteIds, outfitRecordId);
  await setFavoriteIds(active.pageId, next);
  return next;
}

async function resolveActiveUserRecordForFavorites(
  favoriter: string,
  options: QueryFavoritedOutfitsOptions | undefined,
  mode: { createIfMissing: boolean }
): Promise<ActiveUserRecordState | null> {
  const userName = favoriter.trim();
  if (!userName) return null;

  const date = taiwanDateString();
  const ctx = buildActiveContext(favoriter, options);

  const pageIdsToTry = [
    options?.activePageId?.trim(),
    options?.activeRecord?.pageId?.trim(),
  ].filter((id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index);

  for (const pageId of pageIdsToTry) {
    const valid = await validateActiveUserPage(pageId, userName, date);
    if (valid) return valid;
  }

  const found = await findActiveUserRecordInNotion(userName);
  if (found) return found;

  if (!mode.createIfMissing) return null;

  const ensured = await ensureActiveUserRecord(ctx, options?.activeRecord ?? null, {
    createIfMissing: true,
  });
  if (!ensured.ok || !ensured.data) return null;
  return {
    pageId: ensured.data.pageId,
    date: ensured.data.date,
  };
}

export type ToggleFavoriteParams = {
  favoriterUserName: string;
  /** 被收藏穿搭的 Notion page id（伺服器會換算成 ID 欄位值寫入 Favorite） */
  outfitPageId: string;
  favorited: boolean;
  activeRecord?: ActiveUserRecordState | null;
  gender?: UserGender;
};

export type QueryFavoritedOutfitsOptions = {
  activePageId?: string;
  activeRecord?: ActiveUserRecordState | null;
  gender?: UserGender;
  /** 剛寫入 Favorite 後，直接讀此 pageId，不重新 resolve */
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

  const resolveOptions: QueryFavoritedOutfitsOptions = {
    activeRecord: params.activeRecord ?? null,
    gender: params.gender,
  };
  let active = await resolveActiveUserRecordForFavorites(
    favoriter,
    resolveOptions,
    { createIfMissing: params.favorited }
  );

  if (!active) {
    return {
      ok: false,
      error: params.favorited
        ? "無法建立收藏列，請稍後再試"
        : "找不到今日收藏列",
    };
  }

  try {
    let favoriteIds: string[];
    try {
      favoriteIds = params.favorited
        ? await addFavoriteOnActiveRow(active, outfitRecordId)
        : await removeFavoriteOnActiveRow(active, outfitRecordId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      const containerLost =
        msg === "ACTIVE_ARCHIVED" ||
        msg === "ACTIVE_MISSING" ||
        isNotionArchivedError(error);

      if (!containerLost) throw error;

      const recovered = await recoverActiveUserRecord(
        buildActiveContext(favoriter, resolveOptions),
        params.favorited
      );
      if (!recovered) {
        return {
          ok: false,
          error: params.favorited
            ? "無法建立收藏列，請稍後再試"
            : "找不到今日收藏列",
        };
      }
      active = recovered;

      favoriteIds = params.favorited
        ? await addFavoriteOnActiveRow(active, outfitRecordId)
        : [];
    }

    return {
      ok: true,
      data: {
        favoriteIds,
        activeUserRecord: {
          pageId: active.pageId,
          date: active.date,
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
      const date = taiwanDateString();
      active = await validateActiveUserPage(directPageId, favoriter, date);
    } else {
      active = await resolveActiveUserRecordForFavorites(favoriter, options, {
        createIfMissing: false,
      });
    }

    if (!active) {
      return {
        ok: true,
        data: { cards: [], activeUserRecord: null },
        source: "notion",
      };
    }

    let read = await readActiveFavoriteIds(active.pageId);
    if (!read.ok) {
      active = await recoverActiveUserRecord(
        buildActiveContext(favoriter, options),
        false
      );
      if (!active) {
        return {
          ok: true,
          data: { cards: [], activeUserRecord: null },
          source: "notion",
        };
      }
      read = await readActiveFavoriteIds(active.pageId);
    }

    if (!read.ok || read.favoriteIds.length === 0) {
      return {
        ok: true,
        data: { cards: [], activeUserRecord: active },
        source: "notion",
      };
    }

    const idFieldType = await getRecordIdFieldType();
    const records = await queryRecordsByRecordIds(read.favoriteIds, idFieldType);
    const activeAfterPrune = await pruneFavoritesOnActive(
      buildActiveContext(favoriter, options),
      active,
      read.favoriteIds,
      records
    );
    if (!activeAfterPrune) {
      return {
        ok: true,
        data: { cards: [], activeUserRecord: null },
        source: "notion",
      };
    }
    active = activeAfterPrune;

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
