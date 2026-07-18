import { NextResponse } from "next/server";
import { getLiveAqi } from "@/lib/aqi";
import {
  buildEvidence,
  generateHealthAnswer,
  retrieveGuidelines,
  validateQuestion,
} from "@/lib/rag";
import { normalizeHealthProfile } from "@/lib/health-profile";
import type { ChatRequestContext, ConversationTurn } from "@/lib/chat-types";

export const runtime = "nodejs";

function readLocation(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const location = (body as { location?: unknown }).location;
  if (!location || typeof location !== "object") return undefined;

  const value = location as Record<string, unknown>;
  return {
    city: typeof value.city === "string" ? value.city.trim().slice(0, 80) : undefined,
    latitude: typeof value.latitude === "number" ? value.latitude : undefined,
    longitude: typeof value.longitude === "number" ? value.longitude : undefined,
  };
}

function readConversationContext(body: unknown): ChatRequestContext {
  if (!body || typeof body !== "object") return { profile: { selections: [] }, history: [] };
  const value = body as { profile?: unknown; history?: unknown };
  const history = Array.isArray(value.history)
    ? value.history.flatMap((turn): ConversationTurn[] => {
        if (!turn || typeof turn !== "object") return [];
        const entry = turn as Record<string, unknown>;
        const question = typeof entry.question === "string" ? entry.question.trim().slice(0, 500) : "";
        const decision = typeof entry.decision === "string" ? entry.decision.trim().slice(0, 300) : "";
        const reason = typeof entry.reason === "string" ? entry.reason.trim().slice(0, 800) : "";
        return question && decision && reason ? [{ question, decision, reason }] : [];
      }).slice(-4)
    : [];

  return { profile: normalizeHealthProfile(value.profile), history };
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const message = validateQuestion(
      body && typeof body === "object" ? (body as { message?: unknown }).message : undefined
    );
    const location = readLocation(body);
    const context = readConversationContext(body);

    // AQI and retrieval are independent; run them concurrently to avoid adding
    // external API latency to the existing RAG path. A live-data failure must
    // never prevent a guidance-only answer.
    const [liveAqi, retrieval] = await Promise.all([
      getLiveAqi(location).catch(() => null),
      retrieveGuidelines(message, {
        conversationContext: context.history.map((turn) => `${turn.question} ${turn.reason}`).join("\n"),
        profile: context.profile,
      }),
    ]);
    const answer = await generateHealthAnswer(message, retrieval.documents, liveAqi, context);

    return NextResponse.json({
      success: true,
      decision: answer.decision,
      reason: answer.reason,
      actions: answer.actions,
      sources: answer.sources,
      explainability: answer.explainability,
      evidence: buildEvidence(retrieval.documents),
      liveData: liveAqi
        ? {
            city: liveAqi.city,
            aqi: liveAqi.aqi,
            category: liveAqi.category,
            timestamp: liveAqi.lastUpdated,
            weather: {
              temperature: liveAqi.temperature,
              humidity: liveAqi.humidity,
              windSpeed: liveAqi.windSpeed,
            },
          }
        : null,
    });

  } catch (error) {
    console.error("Chat request failed", error);
    const message = error instanceof Error ? error.message : "Unable to process the request.";
    const isClientError = message === "A non-empty message is required.";

    return NextResponse.json(
      {
        success: false,
        error: isClientError ? message : "Unable to process the request. Please try again.",
      },
      {
        status: isClientError ? 400 : 500,
      }
    );
  }
}
