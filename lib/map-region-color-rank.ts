/** 區域顏色票數排行：並列第一時回傳兩色（穩定排序，避免填色亂跳） */
export function pickTopRegionColorNames(
  counts: Map<string, number>
): { colorName: string; colorName2?: string } | null {
  if (counts.size === 0) return null;

  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "zh-Hant");
  });

  const topCount = sorted[0]![1];
  const tied = sorted.filter(([, c]) => c === topCount).map(([name]) => name);

  if (tied.length >= 2) {
    return { colorName: tied[0]!, colorName2: tied[1]! };
  }
  return { colorName: tied[0]! };
}
