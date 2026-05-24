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
  profile?: Pick<ActiveUserRecordContext, "location" | "gender" | "temp" | "weather">;
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
    const page = await notionRequest<PageResponse>(`/pages/${active.pageId}`, {
      method: "GET",
    });
    const current = readFavoriteIds(page.properties);
    const set = new Set(current);
    if (params.favorited) set.add(outfitRecordId);
    else set.delete(outfitRecordId);
    const next = [...set];
    await setFavoriteIds(active.pageId, next);

    return {
      ok: true,
      data: {
        favoriteIds: next,
        activeUserRecord: {
          pageId: active.pageId,
          date: active.date,
          tempBand: active.tempBand,
        },
      },
      source: "notion",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "收藏更新失敗";
    return { ok: false, error: message };
  }
}

async function collectFavoriteIdsForUser(
  favoriterUserName: string
): Promise<string[]> {
  const pages = await queryRecordsByUserName(favoriterUserName);
  const ids = new Set<string>();
  for (const page of pages) {
    for (const id of readFavoriteIds(page.properties)) {
      ids.add(id);
    }
  }
  return [...ids];
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
