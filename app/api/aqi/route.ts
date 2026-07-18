import { getLiveAqi } from "@/lib/aqi";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function numberParam(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = numberParam(searchParams.get("latitude"));
  const longitude = numberParam(searchParams.get("longitude"));
  const city = searchParams.get("city")?.trim().slice(0, 80) || undefined;

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json({ success: false, error: "Invalid location coordinates." }, { status: 400 });
  }

  try {
    const data = await getLiveAqi({ city, latitude, longitude });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Live AQI request failed", error);
    const message = error instanceof Error ? error.message : "Live AQI is currently unavailable.";
    const isClientError = message === "Unsupported city.";
    return NextResponse.json(
      { success: false, error: isClientError ? message : "Live AQI is currently unavailable." },
      { status: isClientError ? 400 : 503 }
    );
  }
}
