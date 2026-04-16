import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase";
import {
  countOpenBlockers,
  normalizeJobNameKey,
} from "@/lib/dashboard-ui";
import { generateJobInsights } from "@/lib/job-insights";
import { ClientJobDetail, type JobDetailUpdateRow } from "./ClientJobDetail";

export const dynamic = "force-dynamic";

const JOB_UPDATE_COLS =
  "id, created_at, from_number, sender_name, job_name, work_completed_en, work_completed_es, blockers, blockers_en, blockers_es, materials_needed_en, materials_needed_es, raw_message, blocker_resolved";

async function fetchUpdatesForJobName(
  supabase: SupabaseClient,
  jobNameKey: string,
): Promise<{
  data: Record<string, unknown>[];
  error: { message: string } | null;
}> {
  if (jobNameKey !== "Unspecified job") {
    const { data, error } = await supabase
      .from("job_updates")
      .select(JOB_UPDATE_COLS)
      .eq("job_name", jobNameKey)
      .order("created_at", { ascending: false });
    return { data: (data ?? []) as Record<string, unknown>[], error };
  }

  const [rNull, rLiteral] = await Promise.all([
    supabase
      .from("job_updates")
      .select(JOB_UPDATE_COLS)
      .is("job_name", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("job_updates")
      .select(JOB_UPDATE_COLS)
      .eq("job_name", "Unspecified job")
      .order("created_at", { ascending: false }),
  ]);

  const err = rNull.error ?? rLiteral.error;
  if (err) {
    return { data: [], error: err };
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const r of [...(rNull.data ?? []), ...(rLiteral.data ?? [])]) {
    const id = (r as { id: string }).id;
    byId.set(id, r as Record<string, unknown>);
  }
  const merged = Array.from(byId.values()).sort(
    (a, b) =>
      new Date(String(b.created_at)).getTime() -
      new Date(String(a.created_at)).getTime(),
  );
  return { data: merged, error: null };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobName: string }>;
}) {
  const { jobName: jobNameParam } = await params;

  let jobNameKey: string;
  try {
    jobNameKey = normalizeJobNameKey(decodeURIComponent(jobNameParam));
  } catch {
    jobNameKey = normalizeJobNameKey(jobNameParam);
  }

  const supabase = createSupabaseClient();

  const { data: rawRows, error: upError } = await fetchUpdatesForJobName(
    supabase,
    jobNameKey,
  );

  if (upError) {
    return (
      <ClientJobDetail
        jobName={jobNameKey}
        updates={[]}
        loadError={upError.message}
        insightBullets_en={[]}
        insightBullets_es={[]}
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

  const updates = rawRows as unknown as JobDetailUpdateRow[];

  const { bullets_en, bullets_es, error: insightError } =
    await generateJobInsights(updates);

  const crewCount = new Set(
    updates.map((u) => u.from_number?.trim()).filter(Boolean),
  ).size;

  return (
    <ClientJobDetail
      jobName={jobNameKey}
      updates={updates}
      loadError={null}
      insightBullets_en={bullets_en}
      insightBullets_es={bullets_es}
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
