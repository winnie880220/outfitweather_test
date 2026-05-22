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

上著清單：${UPPER_BODY_TAGS.join("、")}
下著清單：${LOWER_BODY_TAGS.join("、")}

只回傳 JSON，格式如下：
{"upperBodyTags":["T 恤","外套"],"lowerBodyTags":["牛仔褲"],"tagAnchors":[{"label":"T 恤","anchorX":48,"anchorY":45},{"label":"外套","anchorX":62,"anchorY":38},{"label":"牛仔褲","anchorX":50,"anchorY":72}]}`;

export function filterAllowedTags(
  tags: string[] | undefined,
  allowed: readonly string[]
): string[] {
  if (!Array.isArray(tags)) return [];
  const set = new Set<string>(allowed);
  return [...new Set(tags.filter((t) => set.has(t)))];
}
