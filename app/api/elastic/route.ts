import { NextResponse } from "next/server";
import { getElasticClient } from "@/lib/elastic";

export const runtime = "nodejs";

export async function GET() {
  try {
    const elastic = getElasticClient();
    const info = await elastic.info();

    return NextResponse.json({
      success: true,
      cluster: info.cluster_name,
      version: info.version.number,
    });
  } catch (error) {
    console.error("Elasticsearch health check failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to contact Elasticsearch. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}
