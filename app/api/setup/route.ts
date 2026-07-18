import { NextResponse } from "next/server";
import { getElasticClient, HEALTH_GUIDELINES_INDEX } from "@/lib/elastic";

export const runtime = "nodejs";

export async function GET() {
  try {
    const elastic = getElasticClient();
    const exists = await elastic.indices.exists({
      index: HEALTH_GUIDELINES_INDEX,
    });

    if (!exists) {
      await elastic.indices.create({
        index: HEALTH_GUIDELINES_INDEX,
        mappings: {
          properties: {
            title: {
              type: "text",
              fields: { keyword: { type: "keyword", ignore_above: 256 } },
            },
            source: {
              type: "keyword",
            },
            category: {
              type: "keyword",
            },
            content: {
              type: "text",
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Index ready",
    });

  } catch (error) {
    console.error("Index setup failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to prepare the search index. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}
