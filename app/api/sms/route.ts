import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { parseClaudeJsonObject } from "@/lib/parse-claude-json";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are parsing field updates from construction crew members. Extract the following from their text message and return ONLY a JSON object with these fields: job_name (string), work_completed (string), blockers (string or null), materials_needed (string or null), hours_worked (number or null), raw_message (string). If a field cannot be determined, set it to null.";

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

  const { error: insertError } = await supabase.from("job_updates").insert({
    from_number: from,
    job_name: toNullableString(parsed.job_name),
    work_completed: toNullableString(parsed.work_completed),
    blockers: toNullableString(parsed.blockers),
    materials_needed: toNullableString(parsed.materials_needed),
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

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    },
  );
}
