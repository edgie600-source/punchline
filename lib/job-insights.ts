import Anthropic from "@anthropic-ai/sdk";
import { parseClaudeJsonObject } from "@/lib/parse-claude-json";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You summarize construction job field updates for the company owner.
Write in plain English. Be concise and practical. No markdown headings.

You will receive the 10 most recent SMS-derived updates for ONE job (oldest first in the list).
Return ONLY a JSON object with EXACTLY this shape:
{ "bullets_en": ["...", "..."], "bullets_es": ["...", "..."] }

Include between 2 and 4 bullet strings in each language. Each bullet should cover things like:
- Open blockers and roughly how long they have been an issue (infer from timestamps if present)
- Materials mentioned as needed or on order
- Progress: what was done and what is likely next
- Patterns or risks (e.g. same blocker recurring, stalled work)

If information is missing, skip that angle rather than inventing facts.`;

export type InsightUpdatePayload = {
  created_at: string;
  sender_name: string | null;
  work_completed_en: string | null;
  blockers: string | null;
  blockers_en: string | null;
  materials_needed_en: string | null;
  raw_message: string | null;
  blocker_resolved?: boolean | null;
};

export async function generateJobInsights(
  updatesNewestFirst: InsightUpdatePayload[],
): Promise<{
  bullets_en: string[];
  bullets_es: string[];
  error: string | null;
}> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      bullets_en: [],
      bullets_es: [],
      error: "Insights unavailable (missing API key).",
    };
  }

  const last10 = updatesNewestFirst.slice(0, 10);
  const chronological = [...last10].reverse();

  if (chronological.length === 0) {
    return {
      bullets_en: [
        "No updates yet for this job. Insights will appear after the crew sends SMS check-ins.",
      ],
      bullets_es: [
        "Aún no hay actualizaciones para esta obra. Los insights aparecerán después de que el equipo envíe reportes por SMS.",
      ],
      error: null,
    };
  }

  const anthropic = new Anthropic({ apiKey: key });
  const userJson = JSON.stringify(chronological, null, 2);

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 768,
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
      return { bullets_en: [], bullets_es: [], error: "Could not generate insights." };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = parseClaudeJsonObject(textBlock.text);
    } catch {
      return { bullets_en: [], bullets_es: [], error: "Could not parse insights." };
    }

    const normalizeBullets = (raw: unknown): string[] | null => {
      if (!Array.isArray(raw)) return null;
      const bullets = raw
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        .map((b) => b.trim())
        .slice(0, 4);
      return bullets.length > 0 ? bullets : [];
    };

    const bulletsEnRaw = parsed.bullets_en;
    const bulletsEsRaw = parsed.bullets_es;

    const bullets_en = normalizeBullets(bulletsEnRaw);
    const bullets_es = normalizeBullets(bulletsEsRaw);

    if (bullets_en === null && bullets_es === null) {
      return { bullets_en: [], bullets_es: [], error: "Could not parse insights." };
    }

    const final_en = bullets_en ?? bullets_es ?? [];
    const final_es = bullets_es ?? bullets_en ?? [];

    const default_en = ["Not enough detail in recent updates to summarize yet."];
    const default_es = [
      "Todavía no hay suficiente detalle en las actualizaciones recientes para resumir.",
    ];

    return {
      bullets_en: final_en.length >= 2 ? final_en : final_en.length > 0 ? final_en : default_en,
      bullets_es: final_es.length >= 2 ? final_es : final_es.length > 0 ? final_es : default_es,
      error: null,
    };
  } catch (e) {
    console.error(e);
    return {
      bullets_en: [],
      bullets_es: [],
      error: "Could not generate insights right now.",
    };
  }
}
