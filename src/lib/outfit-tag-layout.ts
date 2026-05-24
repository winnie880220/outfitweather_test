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
  { anchorX: 50, anchorY: 70, labelX: 14, labelY: 64 },
  { anchorX: 48, anchorY: 74, labelX: 86, labelY: 68 },
];

function clampPct(n: number): number {
  return Math.min(92, Math.max(8, n));
}

/** 下著錨點：標籤改放左右側，避免落在照片底部被 UI 遮住 */
function labelPositionForLowerBody(
  anchorX: number,
  anchorY: number
): { labelX: number; labelY: number } {
  const toLeft = anchorX >= 46;
  const rawX = toLeft ? anchorX - 26 : anchorX + 26;
  return {
    labelX: clampPct(toLeft ? Math.max(rawX, 22) : Math.min(rawX, 78)),
    labelY: clampPct(anchorY - 8),
  };
}

/** 標籤 pill 往照片邊緣推開，避免遮住身體 */
function labelPositionFromAnchor(
  anchorX: number,
  anchorY: number,
  isLowerBody = false
): { labelX: number; labelY: number } {
  if (isLowerBody || anchorY >= 56) {
    return labelPositionForLowerBody(anchorX, anchorY);
  }

  const cx = 50;
  const cy = 50;
  const dx = anchorX - cx;
  const dy = anchorY - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const push = 24;
  let labelY = clampPct(anchorY + (dy / dist) * push);
  labelY = Math.min(labelY, 80);
  const labelX = clampPct(anchorX + (dx / dist) * push);
  return { labelX, labelY };
}

type LabelBox = { left: number; top: number; w: number; h: number };

function labelOnRight(p: OutfitTagPlacement): boolean {
  return p.labelX > p.anchorX;
}

/** 依文字長度估算 pill 在 viewBox 上的佔比（%） */
function estimateLabelBox(p: OutfitTagPlacement): LabelBox {
  const onRight = labelOnRight(p);
  const w = Math.min(44, 8 + p.label.length * 2.6);
  const h = 7.5;
  const left = onRight ? p.labelX - w : p.labelX;
  return { left, top: p.labelY - h / 2, w, h };
}

function boxesOverlap(a: LabelBox, b: LabelBox, gap = 2): boolean {
  return !(
    a.left + a.w + gap <= b.left ||
    b.left + b.w + gap <= a.left ||
    a.top + a.h + gap <= b.top ||
    b.top + b.h + gap <= a.top
  );
}

/** 避免多個標籤 pill 重疊（迭代推開直到無碰撞或達上限） */
function refinePlacements(placements: OutfitTagPlacement[]): OutfitTagPlacement[] {
  const result = placements.map((p) => ({ ...p }));
  const maxPasses = 16;

  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const boxA = estimateLabelBox(result[i]);
        const boxB = estimateLabelBox(result[j]);
        if (!boxesOverlap(boxA, boxB)) continue;

        moved = true;
        const a = result[i];
        const b = result[j];

        const overlapX =
          Math.min(boxA.left + boxA.w, boxB.left + boxB.w) -
          Math.max(boxA.left, boxB.left);
        const overlapY =
          Math.min(boxA.top + boxA.h, boxB.top + boxB.h) -
          Math.max(boxA.top, boxB.top);

        const push = Math.max(overlapX, overlapY) / 2 + 2.5;
        const sameSide = (a.labelX >= 50) === (b.labelX >= 50);

        if (sameSide && overlapY <= overlapX) {
          const down = b.labelY >= a.labelY ? 1 : -1;
          result[j] = { ...b, labelY: clampPct(b.labelY + push * down) };
        } else if (overlapX <= overlapY) {
          const right = b.labelX >= a.labelX ? 1 : -1;
          result[j] = { ...b, labelX: clampPct(b.labelX + push * right) };
        } else {
          const down = b.labelY >= a.labelY ? 1 : -1;
          result[j] = { ...b, labelY: clampPct(b.labelY + push * down) };
        }
      }
    }

    if (!moved) break;
  }

  return result;
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

  const lowerSet = new Set(lowerBodyTags);
  const ordered = [...upperBodyTags, ...lowerBodyTags];
  const placements: OutfitTagPlacement[] = [];
  let upperSpreadIndex = 0;

  for (const label of ordered) {
    const anchor = byLabel.get(label);
    if (anchor) {
      const ax = clampPct(anchor.anchorX);
      const ay = clampPct(anchor.anchorY);
      const isLower = lowerSet.has(label);
      let labelPos = labelPositionFromAnchor(ax, ay, isLower);

      if (!isLower && Math.abs(ax - 50) < 14 && ay < 56) {
        const toLeft = upperSpreadIndex % 2 === 0;
        labelPos = {
          labelX: clampPct(toLeft ? 16 : 84),
          labelY: clampPct(ay - 6 + upperSpreadIndex * 7),
        };
        upperSpreadIndex += 1;
      }

      placements.push({
        label,
        anchorX: ax,
        anchorY: ay,
        ...labelPos,
      });
    }
  }

  return refinePlacements(placements);
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
  return refinePlacements(buildFromHeuristics(upperBodyTags, lowerBodyTags));
}
