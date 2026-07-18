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
  matchedConcepts: string[];
  relevanceScore: number;
}

export interface ChatRequestContext {
  profile: HealthProfile;
  history: ConversationTurn[];
}
