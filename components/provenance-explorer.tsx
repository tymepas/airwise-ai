"use client";

import { SourceBadge } from "@/components/source-badge";
import type { LiveAqiProvenance } from "@/lib/aqi-types";
import type { AiReasoningProvenance, EvidenceItem, RetrievalDebugInfo } from "@/lib/chat-types";

interface LiveDataSummary {
  city: string;
  aqi: number;
  category: string;
  timestamp: string;
  weather: { temperature: number | null; humidity: number | null; windSpeed: number | null };
  provenance: LiveAqiProvenance;
}

interface ProvenanceExplorerProps {
  liveData?: LiveDataSummary | null;
  evidence?: EvidenceItem[];
  reasoning?: AiReasoningProvenance;
  debug?: RetrievalDebugInfo;
}

const OPEN_METEO_WEBSITE = "https://open-meteo.com/";
const OPEN_METEO_AIR_DOCS = "https://open-meteo.com/en/docs/air-quality-api";
const OPEN_METEO_WEATHER_DOCS = "https://open-meteo.com/en/docs";
const WHO_WEBSITE = "https://www.who.int/health-topics/air-pollution";
const CPCB_WEBSITE = "https://cpcb.nic.in/";

export function ProvenanceExplorer({ liveData, evidence = [], reasoning, debug }: ProvenanceExplorerProps) {
  if (!liveData && evidence.length === 0 && !reasoning) return null;

  return (
    <section className="flex flex-col gap-4">
      {liveData && <LiveDataSources data={liveData} />}
      {evidence.length > 0 && <RetrievedKnowledge evidence={evidence} />}
      {reasoning && <AiReasoning reasoning={reasoning} />}
      <ArchitecturePanel />
      {debug && <DeveloperDebug debug={debug} evidence={evidence} />}
    </section>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-3xl border border-white bg-white/70 shadow-lg backdrop-blur-xl" open>
      <summary className="cursor-pointer list-none px-6 py-6 sm:px-8 marker:hidden">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Transparency</p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <span className="text-xl text-slate-400 transition group-open:rotate-45">+</span>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-6 py-6 sm:px-8">{children}</div>
    </details>
  );
}

function LiveDataSources({ data }: { data: LiveDataSummary }) {
  const { provenance } = data;
  return (
    <Panel title="🌍 Live Data Sources" subtitle="Live environmental data comes directly from external APIs, never from Gemini.">
      <div className="flex flex-wrap gap-2"><SourceBadge kind="LIVE API" /><SourceBadge kind="VERIFIED" /></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Fact label="Air quality provider" value={provenance.provider} />
        <Fact label="Weather provider" value={provenance.weatherProvider} />
        <Fact label="Air-quality model" value={provenance.airQualityModel} />
        <Fact label="Status" value={provenance.status} />
        <Fact label="Current city" value={data.city} />
        <Fact label="Coordinates" value={`${provenance.latitude.toFixed(4)}, ${provenance.longitude.toFixed(4)}`} />
        <Fact label="Retrieved at" value={formatDate(provenance.retrievedAt)} />
        <Fact label="Response timestamp" value={formatDate(provenance.responseTimestamp)} />
        <Fact label="Update frequency" value={provenance.updateFrequency} />
        <Fact label="Purpose" value="PM2.5, PM10, temperature, humidity, wind speed and AQI estimate" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <ExternalLink href={OPEN_METEO_WEBSITE} label="Open website" />
        <ExternalLink href={OPEN_METEO_AIR_DOCS} label="Air-quality docs" />
        <ExternalLink href={OPEN_METEO_WEATHER_DOCS} label="Weather docs" />
        <ExternalLink href={provenance.airQualityEndpoint} label="Open AQ JSON" />
        <ExternalLink href={provenance.weatherEndpoint} label="Open weather JSON" />
        <CopyButton value={provenance.airQualityEndpoint} label="Copy AQ URL" />
        <CopyButton value={provenance.weatherEndpoint} label="Copy weather URL" />
      </div>
    </Panel>
  );
}

function RetrievedKnowledge({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <Panel title="📚 Retrieved Knowledge" subtitle="These documents were retrieved from the Elasticsearch health-guidelines index; they were not generated.">
      <div className="flex flex-wrap gap-2"><SourceBadge kind="ELASTICSEARCH" /><SourceBadge kind="RAG" /><SourceBadge kind="VERIFIED" /></div>
      <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
        Lexical Search → Expanded Query → Intent Search → Ranking → Evidence Selection → Gemini
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {evidence.map((item) => <EvidenceProvenance key={`${item.source}-${item.documentId}`} item={item} />)}
      </div>
    </Panel>
  );
}

function EvidenceProvenance({ item }: { item: EvidenceItem }) {
  const sourceUrl = item.source === "WHO" ? WHO_WEBSITE : CPCB_WEBSITE;
  const citation = `${item.source}. ${item.title}. Retrieved from Elasticsearch index ${item.index}.`;
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer list-none marker:hidden">
        <div className="flex flex-wrap items-center gap-2 pr-5">
          <span className="font-bold text-slate-800">{item.title}</span>
          <SourceBadge kind="ELASTICSEARCH" />
          <SourceBadge kind={item.source === "WHO" ? "WHO" : "CPCB"} />
          <SourceBadge kind="RAG" />
        </div>
        <p className="mt-2 text-sm text-slate-500">{item.category} · score {item.relevanceScore} · similarity {item.similarityScore}</p>
      </summary>
      <p className="mt-4 text-sm leading-relaxed text-slate-700"><HighlightedText text={item.excerpt} terms={item.matchedKeywords} /></p>
      <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <Fact label="Retrieved from" value="Elasticsearch" />
        <Fact label="Index" value={item.index} />
        <Fact label="Document ID" value={item.documentId} />
        <Fact label="Retrieved time" value={formatDate(item.retrievedAt)} />
        <Fact label="Stages" value={item.matchedBecause.join("; ")} />
        <Fact label="Matched keywords" value={item.matchedKeywords.join(", ") || "No direct keyword match"} />
        <Fact label="Matched concepts" value={item.matchedConcepts.join(", ") || "No ontology concept label"} />
      </div>
      <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
        Why Gemini received this: {item.relevance}. It was retained as one of the highest-ranked, source-backed evidence items.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ExternalLink href={sourceUrl} label="Open source" />
        <CopyButton value={citation} label="Copy citation" />
        <CopyButton value={sourceUrl} label="Copy source URL" />
        <ShareButton value={citation} />
      </div>
    </details>
  );
}

function AiReasoning({ reasoning }: { reasoning: AiReasoningProvenance }) {
  const checks = [
    ["Grounded", reasoning.grounded], ["Evidence based", reasoning.evidenceBased], ["Uses live AQI", reasoning.usesLiveAqi],
    ["Uses Elasticsearch", reasoning.usesElasticsearch], ["Uses conversation context", reasoning.usesConversationContext], ["Uses health profile", reasoning.usesHealthProfile],
  ] as const;
  return (
    <Panel title="🤖 AI Reasoning" subtitle="Gemini is the grounded reasoning engine, not the search engine or source of health guidance.">
      <div className="flex flex-wrap gap-2"><SourceBadge kind="GEMINI" /><SourceBadge kind="RAG" /><SourceBadge kind="VERIFIED" /></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Fact label="Model" value={reasoning.model} /><Fact label="Role" value={reasoning.role} />
        {checks.map(([label, value]) => <Fact key={label} label={label} value={value ? "YES" : "Not used for this request"} />)}
        <Fact label="Hallucination protection" value={reasoning.hallucinationProtection} />
      </div>
      <p className="mt-5 text-sm leading-relaxed text-slate-600">Gemini receives live AQI and weather when available, health profile, bounded conversation context, and selected WHO/CPCB evidence before producing the decision, reason, actions, and confidence.</p>
    </Panel>
  );
}

function ArchitecturePanel() {
  const steps = ["Browser", "Location", "Open-Meteo", "Live AQI", "Gemini Query Planner", "Intent Detection", "Elasticsearch", "WHO/CPCB Evidence", "Evidence Ranking", "Gemini Grounded Reasoning", "Decision"];
  return <Panel title="⚙️ How AirWise AI Works" subtitle="The complete, evidence-first path behind this recommendation.">
    <div className="flex flex-wrap items-center gap-2">{steps.map((step, index) => <div key={step} className="flex items-center gap-2"><span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">{step}</span>{index < steps.length - 1 && <span className="text-slate-400">→</span>}</div>)}</div>
  </Panel>;
}

function DeveloperDebug({ debug, evidence }: { debug: RetrievalDebugInfo; evidence: EvidenceItem[] }) {
  return <Panel title="Developer Retrieval Debug" subtitle="Visible only because Developer mode was enabled for this request.">
    <div className="grid gap-3 sm:grid-cols-2"><Fact label="Query planner output" value={debug.queryPlannerOutput.join(" · ")} /><Fact label="Expanded query" value={debug.expandedQuery.join(" · ")} /><Fact label="Matched concepts" value={debug.matchedConcepts.join(", ")} /><Fact label="Retrieval stages" value={debug.retrievalStages.join(" → ")} /><Fact label="Retrieved documents" value={String(debug.retrievedDocumentCount)} /><Fact label="Prompt context" value={`${debug.contextCharacters} characters / ~${debug.estimatedContextTokens} tokens`} /><Fact label="Evidence ranking" value={evidence.map((item) => `${item.title}: ${item.relevanceScore}`).join(" · ")} /></div>
  </Panel>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-700">{value}</p></div>; }
function ExternalLink({ href, label }: { href: string; label: string }) { return <a href={href} target="_blank" rel="noreferrer" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">{label}</a>; }
function CopyButton({ value, label }: { value: string; label: string }) { return <button type="button" onClick={() => void navigator.clipboard?.writeText(value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">{label}</button>; }
function ShareButton({ value }: { value: string }) { return <button type="button" onClick={() => void (navigator.share ? navigator.share({ title: "AirWise AI citation", text: value }) : navigator.clipboard?.writeText(value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Share citation</button>; }
function HighlightedText({ text, terms }: { text: string; terms: string[] }) { const expression = terms.filter((term) => term.length > 1).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"); if (!expression) return text; return text.split(new RegExp(`(${expression})`, "ig")).map((part, index) => terms.some((term) => term.toLowerCase() === part.toLowerCase()) ? <mark key={index} className="rounded bg-amber-100 px-0.5 text-slate-800">{part}</mark> : part); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
