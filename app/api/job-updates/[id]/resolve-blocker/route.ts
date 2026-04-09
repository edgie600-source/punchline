import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { hasBlockerText } from "@/lib/dashboard-ui";

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
  const jobId =
    typeof body === "object" &&
    body !== null &&
    "jobId" in body &&
    typeof (body as { jobId: unknown }).jobId === "string"
      ? (body as { jobId: string }).jobId
      : null;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const supabase = createSupabaseClient();

  const { data: row, error: fetchError } = await supabase
    .from("job_updates")
    .select("id, job_id, blockers_en, blockers_es, blocker_resolved")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  if (row.job_id !== jobId) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  if (
    !hasBlockerText(
      row.blockers_en as string | null,
      row.blockers_es as string | null,
    )
  ) {
    return NextResponse.json({ error: "No blocker on this update" }, { status: 400 });
  }

  if (row.blocker_resolved === true) {
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
