import { apiPost } from "./client";

export type FeelSummaryRequest = {
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

export async function fetchFeedbackFeelSummary(
  body: FeelSummaryRequest
): Promise<FeelSummaryResult> {
  return apiPost<FeelSummaryResult>("/api/feedback-feel-summary", body);
}
