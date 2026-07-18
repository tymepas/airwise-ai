export interface SupportedCity {
  name: string;
  latitude: number;
  longitude: number;
}

export const SUPPORTED_CITIES: SupportedCity[] = [
  { name: "Delhi", latitude: 28.6139, longitude: 77.209 },
  { name: "Mumbai", latitude: 19.076, longitude: 72.8777 },
  { name: "Bangalore", latitude: 12.9716, longitude: 77.5946 },
  { name: "Chennai", latitude: 13.0827, longitude: 80.2707 },
  { name: "Kolkata", latitude: 22.5726, longitude: 88.3639 },
  { name: "Pune", latitude: 18.5204, longitude: 73.8567 },
  { name: "Hyderabad", latitude: 17.385, longitude: 78.4867 },
  { name: "Ahmedabad", latitude: 23.0225, longitude: 72.5714 },
  { name: "Lucknow", latitude: 26.8467, longitude: 80.9462 },
  { name: "Jaipur", latitude: 26.9124, longitude: 75.7873 },
];

export const DEFAULT_CITY = SUPPORTED_CITIES[0];
