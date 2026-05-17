import { GoogleGenAI } from "@google/genai";
import { env, isGeminiConfigured } from "../env";
import {
  filterAllowedTags,
  LOWER_BODY_TAGS,
  OUTFIT_ANALYSIS_PROMPT,
  UPPER_BODY_TAGS,
} from "./outfit-taxonomy";

export type OutfitAnalysisResult = {
  upperBodyTags: string[];
  lowerBodyTags: string[];
};

const DEFAULT_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
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

function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
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
  let lastError: unknown;

  for (const model of models) {
    try {
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

      let parsed: { upperBodyTags?: string[]; lowerBodyTags?: string[] };
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        throw new Error("Gemini 回傳格式無法解析");
      }

      return {
        upperBodyTags: filterAllowedTags(parsed.upperBodyTags, UPPER_BODY_TAGS),
        lowerBodyTags: filterAllowedTags(parsed.lowerBodyTags, LOWER_BODY_TAGS).slice(
          0,
          1
        ),
      };
    } catch (error) {
      lastError = error;
      if (isQuotaError(error)) {
        continue;
      }
      throw error;
    }
  }

  if (isQuotaError(lastError)) {
    throw new Error(
      "Gemini 免費額度已用完或模型暫不可用，請稍後再試或至 Google AI Studio 檢查配額"
    );
  }

  throw lastError instanceof Error ? lastError : new Error("穿搭分析失敗");
}
