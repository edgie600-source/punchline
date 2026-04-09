import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { ensureJobForName } from "@/lib/ensure-job";
import { parseClaudeJsonObject } from "@/lib/parse-claude-json";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  'You are parsing field updates from construction crew members. Messages may be in English or Spanish.\n\nExtract the following from their text message:\n- sender_name (string or null): the first word or name at the start of the message before a dash or comma (e.g. "Mike - ..." => "Mike", "Sara, ..." => "Sara")\n- job_name (string or null)\n- work_completed (string or null)\n- blockers (string or null)\n- materials_needed (string or null)\n- hours_worked (number or null)\n- raw_message (string): the original message text\n\nThen return ALL extracted fields translated into BOTH English and Spanish.\n\nReturn ONLY a JSON object with EXACTLY these fields:\n- sender_name\n- job_name\n- work_completed_en\n- work_completed_es\n- blockers_en\n- blockers_es\n- materials_needed_en\n- materials_needed_es\n- hours_worked\n- raw_message\n\nRules:\n- If a field cannot be determined, set it to null.\n- If the source message is already English, work_completed_en should match it and work_completed_es should be the Spanish translation (and vice versa).\n- Keep job_name as provided (do not invent or embellish).\n- Do not include any extra keys or any explanatory text.';

const MODEL = "claude-sonnet-4-20250514";

function getWebhookUrl(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const path = new URL(request.url).pathname;
  if (!host) {
    return request.url;
  }
  return `${proto}://${host}${path}`;
}

function formDataToRecord(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = typeof value === "string" ? value : String(value);
  });
  return params;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return String(value);
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!authToken || !anthropicKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return NextResponse.json(
      { error: "Expected application/x-www-form-urlencoded" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const params = formDataToRecord(formData);

  const signature = request.headers.get("x-twilio-signature");
  const webhookUrl = getWebhookUrl(request);

  if (!signature) {
    return NextResponse.json(
      { error: "Missing X-Twilio-Signature" },
      { status: 403 },
    );
  }

  if (!twilio.validateRequest(authToken, signature, webhookUrl, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const body = params.Body ?? "";
  const from = params.From ?? "";

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: body }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "Unexpected Claude response shape" },
      { status: 502 },
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseClaudeJsonObject(textBlock.text);
  } catch {
    return NextResponse.json(
      { error: "Could not parse JSON from Claude" },
      { status: 502 },
    );
  }

  const supabase = createSupabaseClient();

  const jobName = toNullableString(parsed.job_name);
  const jobRef = await ensureJobForName(supabase, jobName);
  const jobId = jobRef?.id ?? null;

  const blockersEn = toNullableString(parsed.blockers_en);
  const blockersEs = toNullableString(parsed.blockers_es);
  const hasBlocker = Boolean(
    (blockersEn && blockersEn.trim()) || (blockersEs && blockersEs.trim()),
  );

  const { error: insertError } = await supabase.from("job_updates").insert({
    from_number: from,
    job_id: jobId,
    sender_name: toNullableString(parsed.sender_name),
    job_name: jobName,
    work_completed: toNullableString(parsed.work_completed_en),
    blockers: toNullableString(parsed.blockers_en),
    materials_needed: toNullableString(parsed.materials_needed_en),
    work_completed_en: toNullableString(parsed.work_completed_en),
    work_completed_es: toNullableString(parsed.work_completed_es),
    blockers_en: blockersEn,
    blockers_es: blockersEs,
    materials_needed_en: toNullableString(parsed.materials_needed_en),
    materials_needed_es: toNullableString(parsed.materials_needed_es),
    hours_worked: toNullableNumber(parsed.hours_worked),
    raw_message: toNullableString(parsed.raw_message) ?? body,
  });

  if (insertError) {
    console.error(insertError);
    return NextResponse.json(
      { error: "Failed to save update" },
      { status: 500 },
    );
  }

  if (jobId) {
    const { data: jobRow } = await supabase
      .from("jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobRow?.status !== "complete") {
      const nextStatus = hasBlocker ? "blocked" : "active";
      await supabase.from("jobs").update({ status: nextStatus }).eq("id", jobId);
    }
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    },
  );
}
