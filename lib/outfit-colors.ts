/** 單張穿搭照片最多保留／顯示的主色數量 */
export const MAX_OUTFIT_COLORS = 3;

/** 佔比最高的主色（AI colors 已依 share 由高到低排序） */
export function dominantOutfitColor(
  colors: string[] | undefined | null
): string | null {
  if (!colors?.length) return null;
  return limitOutfitColors(colors)[0] ?? null;
}

/**
 * 排行榜／地圖分區填色：每筆紀錄只計一個主色（第一色，非三色加總）。
 * Notion 寫入時亦應將主色排在 Color 多選的第一項。
 */
export function rankingColorsFromRecord(
  colors: string[] | undefined | null
): string[] {
  const first = dominantOutfitColor(colors);
  return first ? [first] : [];
}

export function limitOutfitColors(
  colors: string[],
  max = MAX_OUTFIT_COLORS
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of colors) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}
