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

export interface GeoSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

export interface NotionRecordPayload {
  userName?: string;
  location?: string;
  startedAt?: string;
  weather?: string;
  temperature?: number;
  maxTemp?: string;
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
}
