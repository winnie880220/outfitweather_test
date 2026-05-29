import type { InspirationItem } from "./api/outfit-insights";

const STORAGE_PREFIX = "outfitweather_favorites_";

export type InspirationFavoritesState = {
  userName: string;
  /** Notion page id → 卡片快照 */
  items: Record<string, InspirationItem>;
};

function storageKey(userName: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(userName.trim())}`;
}

function emptyState(userName = ""): InspirationFavoritesState {
  return { userName: userName.trim(), items: {} };
}

export function loadInspirationFavorites(userName: string): InspirationFavoritesState {
  const trimmed = userName.trim();
  if (!trimmed || typeof window === "undefined") return emptyState(trimmed);

  try {
    const raw = localStorage.getItem(storageKey(trimmed));
    if (!raw) return emptyState(trimmed);
    const parsed = JSON.parse(raw) as Partial<InspirationFavoritesState>;
    const items = parsed.items && typeof parsed.items === "object" ? parsed.items : {};
    const cleaned: Record<string, InspirationItem> = {};
    for (const [id, card] of Object.entries(items)) {
      if (card && typeof card === "object" && typeof card.id === "string") {
        cleaned[id] = card as InspirationItem;
      }
    }
    return { userName: trimmed, items: cleaned };
  } catch {
    return emptyState(trimmed);
  }
}

export function saveInspirationFavorites(state: InspirationFavoritesState): void {
  const trimmed = state.userName.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(storageKey(trimmed), JSON.stringify({ ...state, userName: trimmed }));
  } catch (e) {
    console.warn("inspiration-favorites save failed:", e);
  }
}

export function favoritesStateFromCards(
  userName: string,
  cards: InspirationItem[]
): InspirationFavoritesState {
  const items: Record<string, InspirationItem> = {};
  for (const card of cards) {
    items[card.id] = card;
  }
  return { userName: userName.trim(), items };
}

/** 合併伺服器回傳與剛操作的卡片（查詢空結果或缺圖時仍保留愛心／收藏列） */
export function mergeFavoritesFromServer(
  userName: string,
  cards: InspirationItem[],
  patch?: { card: InspirationItem; favorited: boolean }
): InspirationFavoritesState {
  const state = favoritesStateFromCards(userName, cards);
  if (!patch) return state;
  if (patch.favorited) {
    state.items[patch.card.id] = state.items[patch.card.id] ?? patch.card;
  } else {
    delete state.items[patch.card.id];
  }
  return state;
}

export function listFavoriteCards(state: InspirationFavoritesState): InspirationItem[] {
  return Object.values(state.items);
}

export function isInspirationFavorite(
  state: InspirationFavoritesState,
  cardId: string
): boolean {
  return Boolean(state.items[cardId]);
}

/** 僅更新記憶體狀態；收藏列表以 Notion active 列為準，不寫入 localStorage */
export function addInspirationFavorite(
  state: InspirationFavoritesState,
  card: InspirationItem
): InspirationFavoritesState {
  return {
    userName: state.userName,
    items: { ...state.items, [card.id]: card },
  };
}

export function removeInspirationFavorite(
  state: InspirationFavoritesState,
  cardId: string
): InspirationFavoritesState {
  if (!state.items[cardId]) return state;
  const items = { ...state.items };
  delete items[cardId];
  return { userName: state.userName, items };
}

export function clearInspirationFavorites(userName: string): void {
  const trimmed = userName.trim();
  if (!trimmed) return;
  try {
    localStorage.removeItem(storageKey(trimmed));
  } catch (e) {
    console.warn("inspiration-favorites clear failed:", e);
  }
}

/** 清除所有使用者的靈感收藏快取（離開 App 時） */
export function clearAllInspirationFavoritesLocal(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch (e) {
    console.warn("inspiration-favorites clear all failed:", e);
  }
}
