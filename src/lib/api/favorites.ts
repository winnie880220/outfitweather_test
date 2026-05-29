import type { UserGender } from "../../types/api";
import type { InspirationItem } from "./outfit-insights";
import { apiGet, apiPost } from "./client";
import type { ActiveUserRecord } from "../session-storage";

export type UserFavoritesQueryResult = {
  cards: InspirationItem[];
  activeUserRecord: ActiveUserRecord | null;
};

export type ToggleFavoriteResult = {
  favoriteIds: string[];
  activeUserRecord: ActiveUserRecord;
};

/** 收藏／取消收藏（前端傳穿搭 page id，伺服器寫入 Favorite 的 ID 欄位值） */
export async function toggleOutfitFavorite(
  favoriterUserName: string,
  outfitPageId: string,
  favorited: boolean,
  options?: {
    activeUserRecord?: ActiveUserRecord | null;
    gender?: UserGender | null;
  }
): Promise<ToggleFavoriteResult> {
  return apiPost<ToggleFavoriteResult>("/api/favorites", {
    favoriterUserName,
    outfitPageId,
    favorited,
    ...(options?.activeUserRecord
      ? { activeUserRecord: options.activeUserRecord }
      : {}),
    ...(options?.gender ? { gender: options.gender } : {}),
  });
}

/** 查詢今日 active 列 Favorite 內的穿搭卡片 */
export async function fetchUserFavorites(
  favoriterUserName: string,
  options?: {
    activeUserRecord?: ActiveUserRecord | null;
    gender?: UserGender | null;
    /** 剛 toggle 後讀同一列 Favorite */
    readPageIdDirectly?: boolean;
  }
): Promise<UserFavoritesQueryResult> {
  const params = new URLSearchParams({ userName: favoriterUserName.trim() });
  if (options?.gender) {
    params.set("gender", options.gender);
  }
  if (options?.activeUserRecord?.pageId) {
    params.set("activePageId", options.activeUserRecord.pageId);
  }
  if (options?.readPageIdDirectly) {
    params.set("readDirect", "1");
    if (options.activeUserRecord?.date) {
      params.set("activeDate", options.activeUserRecord.date);
    }
  }
  const data = await apiGet<UserFavoritesQueryResult | InspirationItem[]>(
    `/api/favorites?${params}`
  );
  if (Array.isArray(data)) {
    return { cards: data, activeUserRecord: options?.activeUserRecord ?? null };
  }
  return {
    cards: data.cards ?? [],
    activeUserRecord: data.activeUserRecord ?? null,
  };
}
