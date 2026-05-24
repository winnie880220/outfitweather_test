/** 穿搭 AI 回傳的繁中色名 → 地圖色票 hex（近似值） */
const COLOR_HEX: Record<string, string> = {
  黑色: "#2c2825",
  黑: "#2c2825",
  白色: "#f5f1e9",
  白: "#f5f1e9",
  米白: "#ede6d8",
  米: "#ede6d8",
  象牙白: "#f8f4ec",
  灰色: "#a8a29e",
  灰: "#a8a29e",
  深灰: "#78716c",
  淺灰: "#d6d3d1",
  銀灰: "#c4c0ba",
  紅色: "#c45c5c",
  紅: "#c45c5c",
  酒紅: "#8b3a3a",
  粉色: "#e8a0a8",
  粉: "#e8a0a8",
  橘色: "#d97757",
  橘: "#d97757",
  橙色: "#e8956a",
  橙: "#e8956a",
  黃色: "#e8c547",
  黃: "#e8c547",
  卡其色: "#b8a066",
  卡其: "#b8a066",
  棕色: "#8b7355",
  棕: "#8b7355",
  咖啡色: "#6b5344",
  咖啡: "#6b5344",
  綠色: "#6b9b7a",
  綠: "#6b9b7a",
  墨綠: "#3d5c4a",
  藍色: "#5b8fd4",
  藍: "#5b8fd4",
  牛仔藍: "#4a6fa5",
  丹寧藍: "#4a6fa5",
  海軍藍: "#2c3e6b",
  深藍: "#3d4f6b",
  淺藍: "#9ec5e8",
  紫色: "#9b7bb8",
  紫: "#9b7bb8",
  薰衣草: "#b8a8d4",
  米色: "#e8dcc8",
  駝色: "#c4a574",
  奶茶色: "#d4b896",
  奶茶: "#d4b896",
  杏色: "#e8c4a0",
  裸色: "#dcc4b0",
  金色: "#c9a227",
  金: "#c9a227",
  銀色: "#b8b4ae",
};

function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

/** 將色名轉為地圖用 hex；未知色名以穩定色相生成 */
/** 地圖淺色填色需較深邊框，避免與底圖米色融在一起 */
export function isLightMapFillHex(hex: string): boolean {
  const trimmed = hex.trim().toLowerCase();
  if (trimmed.startsWith("hsl")) return false;
  const raw = trimmed.replace("#", "");
  if (raw.length < 6) return false;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.82;
}

export function colorNameToHex(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "#a8a29e";
  const direct = COLOR_HEX[trimmed];
  if (direct) return direct;
  for (const [key, hex] of Object.entries(COLOR_HEX)) {
    if (trimmed.includes(key) || key.includes(trimmed)) return hex;
  }
  const hue = hashHue(trimmed);
  return `hsl(${hue}, 42%, 58%)`;
}

export type ColorChipTheme = {
  fill: string;
  bg: string;
  border: string;
  text: string;
};

/** 標籤用：柔和底色 + 色票，文字維持可讀 */
export function getColorChipTheme(name: string): ColorChipTheme {
  const fill = colorNameToHex(name);
  const text = "#44403c";
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("color", "color-mix(in srgb, red 50%, white)")) {
    return {
      fill,
      bg: `color-mix(in srgb, ${fill} 34%, #faf7f2)`,
      border: `color-mix(in srgb, ${fill} 42%, #e7e5e4)`,
      text,
    };
  }
  return {
    fill,
    bg: "#faf7f2",
    border: "#e7e5e4",
    text,
  };
}
