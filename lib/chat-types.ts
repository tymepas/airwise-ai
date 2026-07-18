import type { HealthProfile } from "@/lib/health-profile";

export interface ConversationTurn {
  question: string;
  decision: string;
  reason: string;
}

export interface Explainability {
  riskLevel: "Low" | "Moderate" | "High" | "Very High";
  confidenceLevel: "Low" | "Medium" | "High";
  factorsConsidered: string[];
}

export interface EvidenceItem {
  source: string;
  title: string;
  excerpt: string;
  relevance: string;
  matchedBecause: string[];
  matchedKeywords: string[];
  matchedConcepts: string[];
  relevanceScore: number;
  category: string;
  documentId: string;
  index: "health-guidelines";
  retrievedAt: string;
  similarityScore: number;
}

export interface RetrievalDebugInfo {
  queryPlannerOutput: string[];
  expandedQuery: string[];
  matchedConcepts: string[];
  retrievalStages: string[];
  retrievedDocumentCount: number;
  contextCharacters: number;
  estimatedContextTokens: number;
}

export interface AiReasoningProvenance {
  model: string;
  role: string;
  grounded: boolean;
  evidenceBased: boolean;
  usesLiveAqi: boolean;
  usesElasticsearch: boolean;
  usesConversationContext: boolean;
  usesHealthProfile: boolean;
  hallucinationProtection: string;
}

export interface ChatRequestContext {
  profile: HealthProfile;
  history: ConversationTurn[];
}
