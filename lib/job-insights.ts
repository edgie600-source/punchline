import Anthropic from "@anthropic-ai/sdk";
import { parseClaudeJsonObject } from "@/lib/parse-claude-json";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You summarize construction job field updates for the company owner.
Write in plain English. Be concise and practical. No markdown headings.

You will receive the 10 most recent SMS-derived updates for ONE job (oldest first in the list).
Return ONLY a JSON object with EXACTLY this shape:
{ "bullets": ["...", "..."] }

Include between 2 and 4 bullet strings. Each bullet should cover things like:
- Open blockers and roughly how long they have been an issue (infer from timestamps if present)
- Materials mentioned as needed or on order
- Progress: what was done and what is likely next
- Patterns or risks (e.g. same blocker recurring, stalled work)

If information is missing, skip that angle rather than inventing facts.`;

export type InsightUpdatePayload = {
  created_at: string;
  sender_name: string | null;
  work_completed_en: string | null;
  blockers_en: string | null;
  materials_needed_en: string | null;
  raw_message: string | null;
  blocker_resolved?: boolean | null;
};

export async function generateJobInsights(
  updatesNewestFirst: InsightUpdatePayload[],
): Promise<{ bullets: string[]; error: string | null }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { bullets: [], error: "Insights unavailable (missing API key)." };
  }

  const last10 = updatesNewestFirst.slice(0, 10);
  const chronological = [...last10].reverse();

  if (chronological.length === 0) {
    return {
      bullets: [
        "No updates yet for this job. Insights will appear after the crew sends SMS check-ins.",
      ],
      error: null,
    };
  }

  const anthropic = new Anthropic({ apiKey: key });
  const userJson = JSON.stringify(chronological, null, 2);

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Job update history (oldest → newest, up to 10):\n${userJson}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { bullets: [], error: "Could not generate insights." };
    }

    const parsed = parseClaudeJsonObject(textBlock.text) as {
      bullets?: unknown;
    };
    const raw = parsed.bullets;
    if (!Array.isArray(raw)) {
      return { bullets: [], error: "Could not parse insights." };
    }

    const bullets = raw
      .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
      .map((b) => b.trim())
      .slice(0, 4);

    if (bullets.length < 2) {
      return {
        bullets:
          bullets.length > 0
            ? bullets
            : ["Not enough detail in recent updates to summarize yet."],
        error: null,
      };
    }

    return { bullets, error: null };
  } catch (e) {
    console.error(e);
    return { bullets: [], error: "Could not generate insights right now." };
  }
}
