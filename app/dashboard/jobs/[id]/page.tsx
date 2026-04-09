import { notFound } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import {
  countOpenBlockers,
  type JobStatus,
} from "@/lib/dashboard-ui";
import { generateJobInsights } from "@/lib/job-insights";
import { ClientJobDetail, type JobDetailUpdateRow } from "./ClientJobDetail";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JobRow = {
  id: string;
  name: string;
  status: JobStatus;
  created_at: string;
};

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = createSupabaseClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, name, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (jobError || !job) {
    notFound();
  }

  const j = job as {
    id: string;
    name: string;
    created_at: string;
    status: string;
  };
  const rawStatus = String(j.status);
  const status: JobStatus =
    rawStatus === "blocked" || rawStatus === "complete" || rawStatus === "active"
      ? rawStatus
      : "active";

  const jobRow: JobRow = {
    id: j.id,
    name: j.name,
    created_at: j.created_at,
    status,
  };

  const { data: rawUpdates, error: upError } = await supabase
    .from("job_updates")
    .select(
      "id, created_at, sender_name, work_completed_en, work_completed_es, blockers_en, blockers_es, materials_needed_en, materials_needed_es, raw_message, blocker_resolved",
    )
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  if (upError) {
    return (
      <ClientJobDetail
        job={jobRow}
        updates={[]}
        loadError={upError.message}
        insightBullets={[]}
        insightError={null}
        stats={{
          totalUpdates: 0,
          openBlockers: 0,
          lastUpdateAt: null,
          crewCount: 0,
        }}
      />
    );
  }

  const updates = (rawUpdates ?? []) as JobDetailUpdateRow[];

  const { bullets, error: insightError } = await generateJobInsights(updates);

  const crewCount = new Set(
    updates.map((u) => u.sender_name?.trim()).filter(Boolean),
  ).size;

  return (
    <ClientJobDetail
      job={jobRow}
      updates={updates}
      loadError={null}
      insightBullets={bullets}
      insightError={insightError}
      stats={{
        totalUpdates: updates.length,
        openBlockers: countOpenBlockers(updates),
        lastUpdateAt: updates[0]?.created_at ?? null,
        crewCount,
      }}
    />
  );
}
