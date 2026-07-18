"use client";

import { DEFAULT_CITY, SUPPORTED_CITIES } from "@/lib/locations";
import type { AqiLocation, LiveAqi } from "@/lib/aqi-types";
import { useCallback, useEffect, useState } from "react";
import { AqiTimeline } from "@/components/aqi-timeline";

interface AqiApiResponse {
  success: boolean;
  data?: LiveAqi;
  error?: string;
}

interface LiveAqiCardProps {
  onLocationChange: (location: AqiLocation) => void;
}

type CategoryStyle = {
  gradient: string;
  badge: string;
  label: string;
};

const CATEGORY_STYLES: Record<LiveAqi["category"], CategoryStyle> = {
  Good: {
    gradient: "from-emerald-500 to-green-600",
    badge: "bg-emerald-100 text-emerald-700",
    label: "Good",
  },
  Satisfactory: {
    gradient: "from-lime-500 to-emerald-600",
    badge: "bg-lime-100 text-lime-700",
    label: "Satisfactory",
  },
  Moderate: {
    gradient: "from-amber-400 to-orange-500",
    badge: "bg-amber-100 text-amber-700",
    label: "Moderate",
  },
  Poor: {
    gradient: "from-orange-500 to-red-500",
    badge: "bg-orange-100 text-orange-700",
    label: "Poor",
  },
  "Very Poor": {
    gradient: "from-red-500 to-rose-600",
    badge: "bg-rose-100 text-rose-700",
    label: "Very Poor",
  },
  Severe: {
    gradient: "from-violet-600 to-fuchsia-700",
    badge: "bg-violet-100 text-violet-700",
    label: "Severe",
  },
};

function formatUpdated(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value.replace("T", " ")
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-700">
        {value === null ? "—" : value}
        {value !== null && <span className="ml-1 text-xs font-semibold text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}

export function LiveAqiCard({ onLocationChange }: LiveAqiCardProps) {
  const [data, setData] = useState<LiveAqi | null>(null);
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingLocation, setIsUsingLocation] = useState(false);

  const loadAqi = useCallback(
    async (location: AqiLocation) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (location.city) params.set("city", location.city);
      if (typeof location.latitude === "number") params.set("latitude", location.latitude.toString());
      if (typeof location.longitude === "number") params.set("longitude", location.longitude.toString());

      try {
        const response = await fetch(`/api/aqi?${params.toString()}`);
        const payload = (await response.json()) as AqiApiResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Live AQI is currently unavailable.");
        }

        setData(payload.data);
        onLocationChange({
          city: payload.data.city,
          latitude: location.latitude,
          longitude: location.longitude,
        });
      } catch (requestError) {
        setData(null);
        setError(requestError instanceof Error ? requestError.message : "Live AQI is currently unavailable.");
      } finally {
        setLoading(false);
      }
    },
    [onLocationChange]
  );

  useEffect(() => {
    // Defer the initial request to an async browser callback so loading state
    // updates are not synchronously scheduled from the effect itself.
    const timer = window.setTimeout(() => void loadAqi({ city: DEFAULT_CITY.name }), 0);
    return () => window.clearTimeout(timer);
  }, [loadAqi]);

  useEffect(() => {
    let isActive = true;

    if (!navigator.geolocation || !navigator.permissions) return undefined;

    void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (permission.state !== "granted" || !isActive) return;
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (isActive) void loadAqi({ latitude: coords.latitude, longitude: coords.longitude });
        },
        () => undefined,
        { enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60 * 1000 }
      );
    });

    return () => {
      isActive = false;
    };
  }, [loadAqi]);

  const selectCity = (city: string) => {
    setSelectedCity(city);
    setIsUsingLocation(false);
    void loadAqi({ city });
  };

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setError("Location detection is not supported by this browser.");
      return;
    }

    setIsUsingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void loadAqi({ latitude: coords.latitude, longitude: coords.longitude }),
      () => {
        setIsUsingLocation(false);
        setError("Location permission was not granted. Choose a city instead.");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const style = data ? CATEGORY_STYLES[data.category] : CATEGORY_STYLES.Moderate;

  return (
    <section className="w-full max-w-3xl mt-12 rounded-3xl bg-white/70 backdrop-blur-xl border border-white shadow-xl shadow-blue-100 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 sm:px-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Live AQI intelligence</p>
          <h2 className="mt-1 text-xl font-bold text-slate-800">Current air conditions</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={useBrowserLocation}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUsingLocation ? "Finding location…" : "Use my location"}
          </button>
          <select
            value={selectedCity}
            onChange={(event) => selectCity(event.target.value)}
            disabled={loading || isUsingLocation}
            aria-label="Select city"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {SUPPORTED_CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex min-h-56 items-center justify-center px-6 py-10 text-sm font-medium text-blue-600 animate-pulse">
          Loading live air quality…
        </div>
      )}

      {!loading && error && (
        <div className="px-6 py-8 sm:px-10" role="status">
          <p className="font-semibold text-slate-700">Live AQI currently unavailable.</p>
          <p className="mt-1 text-sm text-slate-500">You can still ask AirWise AI using the available health guidance.</p>
          <button
            type="button"
            onClick={() => void loadAqi({ city: selectedCity })}
            className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Retry live AQI
          </button>
        </div>
      )}

      {!loading && data && (
        <div className="p-6 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-3xl bg-gradient-to-br ${style.gradient} text-white shadow-lg`}>
                <span className="text-4xl font-extrabold leading-none">{data.aqi}</span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/85">AQI</span>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{data.city}</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${style.badge}`}>{style.label}</span>
                <p className="mt-3 text-sm text-slate-500">
                  Primary pollutant: <span className="font-semibold text-slate-700">{data.primaryPollutant}</span>
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-400 sm:max-w-48 sm:text-right">Updated {formatUpdated(data.lastUpdated)}</p>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="PM2.5" value={data.pm25} unit="µg/m³" />
            <Metric label="PM10" value={data.pm10} unit="µg/m³" />
            <Metric label="Temperature" value={data.temperature} unit="°C" />
            <Metric label="Humidity" value={data.humidity} unit="%" />
            <Metric label="Wind speed" value={data.windSpeed} unit="km/h" />
          </div>

          <AqiTimeline timeline={data.timeline} healthScore={data.healthScore} />

          <p className="mt-5 text-xs leading-relaxed text-slate-400">
            {data.aqiStandard} calculated from current PM concentrations. Data: {data.dataSource}.
          </p>
        </div>
      )}
    </section>
  );
}
