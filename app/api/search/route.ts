import { NextResponse } from "next/server";
import { retrieveGuidelines, validateQuestion } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const query = validateQuestion(
      body && typeof body === "object" ? (body as { query?: unknown }).query : undefined
    );
    const { documents } = await retrieveGuidelines(query);

    return NextResponse.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Search request failed", error);
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
