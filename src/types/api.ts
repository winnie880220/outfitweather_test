/** 前端與 Vercel API 共用的資料型別 */

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  source?: "api" | "mock" | "notion";
}

export interface WeatherData {
  temp: number;
  condition: string;
  conditionCode: number;
  humidity: number;
  rainProb: number;
  apparentTemp: number;
  uvIndex: number;
  locationName: string;
}

export interface UserLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface GeoSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

export interface OutfitRecord {
  id: string;
  emoji: string;
  bg: string;
  match: string;
  temp: string;
  who: string;
  date: string;
  feel: string;
  feelColor: string;
  tags: string[];
  humidity: string;
  location: string;
}

export interface CreateOutfitPayload {
  userName: string;
  location: string;
  temp: number;
  humidity: number;
  rainProb: number;
  feel: string;
  feelColor: string;
  tags?: string[];
  recordedAt?: string;
}

export interface CreateFeedbackPayload {
  userName: string;
  description: string;
  breathability: number;
  snugness: number;
  stuffiness: number;
  weatherSnapshot?: Partial<WeatherData>;
}
