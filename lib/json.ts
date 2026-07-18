type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accepts JSON responses even when a provider accidentally wraps them in a fence. */
export function parseJsonObject(text: string): JsonRecord {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed)) return parsed;
  } catch {
    // Some providers include a short preamble despite structured-output settings.
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (isRecord(parsed)) return parsed;
  }

  throw new Error("The model returned an invalid JSON object.");
}

export function asTrimmedString(value: unknown, maxLength = 800) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function asStringArray(value: unknown, maxItems: number, maxLength = 240) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map((item) => asTrimmedString(item, maxLength)).filter(Boolean))].slice(
    0,
    maxItems
  );
}
