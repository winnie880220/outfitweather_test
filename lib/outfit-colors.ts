/** 單張穿搭照片最多保留／顯示的主色數量 */
export const MAX_OUTFIT_COLORS = 3;

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
