import { GoogleGenAI } from "@google/genai";
import { env, isGeminiConfigured } from "../env";

export type FeelSummaryInput = {
  breathability: number;
  wrapping: number;
  stuffiness: number;
  upperBodyTags?: string[];
  lowerBodyTags?: string[];
  temp?: number;
  condition?: string;
  locationName?: string;
  userNote?: string;
};

export type FeelSummaryResult = {
  score: number;
  conclusion: string;
};

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

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function buildPrompt(input: FeelSummaryInput): string {
  const tags = [...(input.upperBodyTags ?? []), ...(input.lowerBodyTags ?? [])];
  const weather =
    input.temp != null
      ? `${Math.round(input.temp)}°C${input.condition ? ` ${input.condition}` : ""}`
      : input.condition ?? "未知";

  return `你是「衣氣象」穿搭體感顧問。依使用者回饋給出 0–100 的體感評分（越高代表越舒適、越適合當日環境），以及一句繁體中文小結（18 字以內、語氣溫暖口語）。

資料：
- 透氣度：${input.breathability}/100
- 包裹感：${input.wrapping}/100
- 悶熱感：${input.stuffiness}/100
- 穿搭：${tags.length ? tags.join("、") : "未標記"}
- 天氣：${weather}${input.locationName ? ` · ${input.locationName}` : ""}
${input.userNote?.trim() ? `- 使用者備註：${input.userNote.trim()}` : ""}

只回傳 JSON：{"score": number, "conclusion": string}`;
}

function parseResult(text: string): FeelSummaryResult | null {
  try {
    const parsed = JSON.parse(text) as { score?: unknown; conclusion?: unknown };
    const score = clampScore(Number(parsed.score));
    const conclusion =
      typeof parsed.conclusion === "string" ? parsed.conclusion.trim() : "";
    if (!conclusion) return null;
    return { score, conclusion };
  } catch {
    return null;
  }
}

export function fallbackFeelSummary(input: FeelSummaryInput): FeelSummaryResult {
  const comfort =
    input.breathability * 0.38 +
    (100 - input.stuffiness) * 0.38 +
    (100 - Math.abs(input.wrapping - 52)) * 0.24;
  const score = clampScore(comfort);

  const breath =
    input.breathability >= 65 ? "透氣" : input.breathability >= 40 ? "尚可" : "偏悶";
  const stuff = input.stuffiness >= 65 ? "偏熱" : input.stuffiness >= 40 ? "微悶" : "清爽";
  const wrap =
    input.wrapping >= 65 ? "偏緊" : input.wrapping >= 40 ? "合身" : "寬鬆";

  return {
    score,
    conclusion: `整體${breath}、${wrap}，穿著感${stuff}。`,
  };
}

export async function summarizeFeelFeedback(
  input: FeelSummaryInput
): Promise<FeelSummaryResult> {
  if (!isGeminiConfigured()) {
    return fallbackFeelSummary(input);
  }

  const prompt = buildPrompt(input);
  const keys = env.geminiApiKeys;
  let lastError: unknown;

  for (const key of keys) {
    const ai = new GoogleGenAI({ apiKey: key });
    for (const model of getModelCandidates()) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ text: prompt }],
          config: { responseMimeType: "application/json" },
        });

        const text = response.text?.trim();
        if (!text) continue;

        const parsed = parseResult(text);
        if (parsed) return parsed;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    console.warn("summarizeFeelFeedback:", lastError);
  }
  return fallbackFeelSummary(input);
}
