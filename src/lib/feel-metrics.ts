/** 與 api/lib/notion/feel-metrics.ts 對齊，供前端顯示體感三向度 */

/** 全站統一體感色（介於亮藍綠橘與土色之間的霧面色） */
export const FEEL_TONES = {
  breathability: "#6D8F9E",
  wrapping: "#7A9178",
  stuffiness: "#AD7A62",
} as const;

export const FEEL_TRACK_EMPTY = "#ebe8e4";

export type FeelMetrics = {
  breathability?: number;
  wrapping?: number;
  stuffiness?: number;
};

export type FeelMetricChip = {
  key: keyof FeelMetrics;
  label: string;
  value: number;
  tone: string;
  hint: string;
};

export function hasFeelMetrics(m: FeelMetrics): boolean {
  return (
    m.breathability != null || m.wrapping != null || m.stuffiness != null
  );
}

function breathabilityHint(v: number): string {
  if (v >= 70) return "極佳";
  if (v >= 40) return "舒適";
  return "不通風";
}

function wrappingHint(v: number): string {
  if (v >= 70) return "緊緻";
  if (v >= 40) return "合身";
  return "寬鬆";
}

function stuffinessHint(v: number): string {
  if (v >= 70) return "極悶";
  if (v >= 40) return "微悶";
  return "乾爽";
}

export function feelMetricChips(m: FeelMetrics): FeelMetricChip[] {
  const chips: FeelMetricChip[] = [];
  if (m.breathability != null) {
    chips.push({
      key: "breathability",
      label: "透氣",
      value: m.breathability,
      tone: FEEL_TONES.breathability,
      hint: breathabilityHint(m.breathability),
    });
  }
  if (m.wrapping != null) {
    chips.push({
      key: "wrapping",
      label: "包裹",
      value: m.wrapping,
      tone: FEEL_TONES.wrapping,
      hint: wrappingHint(m.wrapping),
    });
  }
  if (m.stuffiness != null) {
    chips.push({
      key: "stuffiness",
      label: "悶熱",
      value: m.stuffiness,
      tone: FEEL_TONES.stuffiness,
      hint: stuffinessHint(m.stuffiness),
    });
  }
  return chips;
}
