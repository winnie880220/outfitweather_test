import { GoogleGenAI } from "@google/genai";
import { env, isGeminiConfigured } from "../env";
import {
  filterAllowedTags,
  LOWER_BODY_TAGS,
  normalizeOutfitColors,
  OUTFIT_ANALYSIS_PROMPT,
  UPPER_BODY_TAGS,
} from "./outfit-taxonomy";

export type OutfitTagAnchor = {
  label: string;
  anchorX: number;
  anchorY: number;
};

export type OutfitAnalysisResult = {
  upperBodyTags: string[];
  lowerBodyTags: string[];
  colors: string[];
  tagAnchors?: OutfitTagAnchor[];
};

/** 支援 generateContent + 圖片的模型（v1beta 可用） */
const DEFAULT_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-flash",
];

function getModelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const list = preferred ? [preferred, ...DEFAULT_MODELS] : DEFAULT_MODELS;
  return [...new Set(list)];
}

function stripBase64(input: string): string {
  const match = input.match(/^data:[^;]+;base64,(.+)$/);
  return (match ? match[1] : input).replace(/\s/g, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 配額用盡 → 換下一個模型 */
function isQuotaError(error: unknown): boolean {
  const msg = errorMessage(error);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
}

/** 模型不存在或不支援 → 換下一個模型 */
function isModelUnavailableError(error: unknown): boolean {
  const msg = errorMessage(error);
  return (
    msg.includes("404") ||
    msg.includes("NOT_FOUND") ||
    msg.includes("is not found") ||
    msg.includes("not supported for generateContent")
  );
}

function shouldTryNextModel(error: unknown): boolean {
  return isQuotaError(error) || isModelUnavailableError(error);
}

function clampPct(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return null;
  return Math.round(Math.min(92, Math.max(8, n)));
}

function parseTagAnchors(
  raw: unknown,
  allowedLabels: Set<string>
): OutfitTagAnchor[] {
  if (!Array.isArray(raw)) return [];
  const anchors: OutfitTagAnchor[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label || !allowedLabels.has(label)) continue;
    const anchorX = clampPct(row.anchorX);
    const anchorY = clampPct(row.anchorY);
    if (anchorX === null || anchorY === null) continue;
    anchors.push({ label, anchorX, anchorY });
  }
  return anchors;
}

async function generateWithModel(
  ai: GoogleGenAI,
  model: string,
  base64: string,
  mimeType: string
): Promise<OutfitAnalysisResult> {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64,
        },
      },
      { text: OUTFIT_ANALYSIS_PROMPT },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Gemini 未回傳內容");
  }

  let parsed: {
    upperBodyTags?: string[];
    lowerBodyTags?: string[];
    colors?: unknown;
    tagAnchors?: unknown;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error("Gemini 回傳格式無法解析");
  }

  const upperBodyTags = filterAllowedTags(parsed.upperBodyTags, UPPER_BODY_TAGS);
  const lowerBodyTags = filterAllowedTags(parsed.lowerBodyTags, LOWER_BODY_TAGS).slice(
    0,
    1
  );
  const allowedLabels = new Set([...upperBodyTags, ...lowerBodyTags]);
  const tagAnchors = parseTagAnchors(parsed.tagAnchors, allowedLabels);
  const colors = normalizeOutfitColors(parsed.colors);

  return {
    upperBodyTags,
    lowerBodyTags,
    colors,
    ...(tagAnchors.length > 0 ? { tagAnchors } : {}),
  };
}

export async function analyzeOutfitImage(
  imageBase64: string,
  mimeType: string
): Promise<OutfitAnalysisResult> {
  if (!isGeminiConfigured()) {
    throw new Error("GEMINI_API_KEY 尚未設定");
  }

  const base64 = stripBase64(imageBase64);
  if (!base64) {
    throw new Error("缺少圖片資料");
  }

  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
  const models = getModelCandidates();
  const failures: string[] = [];
  let lastError: unknown;

  for (const model of models) {
    try {
      return await generateWithModel(ai, model, base64, mimeType);
    } catch (error) {
      lastError = error;
      failures.push(`${model}: ${errorMessage(error).slice(0, 120)}`);
      if (shouldTryNextModel(error)) {
        continue;
      }
      throw error;
    }
  }

  if (isQuotaError(lastError)) {
    throw new Error(
      "Gemini 免費額度已用完，請稍後再試或至 Google AI Studio 檢查配額與帳單"
    );
  }

  throw new Error(
    `所有 Gemini 模型皆無法使用。已嘗試：${models.join("、")}。${failures[failures.length - 1] ?? ""}`
  );
}
