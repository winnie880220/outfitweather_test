import type { WeatherData } from "./types";
import { reverseGeocode } from "./geocode";
import { env } from "./env";

type GoogleTemperature = { degrees?: number; unit?: string };

type GoogleWeatherCondition = {
  type?: string;
  description?: { text?: string; languageCode?: string };
};

type GoogleCurrentConditionsResponse = {
  temperature?: GoogleTemperature;
  feelsLikeTemperature?: GoogleTemperature;
  relativeHumidity?: number;
  uvIndex?: number;
  precipitation?: {
    probability?: { percent?: number };
  };
  weatherCondition?: GoogleWeatherCondition;
  currentConditionsHistory?: {
    maxTemperature?: GoogleTemperature;
    minTemperature?: GoogleTemperature;
  };
};

type GoogleDailyForecastResponse = {
  forecastDays?: Array<{
    maxTemperature?: GoogleTemperature;
    minTemperature?: GoogleTemperature;
  }>;
};

/** Google WeatherCondition.type → 穩定數字碼（供 WeatherData.conditionCode） */
const GOOGLE_CONDITION_CODE: Record<string, number> = {
  TYPE_UNSPECIFIED: 0,
  CLEAR: 0,
  MOSTLY_CLEAR: 1,
  PARTLY_CLOUDY: 2,
  MOSTLY_CLOUDY: 3,
  CLOUDY: 3,
  WINDY: 4,
  LIGHT_RAIN: 61,
  RAIN: 63,
  HEAVY_RAIN: 65,
  LIGHT_RAIN_SHOWERS: 80,
  RAIN_SHOWERS: 80,
  SCATTERED_SHOWERS: 80,
  HEAVY_RAIN_SHOWERS: 81,
  THUNDERSTORM: 95,
  THUNDERSHOWER: 95,
  LIGHT_SNOW: 71,
  SNOW: 73,
  HEAVY_SNOW: 75,
  FOG: 45,
};

function celsius(temp?: GoogleTemperature): number | undefined {
  const deg = temp?.degrees;
  if (typeof deg !== "number" || Number.isNaN(deg)) return undefined;
  if (temp?.unit === "FAHRENHEIT") return (deg - 32) * (5 / 9);
  return deg;
}

function googleConditionCode(type?: string): number {
  if (!type) return 0;
  return GOOGLE_CONDITION_CODE[type] ?? 99;
}

function buildGoogleWeatherUrl(
  endpoint: "currentConditions:lookup" | "forecast/days:lookup",
  lat: number,
  lon: number,
  extra?: Record<string, string>
): string {
  const key = env.googleWeatherApiKey;
  const params = new URLSearchParams({
    key,
    "location.latitude": String(lat),
    "location.longitude": String(lon),
    languageCode: "zh-TW",
    unitsSystem: "METRIC",
    ...extra,
  });
  return `https://weather.googleapis.com/v1/${endpoint}?${params}`;
}

async function fetchGoogleJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ? `: ${body.error.message}` : "";
    } catch {
      /* ignore */
    }
    throw new Error(`Google 天氣服務暫時無法使用${detail}`);
  }
  return (await res.json()) as T;
}

export async function getCurrentWeatherFromGoogle(
  lat: number,
  lon: number,
  displayName?: string
): Promise<WeatherData> {
  const current = await fetchGoogleJson<GoogleCurrentConditionsResponse>(
    buildGoogleWeatherUrl("currentConditions:lookup", lat, lon)
  );

  let daily: GoogleDailyForecastResponse = {};
  try {
    daily = await fetchGoogleJson<GoogleDailyForecastResponse>(
      buildGoogleWeatherUrl("forecast/days:lookup", lat, lon, { days: "1" })
    );
  } catch {
    /* 日預報非必須；僅影響今日高低溫 */
  }

  const temp = celsius(current.temperature);
  if (typeof temp !== "number") {
    throw new Error("Google 天氣資料缺少溫度");
  }

  let locationName = displayName?.trim() || "";
  if (!locationName) {
    locationName = await reverseGeocode(lat, lon);
  }

  const conditionType = current.weatherCondition?.type;
  const condition =
    current.weatherCondition?.description?.text?.trim() ||
    (conditionType ? conditionType.replace(/_/g, " ") : "未知氣候");

  const history = current.currentConditionsHistory;
  const today = daily.forecastDays?.[0];
  const dailyMax = celsius(today?.maxTemperature) ?? celsius(history?.maxTemperature);
  const dailyMin = celsius(today?.minTemperature) ?? celsius(history?.minTemperature);

  const rainProb = current.precipitation?.probability?.percent;
  const humidity = current.relativeHumidity;
  const apparent = celsius(current.feelsLikeTemperature);
  const uv = current.uvIndex;

  return {
    temp,
    ...(typeof dailyMin === "number" ? { tempMin: dailyMin } : {}),
    ...(typeof dailyMax === "number" ? { tempMax: dailyMax } : {}),
    condition,
    conditionCode: googleConditionCode(conditionType),
    humidity: typeof humidity === "number" && !Number.isNaN(humidity) ? humidity : 0,
    rainProb: typeof rainProb === "number" && !Number.isNaN(rainProb) ? rainProb : 0,
    apparentTemp: typeof apparent === "number" ? apparent : temp,
    uvIndex: typeof uv === "number" && !Number.isNaN(uv) ? uv : 0,
    locationName,
  };
}
