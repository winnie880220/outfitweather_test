import { apiPost } from "./client";

export type OutfitTagAnchor = {
  label: string;
  anchorX: number;
  anchorY: number;
};

export type OutfitAnalysis = {
  upperBodyTags: string[];
  lowerBodyTags: string[];
  colors: string[];
  tagAnchors?: OutfitTagAnchor[];
};

/** POST /api/analyze-outfit — Gemini 辨識穿搭標籤 */
export async function analyzeOutfit(
  imageBase64: string,
  mimeType: string
): Promise<OutfitAnalysis> {
  return apiPost<OutfitAnalysis>("/api/analyze-outfit", { imageBase64, mimeType });
}
