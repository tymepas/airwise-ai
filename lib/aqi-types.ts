export type AqiCategory =
  | "Good"
  | "Satisfactory"
  | "Moderate"
  | "Poor"
  | "Very Poor"
  | "Severe";

export interface AqiLocation {
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface AqiTimelinePoint {
  time: string;
  aqi: number;
  category: AqiCategory;
  isForecast: boolean;
}

export interface AirHealthScore {
  score: number;
  label: "Excellent" | "Good" | "Moderate" | "Poor" | "Very Poor";
}

export interface LiveAqi {
  city: string;
  aqi: number;
  category: AqiCategory;
  primaryPollutant: "PM2.5" | "PM10";
  pm25: number;
  pm10: number;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  lastUpdated: string;
  aqiStandard: "CPCB-style AQI estimate";
  dataSource: "Open-Meteo / CAMS";
  timeline: AqiTimelinePoint[];
  healthScore: AirHealthScore;
  provenance: LiveAqiProvenance;
}

export interface LiveAqiProvenance {
  provider: "Open-Meteo Air Quality API";
  weatherProvider: "Open-Meteo Weather API";
  airQualityModel: "CAMS";
  retrievedAt: string;
  responseTimestamp: string;
  latitude: number;
  longitude: number;
  updateFrequency: "Up to every 5 minutes";
  status: "Live";
  airQualityEndpoint: string;
  weatherEndpoint: string;
}
