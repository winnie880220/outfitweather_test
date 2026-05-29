export { ApiError } from "./client";
export { analyzeOutfit, type OutfitAnalysis, type OutfitTagAnchor } from "./outfit";
export { fetchOutfitInsights } from "./outfit-insights";
export { fetchMapColors } from "./map-colors";
export type { MapColorPoint, MapColorsData } from "./map-colors";
export { fetchMapDataRegions } from "./map-data-regions";
export type { MapDataRegion, MapDataRegionsData } from "./map-data-regions";
export {
  fetchRegionColorFills,
  fetchRegionColorFillsByLocale,
} from "./region-color-fills";
export type { RegionColorFill, RegionColorFillsData } from "./region-color-fills";
export type { OutfitInsights, OutfitTagStat, InspirationItem } from "./outfit-insights";
export { fetchCurrentWeather } from "./weather";
export { formatGeoLabel, reverseGeocode, searchLocations } from "./geocode";
export { toggleOutfitFavorite, fetchUserFavorites } from "./favorites";
export { ensureActiveUserRecordApi } from "./user-record";
export type { EnsureActiveUserRecordResult } from "./user-record";
export {
  buildRecordFromWeather,
  createRecord,
  updateRecord,
  fetchRecordSnapshot,
  createFeedback,
  createOutfit,
  listInspiration,
  listOutfits,
} from "./notion";
export { fetchFeedbackFeelSummary } from "./feedback-feel-summary";
export type { FeelSummaryRequest, FeelSummaryResult } from "./feedback-feel-summary";
