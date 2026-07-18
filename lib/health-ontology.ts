import type { HealthProfile } from "@/lib/health-profile";

export type HealthConceptId =
  | "air_quality"
  | "outdoor_activity"
  | "children"
  | "sensitive_groups"
  | "respiratory_conditions"
  | "heart_conditions"
  | "pregnancy"
  | "respiratory_protection"
  | "particulate_matter"
  | "outdoor_work";

type HealthConcept = {
  aliases: readonly string[];
  categoryHints: readonly string[];
  expansionTerms: readonly string[];
};

export interface SearchIntent {
  concepts: HealthConceptId[];
  categoryHints: string[];
  expandedTerms: string[];
}

const HEALTH_ONTOLOGY: Record<HealthConceptId, HealthConcept> = {
  air_quality: {
    aliases: ["aqi", "air quality", "pollution", "smog", "air pollution", "fresh air"],
    categoryHints: ["AQI", "Health"],
    expansionTerms: ["air quality health guidance", "pollution exposure health risk"],
  },
  outdoor_activity: {
    aliases: [
      "outdoor exercise",
      "play outside",
      "outside",
      "outdoor",
      "walk",
      "walking",
      "jog",
      "jogging",
      "run",
      "running",
      "cycle",
      "cycling",
      "football",
      "exercise",
      "workout",
      "sport",
      "athlete",
      "train",
      "training",
    ],
    categoryHints: ["Health"],
    expansionTerms: ["outdoor activity air quality", "outdoor exercise pollution exposure", "reduce outdoor exposure"],
  },
  children: {
    aliases: ["child", "children", "kid", "kids", "toddler", "baby", "minor", "6-year-old"],
    categoryHints: ["Health"],
    expansionTerms: ["children air pollution", "children reduce outdoor exposure"],
  },
  sensitive_groups: {
    aliases: ["elderly", "older adult", "senior", "sensitive group", "vulnerable"],
    categoryHints: ["Health"],
    expansionTerms: ["sensitive groups air pollution", "older adults outdoor activity"],
  },
  respiratory_conditions: {
    aliases: ["asthma", "copd", "lung disease", "breathing", "respiratory", "wheezing"],
    categoryHints: ["Health"],
    expansionTerms: ["asthma COPD air pollution", "respiratory health outdoor exposure"],
  },
  heart_conditions: {
    aliases: ["heart disease", "cardiac", "heart condition"],
    categoryHints: ["Health"],
    expansionTerms: ["heart disease air pollution", "sensitive groups outdoor activity"],
  },
  pregnancy: {
    aliases: ["pregnant", "pregnancy", "expecting"],
    categoryHints: ["Health"],
    expansionTerms: ["pregnancy air pollution", "sensitive groups outdoor exposure"],
  },
  respiratory_protection: {
    aliases: ["mask", "n95", "respirator", "face cover", "face mask"],
    categoryHints: ["Health"],
    expansionTerms: ["N95 PM2.5 protection", "respiratory protection air pollution"],
  },
  particulate_matter: {
    aliases: ["pm2.5", "pm10", "particulate", "particles"],
    categoryHints: ["AQI", "Health"],
    expansionTerms: ["PM2.5 health effects", "particulate pollution guidance"],
  },
  outdoor_work: {
    aliases: ["outdoor worker", "construction worker", "delivery worker", "work outside"],
    categoryHints: ["Health"],
    expansionTerms: ["outdoor worker pollution exposure", "reduce outdoor exposure"],
  },
};

const PROFILE_CONCEPTS: Record<HealthProfile["selections"][number], HealthConceptId[]> = {
  child: ["children", "sensitive_groups"],
  adult: [],
  elderly: ["sensitive_groups"],
  pregnant: ["pregnancy", "sensitive_groups"],
  asthma: ["respiratory_conditions", "sensitive_groups"],
  copd: ["respiratory_conditions", "sensitive_groups"],
  heart_disease: ["heart_conditions", "sensitive_groups"],
  outdoor_worker: ["outdoor_work", "outdoor_activity"],
  athlete: ["outdoor_activity"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAlias(text: string, alias: string) {
  return text.includes(alias);
}

function uniqueValues(values: string[], maximum: number) {
  return [...new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, maximum);
}

/**
 * A small, explicit vocabulary makes conversational health questions
 * searchable without requiring a vector index or changes to source documents.
 */
export function detectSearchIntent(
  question: string,
  conversationContext = "",
  profile: HealthProfile = { selections: [] }
): SearchIntent {
  const text = normalize(`${question} ${conversationContext}`);
  const concepts = new Set<HealthConceptId>();

  for (const [concept, definition] of Object.entries(HEALTH_ONTOLOGY) as [HealthConceptId, HealthConcept][]) {
    if (definition.aliases.some((alias) => includesAlias(text, alias))) concepts.add(concept);
  }

  for (const selection of profile.selections) {
    for (const concept of PROFILE_CONCEPTS[selection]) concepts.add(concept);
  }

  if (concepts.size === 0) concepts.add("air_quality");

  const selected = [...concepts];
  return {
    concepts: selected,
    categoryHints: uniqueValues(selected.flatMap((concept) => [...HEALTH_ONTOLOGY[concept].categoryHints]), 3),
    expandedTerms: uniqueValues(selected.flatMap((concept) => [...HEALTH_ONTOLOGY[concept].expansionTerms]), 10),
  };
}

export function conceptTerms(concepts: HealthConceptId[]) {
  return uniqueValues(concepts.flatMap((concept) => [...HEALTH_ONTOLOGY[concept].aliases]), 30);
}
