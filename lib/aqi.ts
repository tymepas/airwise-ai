import { DEFAULT_CITY, SUPPORTED_CITIES, type SupportedCity } from "@/lib/locations";
import type { AirHealthScore, AqiCategory, AqiLocation, AqiTimelinePoint, LiveAqi } from "@/lib/aqi-types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

type OpenMeteoAirQualityResponse = {
  current?: {
    time?: string;
    pm2_5?: number;
    pm10?: number;
  };
  hourly?: {
    time?: string[];
    pm2_5?: number[];
    pm10?: number[];
  };
};

type OpenMeteoWeatherResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
  };
};

type ReverseGeocodeResponse = {
  address?: Record<string, string | undefined>;
};

type CachedAqi = { value: LiveAqi; expiresAt: number };
const aqiCache = new Map<string, CachedAqi>();

const PM25_BREAKPOINTS = [
  [0, 30, 0, 50],
  [31, 60, 51, 100],
  [61, 90, 101, 200],
  [91, 120, 201, 300],
  [121, 250, 301, 400],
  [251, 500, 401, 500],
] as const;

const PM10_BREAKPOINTS = [
  [0, 50, 0, 50],
  [51, 100, 51, 100],
  [101, 250, 101, 200],
  [251, 350, 201, 300],
  [351, 430, 301, 400],
  [431, 600, 401, 500],
] as const;

function isFiniteCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function findSupportedCity(city: string | undefined) {
  if (!city) return undefined;
  return SUPPORTED_CITIES.find((candidate) => candidate.name.toLowerCase() === city.trim().toLowerCase());
}

function calculateSubIndex(concentration: number, breakpoints: readonly (readonly number[])[]) {
  const band = breakpoints.find(([, upper]) => concentration <= upper) ?? breakpoints[breakpoints.length - 1];
  const [concentrationLow, concentrationHigh, indexLow, indexHigh] = band;
  const boundedConcentration = Math.max(concentrationLow, Math.min(concentration, concentrationHigh));
  return Math.round(
    ((indexHigh - indexLow) / (concentrationHigh - concentrationLow)) *
      (boundedConcentration - concentrationLow) +
      indexLow
  );
}

function categoryForAqi(aqi: number): AqiCategory {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

function healthScoreFor(liveAqi: number, pm25: number, humidity: number | null, temperature: number | null): AirHealthScore {
  const aqiPenalty = liveAqi <= 50 ? 0 : liveAqi <= 100 ? 12 : liveAqi <= 200 ? 32 : liveAqi <= 300 ? 55 : liveAqi <= 400 ? 75 : 90;
  const particulatePenalty = Math.min(8, Math.round(Math.max(0, pm25 - 15) / 20));
  const humidityPenalty = humidity === null ? 0 : humidity < 30 || humidity > 70 ? 4 : 0;
  const temperaturePenalty = temperature === null ? 0 : temperature < 12 || temperature > 36 ? 3 : 0;
  const score = Math.max(0, Math.min(100, 100 - aqiPenalty - particulatePenalty - humidityPenalty - temperaturePenalty));
  const label = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Moderate" : score >= 30 ? "Poor" : "Very Poor";
  return { score, label };
}

function createTimeline(response: OpenMeteoAirQualityResponse, currentTime: string): AqiTimelinePoint[] {
  const times = response.hourly?.time ?? [];
  const pm25Values = response.hourly?.pm2_5 ?? [];
  const pm10Values = response.hourly?.pm10 ?? [];
  const currentIndex = Math.max(0, times.findIndex((time) => time >= currentTime));
  const start = Math.max(0, currentIndex - 5);

  return times.slice(start, start + 30).flatMap((time, offset) => {
    const index = start + offset;
    const pm25 = pm25Values[index];
    const pm10 = pm10Values[index];
    if (
      typeof pm25 !== "number" ||
      !Number.isFinite(pm25) ||
      typeof pm10 !== "number" ||
      !Number.isFinite(pm10)
    ) {
      return [];
    }
    const aqi = Math.max(calculateSubIndex(pm25, PM25_BREAKPOINTS), calculateSubIndex(pm10, PM10_BREAKPOINTS));
    return [{ time, aqi, category: categoryForAqi(aqi), isForecast: time > currentTime }];
  });
}

async function fetchJson<T>(url: string, headers?: HeadersInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`AQI provider returned HTTP ${response.status}.`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function cityForCoordinates(latitude: number, longitude: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", latitude.toString());
  url.searchParams.set("lon", longitude.toString());
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetchJson<ReverseGeocodeResponse>(url.toString(), {
      "User-Agent": "AirWiseAI/1.0 public-health-demo",
      Accept: "application/json",
    });
    const address = response.address;
    return address?.city ?? address?.town ?? address?.village ?? address?.county ?? "Your location";
  } catch {
    return "Your location";
  }
}

async function resolveLocation(location?: AqiLocation): Promise<SupportedCity> {
  if (
    isFiniteCoordinate(location?.latitude, -90, 90) &&
    isFiniteCoordinate(location?.longitude, -180, 180)
  ) {
    const city = location?.city?.trim().slice(0, 80) || (await cityForCoordinates(location.latitude, location.longitude));
    return { name: city, latitude: location.latitude, longitude: location.longitude };
  }

  const city = findSupportedCity(location?.city);
  if (location?.city && !city) throw new Error("Unsupported city.");
  return city ?? DEFAULT_CITY;
}

/**
 * Returns current modelled PM concentrations and weather, then calculates a
 * CPCB-style PM-driven AQI estimate. It is intentionally labelled as an
 * estimate because the provider is not a CPCB monitoring-station feed.
 */
export async function getLiveAqi(location?: AqiLocation): Promise<LiveAqi> {
  const resolved = await resolveLocation(location);
  const cacheKey = `${resolved.latitude.toFixed(3)},${resolved.longitude.toFixed(3)}`;
  const cached = aqiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, city: resolved.name };

  const airQualityUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airQualityUrl.searchParams.set("latitude", resolved.latitude.toString());
  airQualityUrl.searchParams.set("longitude", resolved.longitude.toString());
  airQualityUrl.searchParams.set("current", "pm2_5,pm10");
  airQualityUrl.searchParams.set("hourly", "pm2_5,pm10");
  airQualityUrl.searchParams.set("timezone", "auto");

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", resolved.latitude.toString());
  weatherUrl.searchParams.set("longitude", resolved.longitude.toString());
  weatherUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m");
  weatherUrl.searchParams.set("timezone", "auto");

  const [airQuality, weather] = await Promise.all([
    fetchJson<OpenMeteoAirQualityResponse>(airQualityUrl.toString()),
    fetchJson<OpenMeteoWeatherResponse>(weatherUrl.toString()),
  ]);

  const pm25 = airQuality.current?.pm2_5;
  const pm10 = airQuality.current?.pm10;
  const lastUpdated = airQuality.current?.time;
  if (
    typeof pm25 !== "number" ||
    !Number.isFinite(pm25) ||
    typeof pm10 !== "number" ||
    !Number.isFinite(pm10) ||
    typeof lastUpdated !== "string"
  ) {
    throw new Error("AQI provider returned incomplete current conditions.");
  }

  const pm25Index = calculateSubIndex(pm25, PM25_BREAKPOINTS);
  const pm10Index = calculateSubIndex(pm10, PM10_BREAKPOINTS);
  const aqi = Math.max(pm25Index, pm10Index);
  const temperature = Number.isFinite(weather.current?.temperature_2m) ? weather.current!.temperature_2m! : null;
  const humidity = Number.isFinite(weather.current?.relative_humidity_2m)
    ? weather.current!.relative_humidity_2m!
    : null;
  const value: LiveAqi = {
    city: resolved.name,
    aqi,
    category: categoryForAqi(aqi),
    primaryPollutant: pm25Index >= pm10Index ? "PM2.5" : "PM10",
    pm25: Math.round(pm25 * 10) / 10,
    pm10: Math.round(pm10 * 10) / 10,
    temperature,
    humidity,
    windSpeed: Number.isFinite(weather.current?.wind_speed_10m) ? weather.current!.wind_speed_10m! : null,
    lastUpdated,
    aqiStandard: "CPCB-style AQI estimate",
    dataSource: "Open-Meteo / CAMS",
    timeline: createTimeline(airQuality, lastUpdated),
    healthScore: healthScoreFor(aqi, pm25, humidity, temperature),
  };

  aqiCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
