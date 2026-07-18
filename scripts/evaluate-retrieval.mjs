import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = (process.env.AIRWISE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const cases = JSON.parse(
  await readFile(resolve(process.cwd(), "evaluation/retrieval-cases.json"), "utf8")
);

const results = [];
for (const testCase of cases) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: testCase.query }),
    });
    const payload = await response.json();
    const titles = Array.isArray(payload.documents)
      ? payload.documents.map((document) => document.title)
      : [];
    const passed = testCase.expectedTitles.some((title) => titles.includes(title));
    results.push({
      id: testCase.id,
      query: testCase.query,
      expectedTitles: testCase.expectedTitles,
      retrievedTitles: titles,
      passed,
      latencyMs: Math.round(performance.now() - startedAt),
      error: response.ok ? undefined : payload.error ?? `HTTP ${response.status}`,
    });
  } catch (error) {
    results.push({
      id: testCase.id,
      query: testCase.query,
      expectedTitles: testCase.expectedTitles,
      retrievedTitles: [],
      passed: false,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : "Unknown request error",
    });
  }
}

const passed = results.filter((result) => result.passed).length;
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  total: results.length,
  passed,
  retrievalAccuracy: Number(((passed / results.length) * 100).toFixed(1)),
  medianLatencyMs: [...results]
    .map((result) => result.latencyMs)
    .sort((left, right) => left - right)[Math.floor(results.length / 2)],
  results,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = passed === results.length ? 0 : 1;
