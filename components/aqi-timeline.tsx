"use client";

import type { AirHealthScore, AqiTimelinePoint } from "@/lib/aqi-types";
import { useMemo, useState } from "react";

interface AqiTimelineProps {
  timeline: AqiTimelinePoint[];
  healthScore: AirHealthScore;
}

function hourLabel(time: string) {
  const match = time.match(/T(\d{2}):/);
  return match ? `${match[1]}:00` : time;
}

export function AqiTimeline({ timeline, healthScore }: AqiTimelineProps) {
  const [range, setRange] = useState<"6h" | "24h">("6h");
  const points = useMemo(() => {
    if (range === "6h") return timeline.slice(0, 12);
    return timeline.filter((point) => point.isForecast).slice(0, 24);
  }, [range, timeline]);
  const maximum = Math.max(1, ...points.map((point) => point.aqi));
  const lastPoint = points[points.length - 1];

  return (
    <div className="mt-7 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Air health score</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">
            {healthScore.score}<span className="text-sm text-slate-400">/100</span>
            <span className="ml-2 text-sm font-semibold text-slate-500">{healthScore.label}</span>
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm" role="group" aria-label="AQI timeline range">
          {(["6h", "24h"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                range === option ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {option === "6h" ? "6-hour trend" : "24-hour forecast"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex h-28 items-end gap-1" aria-label={`${range} AQI timeline`}>
        {points.map((point) => (
          <div key={point.time} className="group flex min-w-0 flex-1 flex-col items-center justify-end">
            <div className="relative w-full max-w-5">
              <div
                className={`w-full rounded-t-sm ${point.isForecast ? "bg-blue-300" : "bg-blue-600"}`}
                style={{ height: `${Math.max(8, Math.round((point.aqi / maximum) * 88))}px` }}
                title={`${hourLabel(point.time)}: AQI ${point.aqi}${point.isForecast ? " forecast" : ""}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
        <span>{points[0] ? hourLabel(points[0].time) : "—"}</span>
        <span>{range === "24h" ? "Forecast" : "Current trend"}</span>
        <span>{lastPoint ? hourLabel(lastPoint.time) : "—"}</span>
      </div>
    </div>
  );
}
