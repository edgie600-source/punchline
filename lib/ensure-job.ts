import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureJobForName(
  supabase: SupabaseClient,
  jobName: string | null,
): Promise<{ id: string } | null> {
  const name = (jobName?.trim() || "Unspecified job").slice(0, 500);
  const { data: found, error: selErr } = await supabase
    .from("jobs")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (selErr) {
    console.error(selErr);
    return null;
  }
  if (found?.id) return { id: found.id };

  const { data: inserted, error: insErr } = await supabase
    .from("jobs")
    .insert({ name, status: "active" })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    console.error(insErr);
    return null;
  }
  return { id: inserted.id };
}
