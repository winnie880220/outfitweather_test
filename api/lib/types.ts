export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  source?: "api" | "mock" | "notion";
}

export interface WeatherData {
  temp: number;
  /** 當日預報最低溫 */
  tempMin?: number;
  /** 當日預報最高溫 */
  tempMax?: number;
  condition: string;
  conditionCode: number;
  humidity: number;
  rainProb: number;
  apparentTemp: number;
  uvIndex: number;
  locationName: string;
}

export interface GeoSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

/** 與 Notion「Gender」Select 選項一致 */
export type UserGender = "男生" | "女生" | "不分";

export interface NotionRecordPayload {
  userName?: string;
  gender?: UserGender;
  location?: string;
  startedAt?: string;
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
  /** 前端傳入，伺服器上傳至 Notion Photo 後不寫入 properties */
  photoBase64?: string;
  photoMimeType?: string;
  /** 伺服器內部：Notion file_upload id */
  photoFileUploadId?: string;
  /** Notion「Favorite」multi-select：被收藏穿搭的 ID 欄位值列表 */
  favoriteIds?: string[];
  /** @deprecated 改用 favoriteIds */
  favoriteTargets?: string[];
}
