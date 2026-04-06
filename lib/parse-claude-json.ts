/**
 * Claude may return JSON alone or wrapped in markdown fences.
 */
export function parseClaudeJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;
  const parsed = JSON.parse(jsonStr);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Claude response was not a JSON object");
  }
  return parsed as Record<string, unknown>;
}
