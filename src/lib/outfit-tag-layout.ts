/** 單一服飾標籤在照片上的定位（百分比座標，0–100） */
export type OutfitTagPlacement = {
  label: string;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
};

export type OutfitTagAnchor = {
  label: string;
  anchorX: number;
  anchorY: number;
};

const OUTER_UPPER = new Set([
  "外套",
  "夾克",
  "牛仔外套",
  "羽絨外套",
  "刷毛外套/大衣",
  "開襟衫",
  "毛衣外罩",
]);

type UpperZone = "outer" | "mid";

function classifyUpper(tag: string): UpperZone {
  if (OUTER_UPPER.has(tag)) return "outer";
  return "mid";
}

const UPPER_SLOTS: Record<
  UpperZone,
  Array<{ anchorX: number; anchorY: number; labelX: number; labelY: number }>
> = {
  outer: [
    { anchorX: 62, anchorY: 36, labelX: 86, labelY: 22 },
    { anchorX: 58, anchorY: 32, labelX: 88, labelY: 14 },
  ],
  mid: [
    { anchorX: 50, anchorY: 44, labelX: 12, labelY: 36 },
    { anchorX: 48, anchorY: 40, labelX: 86, labelY: 38 },
    { anchorX: 52, anchorY: 48, labelX: 14, labelY: 52 },
  ],
};

const LOWER_SLOTS: Array<{
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
}> = [
  { anchorX: 50, anchorY: 68, labelX: 12, labelY: 58 },
  { anchorX: 48, anchorY: 74, labelX: 86, labelY: 66 },
];

function clampPct(n: number): number {
  return Math.min(92, Math.max(8, n));
}

/** 標籤 pill 往照片邊緣推開，避免遮住身體 */
function labelPositionFromAnchor(
  anchorX: number,
  anchorY: number
): { labelX: number; labelY: number } {
  const cx = 50;
  const cy = 50;
  const dx = anchorX - cx;
  const dy = anchorY - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const push = 20;
  return {
    labelX: clampPct(anchorX + (dx / dist) * push),
    labelY: clampPct(anchorY + (dy / dist) * push),
  };
}

function buildFromAnchors(
  upperBodyTags: string[],
  lowerBodyTags: string[],
  tagAnchors: OutfitTagAnchor[]
): OutfitTagPlacement[] {
  const allowed = new Set([...upperBodyTags, ...lowerBodyTags]);
  const byLabel = new Map(
    tagAnchors
      .filter((a) => allowed.has(a.label))
      .map((a) => [a.label, a] as const)
  );

  const ordered = [...upperBodyTags, ...lowerBodyTags];
  const placements: OutfitTagPlacement[] = [];

  for (const label of ordered) {
    const anchor = byLabel.get(label);
    if (anchor) {
      const ax = clampPct(anchor.anchorX);
      const ay = clampPct(anchor.anchorY);
      placements.push({
        label,
        anchorX: ax,
        anchorY: ay,
        ...labelPositionFromAnchor(ax, ay),
      });
    }
  }

  return placements;
}

function buildFromHeuristics(
  upperBodyTags: string[],
  lowerBodyTags: string[]
): OutfitTagPlacement[] {
  const placements: OutfitTagPlacement[] = [];
  const byZone: Record<UpperZone, string[]> = { outer: [], mid: [] };

  for (const tag of upperBodyTags) {
    byZone[classifyUpper(tag)].push(tag);
  }

  (["outer", "mid"] as UpperZone[]).forEach((zone) => {
    const tags = byZone[zone];
    const slots = UPPER_SLOTS[zone];
    tags.forEach((label, i) => {
      const slot = slots[i % slots.length];
      placements.push({ label, ...slot });
    });
  });

  lowerBodyTags.slice(0, 2).forEach((label, i) => {
    const slot = LOWER_SLOTS[i % LOWER_SLOTS.length];
    placements.push({ label, ...slot });
  });

  return placements;
}

/** 依 AI 錨點或啟發式規則產生標籤位置 */
export function buildOutfitTagPlacements(
  upperBodyTags: string[],
  lowerBodyTags: string[],
  tagAnchors?: OutfitTagAnchor[]
): OutfitTagPlacement[] {
  if (tagAnchors?.length) {
    const fromAi = buildFromAnchors(upperBodyTags, lowerBodyTags, tagAnchors);
    if (fromAi.length > 0) return fromAi;
  }
  return buildFromHeuristics(upperBodyTags, lowerBodyTags);
}
