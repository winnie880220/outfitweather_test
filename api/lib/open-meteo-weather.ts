import type { WeatherData } from "./types";
import { reverseGeocode } from "./geocode";
import { httpFetch } from "./http-fetch";

const getWeatherCondition = (code: number): string => {
  const mapping: Record<number, string> = {
    0: "晴朗",
    1: "晴間多雲",
    2: "多雲",
    3: "陰天",
    45: "霧",
    48: "霧",
    51: "毛毛雨",
    53: "毛毛雨",
    55: "毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    80: "陣雨",
    81: "強陣雨",
    82: "暴力雨",
    95: "雷雨",
  };
  return mapping[code] || "未知氣候";
};

type OpenMeteoForecastResponse = {
  current_weather: {
    temperature: number;
    weathercode: number;
  };
  hourly: {
    relativehumidity_2m: number[];
    precipitation_probability: number[];
    apparent_temperature: number[];
    uv_index: number[];
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === "number");
}

function parseOpenMeteoResponse(data: unknown): OpenMeteoForecastResponse {
  if (!data || typeof data !== "object") {
    throw new Error("天氣資料格式錯誤");
  }

  const raw = data as Record<string, unknown>;
  const current = raw.current_weather;
  const hourly = raw.hourly;

  if (!current || typeof current !== "object") {
    throw new Error("天氣資料缺少 current_weather");
  }
  const cw = current as Record<string, unknown>;
  if (typeof cw.temperature !== "number" || typeof cw.weathercode !== "number") {
    throw new Error("天氣資料 current_weather 格式錯誤");
  }

  if (!hourly || typeof hourly !== "object") {
    throw new Error("天氣資料缺少 hourly");
  }
  const h = hourly as Record<string, unknown>;
  if (
    !isNumberArray(h.relativehumidity_2m) ||
    !isNumberArray(h.precipitation_probability) ||
    !isNumberArray(h.apparent_temperature) ||
    !isNumberArray(h.uv_index)
  ) {
    throw new Error("天氣資料 hourly 格式錯誤");
  }

  let daily: OpenMeteoForecastResponse["daily"];
  if (raw.daily && typeof raw.daily === "object") {
    const d = raw.daily as Record<string, unknown>;
    daily = {
      ...(isNumberArray(d.temperature_2m_max) ? { temperature_2m_max: d.temperature_2m_max } : {}),
      ...(isNumberArray(d.temperature_2m_min) ? { temperature_2m_min: d.temperature_2m_min } : {}),
    };
  }

  return {
    current_weather: {
      temperature: cw.temperature,
      weathercode: cw.weathercode,
    },
    hourly: {
      relativehumidity_2m: h.relativehumidity_2m,
      precipitation_probability: h.precipitation_probability,
      apparent_temperature: h.apparent_temperature,
      uv_index: h.uv_index,
    },
    daily,
  };
}

function hourlyValue(series: number[], hourIdx: number): number {
  const val = series[hourIdx] ?? series[0];
  return typeof val === "number" && !Number.isNaN(val) ? val : 0;
}

export async function getCurrentWeatherFromOpenMeteo(
  lat: number,
  lon: number,
  displayName?: string
): Promise<WeatherData> {
  const weatherRes = await httpFetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,apparent_temperature,uv_index&daily=temperature_2m_max,temperature_2m_min`
  );

  if (!weatherRes.ok) {
    throw new Error("天氣服務暫時無法使用");
  }

  const weatherData = parseOpenMeteoResponse(await weatherRes.json());
  const current = weatherData.current_weather;
  const hourIdx = new Date().getHours();

  let locationName = displayName?.trim() || "";
  if (!locationName) {
    locationName = await reverseGeocode(lat, lon);
  }

  const dailyMax = weatherData.daily?.temperature_2m_max?.[0];
  const dailyMin = weatherData.daily?.temperature_2m_min?.[0];

  return {
    temp: current.temperature,
    ...(typeof dailyMin === "number" && !Number.isNaN(dailyMin) ? { tempMin: dailyMin } : {}),
    ...(typeof dailyMax === "number" && !Number.isNaN(dailyMax) ? { tempMax: dailyMax } : {}),
    condition: getWeatherCondition(current.weathercode),
    conditionCode: current.weathercode,
    humidity: hourlyValue(weatherData.hourly.relativehumidity_2m, hourIdx),
    rainProb: hourlyValue(weatherData.hourly.precipitation_probability, hourIdx),
    apparentTemp: hourlyValue(weatherData.hourly.apparent_temperature, hourIdx),
    uvIndex: hourlyValue(weatherData.hourly.uv_index, hourIdx),
    locationName,
  };
}
