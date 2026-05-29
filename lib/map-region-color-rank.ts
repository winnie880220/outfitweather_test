export type TopRegionColorRank = {
  /** 並列第一的全部顏色（穩定排序） */
  colorNames: string[];
  /** 地圖填色用（取並列前兩／三名） */
  colorName: string;
  colorName2?: string;
  colorName3?: string;
};

/** 顏色排行項目（地圖漸層用） */
export type ColorRankForMapFill = {
  name: string;
  hex?: string;
  percent: number;
  count?: number;
};

export type MapColorGradientFill = {
  colorName: string;
  hex: string;
  colorName2?: string;
  hex2?: string;
  colorName3?: string;
  hex3?: string;
};

/** 前三名同 % 時回傳三色漸層；否則維持單色或雙色 */
export function mapGradientFromColorTop3(
  items: ColorRankForMapFill[]
): MapColorGradientFill | null {
  const colors = items.filter((c) => c.name && c.hex);
  if (colors.length === 0) return null;

  const first = colors[0]!;
  const base: MapColorGradientFill = {
    colorName: first.name,
    hex: first.hex!,
  };

  const top3 = colors.slice(0, 3);
  const threeWayTie =
    top3.length >= 3 &&
    top3[0]!.percent === top3[1]!.percent &&
    top3[1]!.percent === top3[2]!.percent &&
    Boolean(top3[1]!.hex && top3[2]!.hex);

  if (threeWayTie) {
    return {
      ...base,
      colorName2: top3[1]!.name,
      hex2: top3[1]!.hex!,
      colorName3: top3[2]!.name,
      hex3: top3[2]!.hex!,
    };
  }

  const second = colors[1];
  if (
    second?.hex &&
    (second.percent === first.percent ||
      (typeof second.count === "number" &&
        typeof first.count === "number" &&
        second.count === first.count))
  ) {
    return {
      ...base,
      colorName2: second.name,
      hex2: second.hex,
    };
  }

  return base;
}

/** 區域顏色票數排行：並列第一時 colorNames 含全部同色票數者 */
export function pickTopRegionColorNames(
  counts: Map<string, number>
): TopRegionColorRank | null {
  if (counts.size === 0) return null;

  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "zh-Hant");
  });

  const topCount = sorted[0]![1];
  const tied = sorted.filter(([, c]) => c === topCount).map(([name]) => name);
  if (tied.length === 0) return null;

  return {
    colorNames: tied,
    colorName: tied[0]!,
    ...(tied[1] ? { colorName2: tied[1] } : {}),
    ...(tied[2] ? { colorName3: tied[2] } : {}),
  };
}
