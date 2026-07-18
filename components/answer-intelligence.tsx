"use client";

import type { EvidenceItem, Explainability } from "@/lib/chat-types";
import type { HealthProfile } from "@/lib/health-profile";
import { profileLabels } from "@/lib/health-profile";

interface LiveDataSummary {
  city: string;
  aqi: number;
  category: string;
  timestamp: string;
  weather: { temperature: number | null; humidity: number | null; windSpeed: number | null };
}

interface AnswerIntelligenceProps {
  explainability?: Explainability;
  evidence?: EvidenceItem[];
  liveData?: LiveDataSummary | null;
  profile: HealthProfile;
}

export function AnswerIntelligence({ explainability, evidence = [], liveData, profile }: AnswerIntelligenceProps) {
  const labels = profileLabels(profile);
  if (!explainability && evidence.length === 0 && !liveData) return null;

  return (
    <>
      {explainability && (
        <section className="rounded-3xl border border-white bg-white/70 p-8 shadow-lg backdrop-blur-xl sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Why this recommendation?</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-rose-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-500">Risk level</p>
              <p className="mt-1 text-lg font-bold text-rose-800">{explainability.riskLevel}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-500">Confidence</p>
              <p className="mt-1 text-lg font-bold text-blue-800">{explainability.confidenceLevel}</p>
            </div>
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-400">Factors considered</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {explainability.factorsConsidered.map((factor) => (
              <span key={factor} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600">
                {factor}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-white bg-white/70 p-8 shadow-lg backdrop-blur-xl sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">AI decision timeline</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TimelineStep title="Current conditions" value={liveData ? `${liveData.city}: AQI ${liveData.aqi} (${liveData.category})` : "Live data unavailable"} />
          <TimelineStep title="Health profile" value={labels.length > 0 ? labels.join(", ") : "No profile selected"} />
          <TimelineStep title="Retrieved evidence" value={`${evidence.length} guideline${evidence.length === 1 ? "" : "s"} used`} />
          <TimelineStep title="Recommendation" value="Grounded AI response" />
        </div>
      </section>

      {(liveData || evidence.length > 0) && (
        <section className="rounded-3xl border border-white bg-white/70 p-8 shadow-lg backdrop-blur-xl sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Evidence and data sources</p>
          {liveData && (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
              <p className="text-sm font-bold text-blue-800">Live data · Open-Meteo / CAMS</p>
              <p className="mt-2 text-sm leading-relaxed text-blue-700">
                {liveData.city}: AQI {liveData.aqi} ({liveData.category}); weather {liveData.weather.temperature ?? "—"}°C, humidity {liveData.weather.humidity ?? "—"}%. Updated {liveData.timestamp}.
              </p>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-3">
            {evidence.map((item) => (
              <details key={`${item.source}-${item.title}`} className="group rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer list-none pr-6 font-semibold text-slate-700 marker:hidden">
                  <span className="text-blue-700">{item.source}</span> · {item.title}
                  <span className="float-right text-slate-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{item.excerpt}</p>
                <p className="mt-3 text-xs font-semibold text-slate-400">Why used: {item.relevance}</p>
                {item.matchedConcepts.length > 0 && (
                  <p className="mt-2 text-xs text-slate-400">
                    Matched concepts: {item.matchedConcepts.join(", ")}
                  </p>
                )}
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function TimelineStep({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">{value}</p>
    </div>
  );
}
