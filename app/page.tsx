import { createSupabaseClient } from "@/lib/supabase";
import { ClientDashboard, type JobUpdateRow } from "@/app/dashboard/ClientDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let rows: JobUpdateRow[] = [];
  let errorMessage: string | null = null;

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("job_updates")
      .select(
        "id, created_at, sender_name, job_name, work_completed_en, work_completed_es, blockers_en, blockers_es, materials_needed_en, materials_needed_es",
      )
      .order("created_at", { ascending: false });

    if (error) {
      errorMessage = error.message;
    } else {
      rows = (data ?? []) as JobUpdateRow[];
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Could not load updates";
  }

  return <ClientDashboard rows={rows} errorMessage={errorMessage} />;
}
