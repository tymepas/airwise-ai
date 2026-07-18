import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { asStringArray, asTrimmedString, parseJsonObject } from "@/lib/json";
import { getElasticClient, HEALTH_GUIDELINES_INDEX } from "@/lib/elastic";
import type { estypes } from "@elastic/elasticsearch";

const MAX_MESSAGE_LENGTH = 1_000;
const SEARCH_FIELDS = ["title^6", "content^3", "category^2", "source^2"];

export interface GuidelineDocument {
  title: string;
  source: string;
  category: string;
  content: string;
}

export interface QueryPlan {
  searchTerms: string[];
}

export interface RetrievalResult {
  documents: GuidelineDocument[];
  queryPlan: QueryPlan;
  retried: boolean;
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

function uniqueTerms(terms: string[]) {
  return [...new Set(terms.map((term) => term.trim().replace(/\s+/g, " ")).filter(Boolean))].slice(
    0,
    6
  );
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

  return uniqueTerms(terms);
}

function parseQueryPlan(text: string, question: string): QueryPlan {
  const parsed = parseJsonObject(text);
  const generatedTerms = asStringArray(parsed.searchTerms, 5, 140);
  return { searchTerms: uniqueTerms([question, ...generatedTerms, ...fallbackSearchTerms(question)]) };
}

async function planQuery(question: string, retry = false): Promise<QueryPlan> {
  const retryInstruction = retry
    ? "The first lexical search returned no results. Use different but precise health-guidance vocabulary."
    : "Create the first retrieval plan.";

  try {
    const response = await getGeminiClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: `You are a query planner for a Delhi air-quality public-health knowledge base.\n\n${retryInstruction}\n\nTurn the user's question into 2 to 5 short, concrete Elasticsearch search phrases. Preserve important qualifiers such as children, outdoor activity, exercise, masks, asthma, and AQI. Translate conversational wording into health-guidance wording, but do not answer the question or invent facts.\n\nUser question: ${question}`,
      config: {
        temperature: 0,
        maxOutputTokens: 180,
        responseMimeType: "application/json",
        responseSchema: queryPlanSchema,
      },
    });

    return parseQueryPlan(response.text ?? "", question);
  } catch (error) {
    console.warn("Query planning failed; using deterministic expansion.", error);
    return { searchTerms: fallbackSearchTerms(question) };
  }
}

function isGuidelineDocument(value: unknown): value is GuidelineDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Record<string, unknown>;
  return ["title", "source", "category", "content"].every(
    (field) => typeof doc[field] === "string" && doc[field].trim().length > 0
  );
}

async function searchGuidelines(searchTerms: string[]) {
  const client = getElasticClient();
  const should: estypes.QueryDslQueryContainer[] = searchTerms.flatMap(
    (term, index): estypes.QueryDslQueryContainer[] => [
    {
      multi_match: {
        query: term,
        fields: SEARCH_FIELDS,
        type: "best_fields",
        operator: index === 0 ? "or" : "and",
        minimum_should_match: index === 0 ? "70%" : "100%",
        fuzziness: "AUTO",
        prefix_length: 1,
        boost: index === 0 ? 4 : 2,
      },
    },
    {
      match_phrase: {
        title: { query: term, slop: 2, boost: 7 },
      },
    },
    ]
  );

  const result = await client.search<GuidelineDocument>({
    index: HEALTH_GUIDELINES_INDEX,
    size: 5,
    track_total_hits: false,
    _source: ["title", "source", "category", "content"],
    query: {
      bool: {
        should,
        minimum_should_match: 1,
      },
    },
  });

  return result.hits.hits
    .map((hit) => hit._source)
    .filter(isGuidelineDocument);
}

export function validateQuestion(value: unknown) {
  const message = asTrimmedString(value, MAX_MESSAGE_LENGTH);
  if (!message) throw new Error("A non-empty message is required.");
  return message;
}

/** Gemini plans wording; Elasticsearch remains the sole retrieval system. */
export async function retrieveGuidelines(question: string): Promise<RetrievalResult> {
  const queryPlan = await planQuery(question);
  const documents = await searchGuidelines(queryPlan.searchTerms);

  if (documents.length > 0) return { documents, queryPlan, retried: false };

  const retryPlan = await planQuery(question, true);
  const retryDocuments = await searchGuidelines(retryPlan.searchTerms);
  return { documents: retryDocuments, queryPlan: retryPlan, retried: true };
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
}

const answerSchema = {
  type: "object",
  properties: {
    decision: { type: "string" },
    reason: { type: "string" },
    actions: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["decision", "reason", "actions", "sources"],
} as const;

function insufficientContextAnswer(): HealthAnswer {
  return {
    decision: "Unable to provide a guideline-based decision",
    reason: "I don't have enough information from the available health guidelines.",
    actions: [],
    sources: [],
  };
}

function parseHealthAnswer(text: string, allowedSources: string[]): HealthAnswer {
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
  };
}

export async function generateHealthAnswer(question: string, documents: GuidelineDocument[]) {
  if (documents.length === 0) return insufficientContextAnswer();

  const sources = [...new Set(documents.map((document) => document.source))];
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: `You are AirWise AI, a Delhi public-health guidance assistant. Answer the user's question using only the retrieved guidance below. Do not infer an AQI reading, diagnose, or add medical facts that are absent from the context. If the context does not support an answer, use exactly this reason: "I don't have enough information from the available health guidelines."\n\nRetrieved guidance:\n${formatContext(documents)}\n\nUser question: ${question}\n\nUse only source names present in the retrieved guidance. Give practical actions only when supported by it.`,
    config: {
      temperature: 0.1,
      maxOutputTokens: 500,
      responseMimeType: "application/json",
      responseSchema: answerSchema,
    },
  });

  return parseHealthAnswer(response.text ?? "", sources);
}
