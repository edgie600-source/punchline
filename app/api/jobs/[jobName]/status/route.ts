import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { normalizeJobNameKey } from "@/lib/dashboard-ui";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set(["active", "done", "deleted"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ jobName: string }> },
) {
  const { jobName: jobNameParam } = await context.params;

  let decoded: string;
  try {
    decoded = decodeURIComponent(jobNameParam);
  } catch {
    decoded = jobNameParam;
  }

  const jobName = normalizeJobNameKey(decoded);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const status =
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    typeof (body as { status: unknown }).status === "string"
      ? (body as { status: string }).status
      : null;

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "invalid status" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseClient();

  const { error } = await supabase
    .from("job_status")
    .upsert(
      {
        job_name: jobName,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "job_name" },
    );

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

