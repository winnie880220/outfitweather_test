/** 前端與 Vercel API 共用的資料型別 */

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  source?: "api" | "mock" | "notion";
}

export interface WeatherData {
  temp: number;
  /** 當日預報最低溫（Open-Meteo daily） */
  tempMin?: number;
  /** 當日預報最高溫（Open-Meteo daily） */
  tempMax?: number;
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

/**
 * 單一 Notion Database 一筆紀錄（欄位名見 lib/server/notion/schema.ts）
 * 建立時填天氣；提交體感時 PATCH 補上 Breathability / Wrapping / Stuffiness 等
 */
/** 與 Notion「Gender」Select 選項一致 */
export type UserGender = "男生" | "女生" | "不分";

export interface NotionRecordPayload {
  userName?: string;
  gender?: UserGender;
  location?: string;
  /** ISO 8601，對應 Started At */
  startedAt?: string;
  /** 對應 Weather（Select 選項名稱須與 Notion 一致，如「多雲」） */
  weather?: string;
  temperature?: number;
  maxTemp?: number;
  minTemp?: number;
  apparentTemp?: string | number;
  humidity?: number;
  rainProb?: number;
  uvIndex?: number;
  upperBodyTags?: string[];
  lowerBodyTags?: string[];
  breathability?: number;
  wrapping?: number;
  stuffiness?: number;
  photoUrl?: string;
  /** 上傳至 Notion Photo（伺服器端處理，勿含 data: 前綴亦可） */
  photoBase64?: string;
  photoMimeType?: string;
  /** Notion「Favorite」：被收藏穿搭的 ID 欄位值列表 */
  favoriteIds?: string[];
  /** @deprecated 改用 favoriteIds */
  favoriteTargets?: string[];
}

export type ParsedOutfitImage = {
  base64: string;
  mimeType: string;
  previewUrl: string;
};

/** @deprecated 請改用 NotionRecordPayload */
export type CreateOutfitPayload = NotionRecordPayload & { userName: string };

/** @deprecated 請改用 NotionRecordPayload */
export interface CreateFeedbackPayload {
  userName: string;
  description: string;
  breathability: number;
  snugness: number;
  stuffiness: number;
  weatherSnapshot?: Partial<WeatherData>;
}
