import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { asStringArray, asTrimmedString, parseJsonObject } from "@/lib/json";
import { getElasticClient, HEALTH_GUIDELINES_INDEX } from "@/lib/elastic";
import type { LiveAqi } from "@/lib/aqi-types";
import type { ChatRequestContext, EvidenceItem, Explainability } from "@/lib/chat-types";
import { profileLabels, type HealthProfile } from "@/lib/health-profile";
import { conceptTerms, detectSearchIntent, type SearchIntent } from "@/lib/health-ontology";
import type { estypes } from "@elastic/elasticsearch";

const MAX_MESSAGE_LENGTH = 1_000;
const SEARCH_FIELDS = ["title^6", "content^3", "category^2", "source^2"];
const QUERY_PLAN_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_QUERY_PLAN_CACHE_ENTRIES = 100;
const queryPlanCache = new Map<string, { value: QueryPlan; expiresAt: number }>();

export interface GuidelineDocument {
  title: string;
  source: string;
  category: string;
  content: string;
}

type RetrievalStage = "lexical" | "expanded" | "intent" | "fallback";

export interface RetrievedGuideline extends GuidelineDocument {
  retrieval: {
    matchedBecause: string[];
    matchedConcepts: string[];
    relevanceScore: number;
    stages: RetrievalStage[];
  };
}

export interface QueryPlan {
  searchTerms: string[];
}

export interface RetrievalResult {
  documents: RetrievedGuideline[];
  queryPlan: QueryPlan;
  intent: SearchIntent;
  retried: boolean;
}

export interface RetrievalOptions {
  conversationContext?: string;
  profile?: HealthProfile;
}

const queryPlanSchema = {
  type: "object",
  properties: {
    searchTerms: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["searchTerms"],
} as const;

function uniqueTerms(terms: string[], maximum = 10) {
  return [
    ...new Set(
      terms
        .map((term) => term.replace(/[\u0000-\u001F\u007F]/g, " ").trim().replace(/\s+/g, " ").slice(0, 140))
        .filter(Boolean)
    ),
  ].slice(0, maximum);
}

function fallbackSearchTerms(question: string) {
  const lower = question.toLowerCase();
  const terms = [question];

  if (/child|kid|baby|toddler/.test(lower)) {
    terms.push("children outdoor exposure poor air quality", "sensitive groups children air pollution");
  }
  if (/play|outside|outdoor|walk/.test(lower)) {
    terms.push("outdoor activity air quality exposure", "children reduce outdoor exposure poor air quality");
  }
  if (/run|jog|exercise|workout|sport/.test(lower)) {
    terms.push("strenuous outdoor exercise particulate pollution");
  }
  if (/mask|n95|face cover/.test(lower)) {
    terms.push("N95 mask PM2.5 protection");
  }
  if (/asthma|copd|heart|elder|older|senior/.test(lower)) {
    terms.push("sensitive groups minimize outdoor activity poor air quality");
  }
  if (/aqi|pollution|smog|air quality/.test(lower)) {
    terms.push("AQI health risk outdoor exposure");
  }
  const aqiBand = ["very poor", "satisfactory", "moderate", "severe", "poor", "good"].find(
    (band) => lower.includes(band) && /\baqi\b|air quality/.test(lower)
  );
  if (aqiBand) terms.push(`${aqiBand} AQI`);

  return uniqueTerms(terms);
}

function parseQueryPlan(text: string, question: string, intent: SearchIntent): QueryPlan {
  const parsed = parseJsonObject(text);
  const generatedTerms = asStringArray(parsed.searchTerms, 5, 140);
  return {
    searchTerms: uniqueTerms([
      question,
      ...generatedTerms,
      ...intent.expandedTerms,
      ...fallbackSearchTerms(question),
    ]),
  };
}

async function planQuery(
  question: string,
  conversationContext: string,
  intent: SearchIntent,
  retry = false
): Promise<QueryPlan> {
  const cacheKey = JSON.stringify({ question, conversationContext, concepts: intent.concepts, retry });
  const cached = queryPlanCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (queryPlanCache.size >= MAX_QUERY_PLAN_CACHE_ENTRIES) {
    for (const [key, value] of queryPlanCache) {
      if (value.expiresAt <= Date.now()) queryPlanCache.delete(key);
    }
    if (queryPlanCache.size >= MAX_QUERY_PLAN_CACHE_ENTRIES) queryPlanCache.delete(queryPlanCache.keys().next().value!);
  }

  if (process.env.AIRWISE_QUERY_PLANNER === "deterministic") {
    const value = { searchTerms: uniqueTerms([question, ...fallbackSearchTerms(question), ...intent.expandedTerms]) };
    queryPlanCache.set(cacheKey, { value, expiresAt: Date.now() + QUERY_PLAN_CACHE_TTL_MS });
    return value;
  }

  const retryInstruction = retry
    ? "The first lexical search returned no results. Use different but precise health-guidance vocabulary."
    : "Create the first retrieval plan.";

  try {
    const response = await getGeminiClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: `You are a query planner for an Indian air-quality public-health knowledge base.\n\n${retryInstruction}\n\nTurn the user's question into 2 to 5 short, concrete Elasticsearch search phrases. Preserve important qualifiers such as children, outdoor activity, exercise, masks, asthma, and AQI. Translate conversational wording into health-guidance wording, but do not answer the question or invent facts. The deterministic intent detector found these concepts: ${intent.concepts.join(", ")}. Use them only to improve retrieval wording.\n\nRecent conversation context (may clarify a follow-up):\n${conversationContext || "None"}\n\nUser question: ${question}`,
      config: {
        temperature: 0,
        maxOutputTokens: 180,
        // Query planning is a short structured task. Reserving tokens for
        // thinking can otherwise leave no tokens for the required JSON output.
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: queryPlanSchema,
      },
    });

    const value = parseQueryPlan(response.text ?? "", question, intent);
    queryPlanCache.set(cacheKey, { value, expiresAt: Date.now() + QUERY_PLAN_CACHE_TTL_MS });
    return value;
  } catch (error) {
    console.warn("Query planning failed; using deterministic expansion.", error);
    const value = { searchTerms: uniqueTerms([question, ...fallbackSearchTerms(question), ...intent.expandedTerms]) };
    queryPlanCache.set(cacheKey, { value, expiresAt: Date.now() + QUERY_PLAN_CACHE_TTL_MS });
    return value;
  }
}

function isGuidelineDocument(value: unknown): value is GuidelineDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Record<string, unknown>;
  return ["title", "source", "category", "content"].every(
    (field) => typeof doc[field] === "string" && doc[field].trim().length > 0
  );
}

interface SearchCandidate {
  document: GuidelineDocument;
  score: number;
  stage: RetrievalStage;
}

async function searchStage(
  stage: RetrievalStage,
  searchTerms: string[]
): Promise<SearchCandidate[]> {
  const terms = uniqueTerms(searchTerms, 12);
  if (terms.length === 0) return [];

  const should: estypes.QueryDslQueryContainer[] = terms.flatMap(
    (term, index): estypes.QueryDslQueryContainer[] => [
      {
        multi_match: {
          query: term,
          fields: SEARCH_FIELDS,
          type: "best_fields",
          operator: index === 0 ? "or" : "and",
          minimum_should_match: index === 0 ? "60%" : "75%",
          fuzziness: "AUTO",
          prefix_length: 1,
          boost: stage === "lexical" && index === 0 ? 5 : 2,
        },
      },
      {
        match_phrase: {
          title: { query: term, slop: 2, boost: 8 },
        },
      },
    ]
  );

  const result = await getElasticClient().search<GuidelineDocument>({
    index: HEALTH_GUIDELINES_INDEX,
    size: 8,
    track_total_hits: false,
    _source: ["title", "source", "category", "content"],
    query: { bool: { should, minimum_should_match: 1 } },
  });

  return result.hits.hits.flatMap((hit) =>
    isGuidelineDocument(hit._source)
      ? [{ document: hit._source, score: hit._score ?? 0, stage }]
      : []
  );
}

export function validateQuestion(value: unknown) {
  const message = asTrimmedString(value, MAX_MESSAGE_LENGTH);
  if (!message) throw new Error("A non-empty message is required.");
  return message;
}

function normalizedWords(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9.]+/g) ?? []);
}

function documentKey(document: GuidelineDocument) {
  return `${document.source}:${document.title}:${document.content}`;
}

function rankCandidates(
  candidates: SearchCandidate[],
  question: string,
  intent: SearchIntent,
  profile: HealthProfile
): RetrievedGuideline[] {
  const grouped = new Map<string, SearchCandidate[]>();
  for (const candidate of candidates) {
    const key = documentKey(candidate.document);
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }

  const questionWords = normalizedWords(question);
  const conceptVocabulary = new Map(
    intent.concepts.map((concept) => [concept, conceptTerms([concept])])
  );
  const profileText = profileLabels(profile).join(" ").toLowerCase();

  const ranked = [...grouped.values()].map((matches): RetrievedGuideline => {
    const document = matches[0].document;
    const searchableText = `${document.title} ${document.category} ${document.content}`.toLowerCase();
    const titleWords = normalizedWords(document.title);
    const exactTitleMatches = [...questionWords].filter((word) => titleWords.has(word)).length;
    const exactContentMatches = [...questionWords].filter((word) => searchableText.includes(word)).length;
    const exactTitlePhrase = document.title.toLowerCase().includes(question.toLowerCase());
    const matchedConcepts = intent.concepts.filter((concept) =>
      conceptVocabulary.get(concept)?.some((term) => searchableText.includes(term.toLowerCase()))
    );
    const categoryBoost = intent.categoryHints.includes(document.category) ? 4 : 0;
    const profileBoost = profileText && [...profileText.split(" ")].some((term) => searchableText.includes(term)) ? 2 : 0;
    const stageBoost = matches.reduce(
      (total, match) => total + (match.stage === "lexical" ? 10 : match.stage === "expanded" ? 7 : 5),
      0
    );
    const elasticScore = Math.max(...matches.map((match) => match.score));
    const relevanceScore = Math.round((stageBoost + elasticScore + exactTitleMatches * 15 + (exactTitlePhrase ? 30 : 0) + exactContentMatches + matchedConcepts.length * 5 + categoryBoost + profileBoost) * 10) / 10;
    const stages = [...new Set(matches.map((match) => match.stage))];
    const matchedBecause = [
      ...stages.map((stage) => `${stage === "lexical" ? "Direct" : stage === "expanded" ? "Expanded" : stage === "intent" ? "Intent" : "Fallback"} retrieval match`),
      ...(exactTitleMatches > 0 ? ["Title matched question terms"] : []),
      ...(exactTitlePhrase ? ["Title matched the question phrase"] : []),
      ...(categoryBoost > 0 ? ["Category matched inferred intent"] : []),
      ...(profileBoost > 0 ? ["Health-profile relevance"] : []),
    ];

    return {
      ...document,
      retrieval: {
        matchedBecause: uniqueTerms(matchedBecause, 4),
        matchedConcepts,
        relevanceScore,
        stages,
      },
    };
  });

  const sorted = ranked.sort((left, right) => right.retrieval.relevanceScore - left.retrieval.relevanceScore);
  const strongMatches = sorted.filter((document) => document.retrieval.relevanceScore >= 10);
  return (strongMatches.length > 0 ? strongMatches : sorted).slice(0, 4);
}

async function retrieveInStages(
  question: string,
  queryPlan: QueryPlan,
  intent: SearchIntent,
  profile: HealthProfile,
  fallback = false
) {
  const intentTerms = uniqueTerms([...intent.expandedTerms, ...conceptTerms(intent.concepts)], 12);
  const [lexical, expanded, semanticIntent] = await Promise.all([
    searchStage(fallback ? "fallback" : "lexical", [question]),
    searchStage(fallback ? "fallback" : "expanded", queryPlan.searchTerms),
    searchStage(fallback ? "fallback" : "intent", intentTerms),
  ]);
  return rankCandidates([...lexical, ...expanded, ...semanticIntent], question, intent, profile);
}

function readRetrievalOptions(value: string | RetrievalOptions): Required<RetrievalOptions> {
  if (typeof value === "string") {
    return { conversationContext: value, profile: { selections: [] } };
  }
  return {
    conversationContext: value.conversationContext ?? "",
    profile: value.profile ?? { selections: [] },
  };
}

/** Gemini plans wording; Elasticsearch remains the sole retrieval system. */
export async function retrieveGuidelines(
  question: string,
  options: string | RetrievalOptions = ""
): Promise<RetrievalResult> {
  const { conversationContext, profile } = readRetrievalOptions(options);
  const intent = detectSearchIntent(question, conversationContext, profile);
  const queryPlan = await planQuery(question, conversationContext, intent);
  const documents = await retrieveInStages(question, queryPlan, intent, profile);

  if (documents.length > 0) return { documents, queryPlan, intent, retried: false };

  const retryIntent = detectSearchIntent(
    `${question} air pollution outdoor exposure health guidance`,
    conversationContext,
    profile
  );
  const retryPlan = await planQuery(question, conversationContext, retryIntent, true);
  const retryDocuments = await retrieveInStages(question, retryPlan, retryIntent, profile, true);
  return { documents: retryDocuments, queryPlan: retryPlan, intent: retryIntent, retried: true };
}

function formatContext(documents: GuidelineDocument[]) {
  return documents
    .map(
      (doc, index) =>
        `[${index + 1}] Title: ${doc.title}\nSource: ${doc.source}\nCategory: ${doc.category}\nGuidance: ${doc.content}`
    )
    .join("\n\n");
}

export interface HealthAnswer {
  decision: string;
  reason: string;
  actions: string[];
  sources: string[];
  explainability: Explainability;
}

const answerSchema = {
  type: "object",
  properties: {
    decision: { type: "string" },
    reason: { type: "string" },
    actions: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
    riskLevel: { type: "string", enum: ["Low", "Moderate", "High", "Very High"] },
  },
  required: ["decision", "reason", "actions", "sources", "riskLevel"],
} as const;

function insufficientContextAnswer(liveAqi: LiveAqi | null, context: ChatRequestContext): HealthAnswer {
  return {
    decision: "Unable to provide a guideline-based decision",
    reason: "No trusted health guidance was found for this question in the available WHO/CPCB knowledge base.",
    actions: [],
    sources: [],
    explainability: {
      riskLevel: "Low",
      confidenceLevel: "Low",
      factorsConsidered: factorsFor(liveAqi, [], context),
    },
  };
}

function validRiskLevel(value: unknown): Explainability["riskLevel"] {
  return value === "Low" || value === "Moderate" || value === "High" || value === "Very High"
    ? value
    : "Moderate";
}

function parseHealthAnswer(text: string, allowedSources: string[]): Omit<HealthAnswer, "explainability"> & { riskLevel: Explainability["riskLevel"] } {
  const parsed = parseJsonObject(text);
  const decision = asTrimmedString(parsed.decision, 240);
  const reason = asTrimmedString(parsed.reason, 1_200);

  if (!decision || !reason) throw new Error("The model response was missing required health guidance.");

  const allowedSourceSet = new Set(allowedSources.map((source) => source.toLowerCase()));
  const sources = asStringArray(parsed.sources, 5, 100).filter((source) =>
    allowedSourceSet.has(source.toLowerCase())
  );

  return {
    decision,
    reason,
    actions: asStringArray(parsed.actions, 5),
    sources,
    riskLevel: validRiskLevel(parsed.riskLevel),
  };
}

export function buildEvidence(documents: RetrievedGuideline[]): EvidenceItem[] {
  return documents.map((document) => ({
    source: document.source,
    title: document.title,
    excerpt: document.content.length > 220 ? `${document.content.slice(0, 217)}...` : document.content,
    relevance: document.retrieval.matchedBecause.join("; "),
    matchedBecause: document.retrieval.matchedBecause,
    matchedConcepts: document.retrieval.matchedConcepts,
    relevanceScore: document.retrieval.relevanceScore,
  }));
}

function factorsFor(liveAqi: LiveAqi | null, documents: GuidelineDocument[], context: ChatRequestContext) {
  const factors = [
    documents.length > 0 ? "Retrieved WHO/CPCB guidance" : "No matching retrieved health guidance",
  ];
  if (liveAqi) factors.unshift(`Live AQI ${liveAqi.aqi} (${liveAqi.category}) in ${liveAqi.city}`);
  if (liveAqi && liveAqi.temperature !== null) factors.push("Current weather conditions");
  const labels = profileLabels(context.profile);
  if (labels.length > 0) factors.push(`Health profile: ${labels.join(", ")}`);
  if (context.history.length > 0) factors.push("Recent conversation context");
  if (documents.some((document) => document.source === "WHO")) factors.push("WHO guidance");
  if (documents.some((document) => document.source === "CPCB")) factors.push("CPCB guidance");
  return [...new Set(factors)].slice(0, 6);
}

function formatConversationHistory(context: ChatRequestContext) {
  if (context.history.length === 0) return "None";
  return context.history
    .slice(-4)
    .map((turn, index) => `${index + 1}. User: ${turn.question}\nAssistant: ${turn.decision}. ${turn.reason}`)
    .join("\n");
}

function formatLiveAqi(liveAqi: LiveAqi) {
  return `Live AQI conditions (use this only as current environmental context):\n- City: ${liveAqi.city}\n- AQI: ${liveAqi.aqi} (${liveAqi.category}; ${liveAqi.aqiStandard})\n- Primary pollutant: ${liveAqi.primaryPollutant}\n- PM2.5: ${liveAqi.pm25} µg/m³\n- PM10: ${liveAqi.pm10} µg/m³\n- Temperature: ${liveAqi.temperature === null ? "unavailable" : `${liveAqi.temperature} °C`}\n- Humidity: ${liveAqi.humidity === null ? "unavailable" : `${liveAqi.humidity}%`}\n- Wind speed: ${liveAqi.windSpeed === null ? "unavailable" : `${liveAqi.windSpeed} km/h`}\n- Last updated: ${liveAqi.lastUpdated}\n- Data source: ${liveAqi.dataSource}`;
}

export async function generateHealthAnswer(
  question: string,
  documents: GuidelineDocument[],
  liveAqi: LiveAqi | null = null,
  context: ChatRequestContext = { profile: { selections: [] }, history: [] }
) {
  if (documents.length === 0) return insufficientContextAnswer(liveAqi, context);

  const sources = [...new Set(documents.map((document) => document.source))];
  if (liveAqi) sources.push("Live AQI");
  const liveAqiContext = liveAqi
    ? `\n\n${formatLiveAqi(liveAqi)}`
    : "\n\nLive AQI is currently unavailable. Do not claim to know current local conditions.";
  const profile = profileLabels(context.profile);
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: `You are AirWise AI, an Indian public-health guidance assistant. Answer the user's question using only the retrieved guidance and, when supplied, the live AQI conditions below. Use both sources together: connect the current AQI to the applicable health guidance. Apply the health profile to make the recommendation more cautious for sensitive groups. Use recent conversation only to resolve follow-up references; never treat it as evidence. Never present a CPCB-style estimate as an official monitoring-station reading, diagnose, or add medical facts absent from the context. If live AQI is unavailable, give a guidance-only answer and say that current local conditions are unavailable when relevant. If the guidance does not support an answer, use exactly this reason: "No trusted health guidance was found for this question in the available WHO/CPCB knowledge base."\n\nRetrieved guidance:\n${formatContext(documents)}${liveAqiContext}\n\nHealth profile: ${profile.length > 0 ? profile.join(", ") : "None supplied"}\n\nRecent conversation:\n${formatConversationHistory(context)}\n\nUser question: ${question}\n\nUse only source names present in the retrieved guidance and include "Live AQI" only when live conditions were supplied. Give practical actions only when supported by the guidance; when appropriate, include safe alternatives such as an indoor activity, reducing exposure time, or rechecking AQI later.`,
    config: {
      temperature: 0.1,
      maxOutputTokens: 500,
      // This response is schema-constrained and must always return JSON for
      // the API contract; do not consume its output budget on hidden thinking.
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: answerSchema,
    },
  });

  const parsed = parseHealthAnswer(response.text ?? "", sources);
  const confidenceLevel: Explainability["confidenceLevel"] = liveAqi && documents.length >= 2 ? "High" : "Medium";
  return {
    decision: parsed.decision,
    reason: parsed.reason,
    actions: parsed.actions,
    sources: parsed.sources,
    explainability: {
      riskLevel: parsed.riskLevel,
      confidenceLevel,
      factorsConsidered: factorsFor(liveAqi, documents, context),
    },
  };
}
