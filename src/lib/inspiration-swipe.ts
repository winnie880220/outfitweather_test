const STORAGE_KEY = "outfitweather_inspiration_swipe";

export interface InspirationSwipeState {
  /** 例：25-27（tempMin–tempMax） */
  rangeKey: string;
  /** 略過，此區間內不再顯示 */
  skippedIds: string[];
  /** 收藏（跨區間保留 id 紀錄） */
  savedIds: string[];
  /** 收藏後排到堆疊最後的順序 */
  tailIds: string[];
}

export function buildInspirationRangeKey(
  insights: { tempMin: number; tempMax: number } | null,
  fallbackTemp?: number
): string | null {
  if (insights) return `${insights.tempMin}-${insights.tempMax}`;
  if (fallbackTemp != null) {
    const t = Math.round(fallbackTemp);
    return `${t - 1}-${t + 1}`;
  }
  return null;
}

export function loadInspirationSwipe(): InspirationSwipeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InspirationSwipeState>;
    if (typeof parsed.rangeKey !== "string") return null;
    return {
      rangeKey: parsed.rangeKey,
      skippedIds: Array.isArray(parsed.skippedIds) ? parsed.skippedIds.filter(Boolean) : [],
      savedIds: Array.isArray(parsed.savedIds) ? parsed.savedIds.filter(Boolean) : [],
      tailIds: Array.isArray(parsed.tailIds) ? parsed.tailIds.filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

export function saveInspirationSwipe(state: InspirationSwipeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("inspiration-swipe save failed:", e);
  }
}

export function clearInspirationSwipe(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("inspiration-swipe clear failed:", e);
  }
}

/** 天氣區間變更時清空略過與堆疊尾端；收藏 id 保留 */
export function syncInspirationSwipeRange(rangeKey: string): InspirationSwipeState {
  const prev = loadInspirationSwipe();
  if (prev?.rangeKey === rangeKey) return prev;
  const next: InspirationSwipeState = {
    rangeKey,
    skippedIds: [],
    savedIds: prev?.savedIds ?? [],
    tailIds: [],
  };
  saveInspirationSwipe(next);
  return next;
}

export function recordInspirationSwipe(
  cardId: string,
  liked: boolean,
  rangeKey: string
): InspirationSwipeState {
  const base = syncInspirationSwipeRange(rangeKey);
  const skipped = new Set(base.skippedIds);
  const saved = new Set(base.savedIds);
  let tailIds = base.tailIds.filter((id) => id !== cardId);

  if (liked) {
    saved.add(cardId);
    skipped.delete(cardId);
    tailIds.push(cardId);
  } else {
    skipped.add(cardId);
    saved.delete(cardId);
  }

  const next: InspirationSwipeState = {
    rangeKey,
    skippedIds: [...skipped],
    savedIds: [...saved],
    tailIds,
  };
  saveInspirationSwipe(next);
  return next;
}

export function isInspirationCardSaved(
  state: InspirationSwipeState | null,
  cardId: string
): boolean {
  return Boolean(state?.savedIds.includes(cardId));
}

/** 過濾略過項目，並將收藏項目排到堆疊最後 */
export function buildInspirationDeck<T extends { id: string }>(
  cards: T[],
  state: InspirationSwipeState | null,
  rangeKey: string | null
): T[] {
  if (!rangeKey || !state || state.rangeKey !== rangeKey) return cards;

  const skipped = new Set(state.skippedIds);
  const visible = cards.filter((c) => !skipped.has(c.id));
  if (visible.length <= 1) return visible;

  const tailSet = new Set(state.tailIds);
  const byId = new Map(visible.map((c) => [c.id, c]));
  const head = visible.filter((c) => !tailSet.has(c.id));
  const tail = state.tailIds.map((id) => byId.get(id)).filter((c): c is T => Boolean(c));

  return [...head, ...tail];
}
