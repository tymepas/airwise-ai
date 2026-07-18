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
}
