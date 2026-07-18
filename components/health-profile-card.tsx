"use client";

import { HEALTH_PROFILE_OPTIONS, type HealthProfile, type HealthProfileId } from "@/lib/health-profile";

interface HealthProfileCardProps {
  profile: HealthProfile;
  onChange: (profile: HealthProfile) => void;
}

export function HealthProfileCard({ profile, onChange }: HealthProfileCardProps) {
  const toggle = (id: HealthProfileId) => {
    const selections = profile.selections.includes(id)
      ? profile.selections.filter((selection) => selection !== id)
      : [...profile.selections, id].slice(0, 5);
    onChange({ selections });
  };

  return (
    <section className="w-full max-w-3xl mt-8 rounded-3xl border border-white bg-white/60 p-6 shadow-lg shadow-blue-100 backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Personalized guidance</p>
          <h2 className="mt-1 text-lg font-bold text-slate-800">Health profile</h2>
        </div>
        <p className="text-xs text-slate-400">Select up to five factors</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        Stored in this browser and used to personalize your requests. This is not a diagnosis.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {HEALTH_PROFILE_OPTIONS.map((option) => {
          const selected = profile.selections.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                selected
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
