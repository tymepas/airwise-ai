export const HEALTH_PROFILE_OPTIONS = [
  { id: "child", label: "Child" },
  { id: "adult", label: "Adult" },
  { id: "elderly", label: "Elderly" },
  { id: "pregnant", label: "Pregnant" },
  { id: "asthma", label: "Asthma" },
  { id: "copd", label: "COPD" },
  { id: "heart_disease", label: "Heart Disease" },
  { id: "outdoor_worker", label: "Outdoor Worker" },
  { id: "athlete", label: "Athlete" },
] as const;

export type HealthProfileId = (typeof HEALTH_PROFILE_OPTIONS)[number]["id"];

export interface HealthProfile {
  selections: HealthProfileId[];
}

const PROFILE_IDS = new Set<string>(HEALTH_PROFILE_OPTIONS.map((option) => option.id));

export function normalizeHealthProfile(value: unknown): HealthProfile {
  if (!value || typeof value !== "object" || !Array.isArray((value as { selections?: unknown }).selections)) {
    return { selections: [] };
  }

  const selections = (value as { selections: unknown[] }).selections
    .filter((selection): selection is string => typeof selection === "string" && PROFILE_IDS.has(selection))
    .slice(0, 5) as HealthProfileId[];

  return { selections: [...new Set(selections)] };
}

export function profileLabels(profile: HealthProfile) {
  return profile.selections.map(
    (selection) => HEALTH_PROFILE_OPTIONS.find((option) => option.id === selection)?.label ?? selection
  );
}
