import { createSupabaseClient } from "@/lib/supabase";
import { normalizeJobNameKey } from "@/lib/dashboard-ui";
import {
  ClientDashboard,
  type JobUpdateRow,
} from "@/app/dashboard/ClientDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let rows: JobUpdateRow[] = [];
  let jobStatuses: Record<string, string> = {};
  let errorMessage: string | null = null;

  try {
    const supabase = createSupabaseClient();
    const [updatesRes, statusRes] = await Promise.all([
      supabase
        .from("job_updates")
        .select(
          "id, created_at, sender_name, job_name, blockers, work_completed_en, work_completed_es, blockers_en, blockers_es, materials_needed_en, materials_needed_es, blocker_resolved",
        )
        .order("created_at", { ascending: false }),
      supabase.from("job_status").select("job_name, status"),
    ]);

    if (updatesRes.error) {
      errorMessage = updatesRes.error.message;
    } else {
      rows = (updatesRes.data ?? []) as unknown as JobUpdateRow[];
    }

    if (statusRes.error) {
      if (!errorMessage) errorMessage = statusRes.error.message;
    } else {
      const map: Record<string, string> = {};
      for (const r of (statusRes.data ?? []) as unknown as Array<{
        job_name: string | null;
        status: string | null;
      }>) {
        const key = normalizeJobNameKey(r.job_name);
        if (key) map[key] = r.status ?? "active";
      }
      jobStatuses = map;
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Could not load updates";
  }

  return (
    <ClientDashboard
      rows={rows}
      errorMessage={errorMessage}
      jobStatuses={jobStatuses}
    />
  );
}
