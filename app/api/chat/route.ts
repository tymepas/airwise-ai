import { NextResponse } from "next/server";
import {
  generateHealthAnswer,
  retrieveGuidelines,
  validateQuestion,
} from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const message = validateQuestion(
      body && typeof body === "object" ? (body as { message?: unknown }).message : undefined
    );
    const { documents } = await retrieveGuidelines(message);
    const answer = await generateHealthAnswer(message, documents);

    return NextResponse.json({
      success: true,
      decision: answer.decision,
      reason: answer.reason,
      actions: answer.actions,
      sources: answer.sources,
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
