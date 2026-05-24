import { MAX_OUTFIT_COLORS } from "../../../lib/outfit-colors";

export { MAX_OUTFIT_COLORS };

/** 上著標籤（Notion Multi-select 選項須完全一致） */
export const UPPER_BODY_TAGS = [
  "背心",
  "內搭衣",
  "薄 T",
  "薄長袖",
  "T 恤",
  "襯衫",
  "Polo 衫",
  "薄針織",
  "薄衛衣",
  "外套",
  "夾克",
  "牛仔外套",
  "開襟衫",
  "毛衣外罩",
  "羽絨外套",
  "刷毛外套/大衣",
] as const;

/** 下著標籤 */
export const LOWER_BODY_TAGS = [
  "短褲",
  "短裙",
  "薄長褲",
  "涼感褲",
  "牛仔褲",
  "卡其褲",
  "棉褲",
  "直筒裙",
  "A 字裙",
  "厚棉褲",
  "刷毛褲",
  "厚牛仔褲",
  "針織裙",
  "保暖長裙",
] as const;

export const OUTFIT_ANALYSIS_PROMPT = `你是穿搭分類助手。根據照片中可見的服裝，從下列清單中選擇標籤，並標出每件單品在照片上的位置。

規則：
1. 上著 upperBodyTags 可多選（例如同時有 T 恤 + 外套）。
2. 下著 lowerBodyTags 選 0～1 個最符合的項目；若看不到下著則為空陣列。
3. 只能使用清單內的精確字串，不可自創詞彙。
4. tagAnchors：為 upperBodyTags 與 lowerBodyTags 中的每一個標籤各提供一個錨點。
   - anchorX、anchorY 為 0～100 的整數，代表該單品在照片中「可見區域中心」的位置（左上角為 0,0）。
   - 錨點必須落在該件服裝上，不要落在臉、手、背景。
   - label 必須與標籤字串完全一致。
5. colors：列出照片中「可見服裝」的主色（每項含 name 與 share）。
   - name：繁體中文具體色名，例如「黑色」「米白」「卡其色」；避免只寫「深色」「淺色」「彩色」。
   - share：該色在「服裝可見區域」約佔百分比（0～100 整數），四捨五入。
   - 不含膚色、髮色、背景、配件（除非帽子／包包佔畫面很大且顏色明顯）。
   - 先列出所有明顯主色（最多 6 項），依 share 由高到低排序。

上著清單：${UPPER_BODY_TAGS.join("、")}
下著清單：${LOWER_BODY_TAGS.join("、")}

只回傳 JSON，格式如下：
{"upperBodyTags":["T 恤","外套"],"lowerBodyTags":["牛仔褲"],"colors":[{"name":"黑色","share":38},{"name":"米白","share":32},{"name":"卡其色","share":18}],"tagAnchors":[{"label":"T 恤","anchorX":48,"anchorY":45},{"label":"外套","anchorX":62,"anchorY":38},{"label":"牛仔褲","anchorX":50,"anchorY":72}]}`;

function parseColorShare(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(0, Math.min(100, value));
  }
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/%$/, "").trim());
    if (!Number.isNaN(n)) return Math.max(0, Math.min(100, n));
  }
  return 0;
}

function parseColorName(item: unknown): string {
  if (typeof item === "string") {
    return item.trim().replace(/\s+/g, "");
  }
  if (!item || typeof item !== "object") return "";
  const row = item as Record<string, unknown>;
  const fromName = typeof row.name === "string" ? row.name : "";
  const fromColor = typeof row.color === "string" ? row.color : "";
  return (fromName || fromColor).trim().replace(/\s+/g, "");
}

/** 清理 Gemini 回傳的顏色：依 share 取佔比最高的前 N 色（預設 3） */
export function normalizeOutfitColors(
  raw: unknown,
  max = MAX_OUTFIT_COLORS
): string[] {
  if (!Array.isArray(raw)) return [];
  const vague = /^(深|淺|亮|暗)?色$/;
  const rows: Array<{ name: string; share: number; order: number }> = [];

  raw.forEach((item, order) => {
    const name = parseColorName(item);
    if (!name || name.length > 10 || vague.test(name)) return;
    if (rows.some((r) => r.name === name)) return;

    let share = 0;
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      share = parseColorShare(row.share ?? row.percent ?? row.ratio);
    }

    rows.push({ name, share, order });
  });

  const hasShare = rows.some((r) => r.share > 0);
  if (hasShare) {
    rows.sort((a, b) => b.share - a.share || a.order - b.order);
  }

  return rows.slice(0, max).map((r) => r.name);
}

export function filterAllowedTags(
  tags: string[] | undefined,
  allowed: readonly string[]
): string[] {
  if (!Array.isArray(tags)) return [];
  const set = new Set<string>(allowed);
  return [...new Set(tags.filter((t) => set.has(t)))];
}
