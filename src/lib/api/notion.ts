import type {
  CreateFeedbackPayload,
  CreateOutfitPayload,
  OutfitRecord,
} from "../../types/api";
import { apiGet, apiPost } from "./client";

/** GET /api/notion/outfits */
export async function listOutfits(): Promise<OutfitRecord[]> {
  return apiGet<OutfitRecord[]>("/api/notion/outfits");
}

/** POST /api/notion/outfits */
export async function createOutfit(payload: CreateOutfitPayload): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/api/notion/outfits", payload);
}

/** GET /api/notion/inspiration */
export async function listInspiration(): Promise<OutfitRecord[]> {
  return apiGet<OutfitRecord[]>("/api/notion/inspiration");
}

/** POST /api/notion/feedback */
export async function createFeedback(payload: CreateFeedbackPayload): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/api/notion/feedback", payload);
}
