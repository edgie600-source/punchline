import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { hasBlockerText, normalizeJobNameKey } from "@/lib/dashboard-ui";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const jobNameRaw =
    typeof body === "object" &&
    body !== null &&
    "jobName" in body &&
    typeof (body as { jobName: unknown }).jobName === "string"
      ? (body as { jobName: string }).jobName
      : null;

  if (!jobNameRaw) {
    return NextResponse.json({ error: "jobName is required" }, { status: 400 });
  }

  const jobNameKey = normalizeJobNameKey(jobNameRaw);

  const supabase = createSupabaseClient();

  const { data: row, error: fetchError } = await supabase
    .from("job_updates")
    .select("id, job_name, blockers, blockers_en, blockers_es, blocker_resolved")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  const rowJobKey = normalizeJobNameKey(
    (row as { job_name: string | null }).job_name,
  );
  if (rowJobKey !== jobNameKey) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  const r = row as {
    blockers: string | null;
    blockers_en: string | null;
    blockers_es: string | null;
  };
  if (!hasBlockerText(r.blockers_en, r.blockers_es, r.blockers)) {
    return NextResponse.json(
      { error: "No blocker on this update" },
      { status: 400 },
    );
  }

  if ((row as { blocker_resolved?: boolean }).blocker_resolved === true) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await supabase
    .from("job_updates")
    .update({ blocker_resolved: true })
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
