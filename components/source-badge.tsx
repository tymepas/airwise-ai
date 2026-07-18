const TOOLTIP: Record<SourceBadgeKind, string> = {
  "LIVE API": "Current environmental measurements from external APIs.",
  ELASTICSEARCH: "This information was retrieved from the Elasticsearch health-guidelines index.",
  WHO: "Official World Health Organization guidance stored in the knowledge base.",
  CPCB: "Central Pollution Control Board guidance stored in the knowledge base.",
  RAG: "Retrieved evidence was supplied to the reasoning model.",
  GEMINI: "Gemini generated the grounded recommendation from supplied evidence.",
  VERIFIED: "Provenance metadata is available for inspection.",
};

export type SourceBadgeKind = "LIVE API" | "ELASTICSEARCH" | "WHO" | "CPCB" | "RAG" | "GEMINI" | "VERIFIED";

export function SourceBadge({ kind }: { kind: SourceBadgeKind }) {
  return <span title={TOOLTIP[kind]} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-extrabold tracking-wide text-slate-600">{kind}</span>;
}
