import { Client } from "@elastic/elasticsearch";

let client: Client | undefined;

/**
 * Creates one Elasticsearch client per server process. Keeping this lazy makes
 * configuration failures request-scoped, instead of crashing route imports.
 */
export function getElasticClient() {
  if (client) return client;

  const node = process.env.ELASTICSEARCH_URL;
  const apiKey = process.env.ELASTICSEARCH_API_KEY;

  if (!node || !apiKey) {
    throw new Error("Elasticsearch is not configured.");
  }

  client = new Client({
    node,
    auth: { apiKey },
  });

  return client;
}

export const HEALTH_GUIDELINES_INDEX = "health-guidelines";
