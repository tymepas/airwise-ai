import { NextResponse } from "next/server";
import { getElasticClient, HEALTH_GUIDELINES_INDEX } from "@/lib/elastic";

const documents = [
  {
    id: "cpcb-good-aqi",
    title: "Good AQI",
    source: "CPCB",
    category: "AQI",
    content:
      "AQI between 0 and 50 is considered Good. Air quality is satisfactory and poses little or no health risk."
  },
  {
    id: "cpcb-satisfactory-aqi",
    title: "Satisfactory AQI",
    source: "CPCB",
    category: "AQI",
    content:
      "AQI between 51 and 100 is satisfactory. Sensitive individuals may experience minor breathing discomfort."
  },
  {
    id: "cpcb-moderate-aqi",
    title: "Moderate AQI",
    source: "CPCB",
    category: "AQI",
    content:
      "AQI between 101 and 200 may cause breathing discomfort to people with lung disease, children and older adults."
  },
  {
    id: "cpcb-poor-aqi",
    title: "Poor AQI",
    source: "CPCB",
    category: "AQI",
    content:
      "AQI between 201 and 300 may cause breathing discomfort on prolonged exposure."
  },
  {
    id: "cpcb-very-poor-aqi",
    title: "Very Poor AQI",
    source: "CPCB",
    category: "AQI",
    content:
      "AQI between 301 and 400 may cause respiratory illness on prolonged exposure."
  },
  {
    id: "cpcb-severe-aqi",
    title: "Severe AQI",
    source: "CPCB",
    category: "AQI",
    content:
      "AQI above 400 affects healthy people and seriously impacts people with existing diseases."
  },
  {
    id: "who-outdoor-exercise",
    title: "WHO Outdoor Exercise",
    source: "WHO",
    category: "Health",
    content:
      "Avoid strenuous outdoor exercise when particulate pollution is high."
  },
  {
    id: "who-children",
    title: "WHO Children",
    source: "WHO",
    category: "Health",
    content:
      "Children are more vulnerable to air pollution and should reduce outdoor exposure during poor air quality."
  },
  {
    id: "who-mask-recommendation",
    title: "Mask Recommendation",
    source: "WHO",
    category: "Health",
    content:
      "An N95 mask offers significantly better protection against PM2.5 than a cloth mask."
  },
  {
    id: "who-sensitive-groups",
    title: "Sensitive Groups",
    source: "WHO",
    category: "Health",
    content:
      "People with asthma, COPD, heart disease, older adults and children should minimize outdoor activity during poor air quality."
  }
];

export const runtime = "nodejs";

export async function GET() {
  try {
    const elastic = getElasticClient();
    await Promise.all(
      documents.map(({ id, ...document }) =>
        elastic.index({
          index: HEALTH_GUIDELINES_INDEX,
          id,
          document,
        })
      )
    );

    await elastic.indices.refresh({
      index: HEALTH_GUIDELINES_INDEX,
    });

    return NextResponse.json({
      success: true,
      inserted: documents.length,
    });
  } catch (error) {
    console.error("Guideline seed failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to seed health guidelines. Please try again.",
      },
      { status: 500 }
    );
  }
}
