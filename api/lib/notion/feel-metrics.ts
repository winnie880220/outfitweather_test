/** 三向度體感（對應 Notion Breathability / Wrapping / Stuffiness） */
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
      tone: "#6D8F9E",
      hint: breathabilityHint(m.breathability),
    });
  }
  if (m.wrapping != null) {
    chips.push({
      key: "wrapping",
      label: "包裹",
      value: m.wrapping,
      tone: "#7A9178",
      hint: wrappingHint(m.wrapping),
    });
  }
  if (m.stuffiness != null) {
    chips.push({
      key: "stuffiness",
      label: "悶熱",
      value: m.stuffiness,
      tone: "#AD7A62",
      hint: stuffinessHint(m.stuffiness),
    });
  }
  return chips;
}
