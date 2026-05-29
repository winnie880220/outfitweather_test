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
    location?: string;
    gender?: UserGender | null;
    temp?: number;
    apparentTemp?: number;
    weather?: string;
  }
): Promise<ToggleFavoriteResult> {
  return apiPost<ToggleFavoriteResult>("/api/favorites", {
    favoriterUserName,
    outfitPageId,
    favorited,
    ...(options?.activeUserRecord
      ? { activeUserRecord: options.activeUserRecord }
      : {}),
    ...(options?.location ? { location: options.location } : {}),
    ...(options?.gender ? { gender: options.gender } : {}),
    ...(typeof options?.temp === "number" ? { temp: options.temp } : {}),
    ...(typeof options?.apparentTemp === "number"
      ? { apparentTemp: options.apparentTemp }
      : {}),
    ...(options?.weather ? { weather: options.weather } : {}),
  });
}

/** 查詢今日 active 列 Favorite 內的穿搭卡片 */
export async function fetchUserFavorites(
  favoriterUserName: string,
  options?: {
    activeUserRecord?: ActiveUserRecord | null;
    temp?: number;
    apparentTemp?: number;
    /** 剛 toggle 後讀同一列 Favorite */
    readPageIdDirectly?: boolean;
  }
): Promise<UserFavoritesQueryResult> {
  const params = new URLSearchParams({ userName: favoriterUserName.trim() });
  if (options?.activeUserRecord?.pageId) {
    params.set("activePageId", options.activeUserRecord.pageId);
  }
  if (options?.readPageIdDirectly) {
    params.set("readDirect", "1");
    if (options.activeUserRecord?.date) {
      params.set("activeDate", options.activeUserRecord.date);
    }
    if (typeof options.activeUserRecord?.tempBand === "number") {
      params.set("activeTempBand", String(options.activeUserRecord.tempBand));
    }
  }
  if (typeof options?.temp === "number" && !Number.isNaN(options.temp)) {
    params.set("temp", String(Math.round(options.temp)));
  }
  if (typeof options?.apparentTemp === "number" && !Number.isNaN(options.apparentTemp)) {
    params.set("apparentTemp", String(Math.round(options.apparentTemp)));
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
