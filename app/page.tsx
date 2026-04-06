import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type JobUpdateRow = {
  id: string;
  created_at: string;
  job_name: string | null;
  work_completed: string | null;
  blockers: string | null;
};

export default async function Home() {
  let rows: JobUpdateRow[] = [];
  let errorMessage: string | null = null;

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("job_updates")
      .select("id, created_at, job_name, work_completed, blockers")
      .order("created_at", { ascending: false });

    if (error) {
      errorMessage = error.message;
    } else {
      rows = (data ?? []) as JobUpdateRow[];
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Could not load updates";
  }

  return (
    <div className="min-h-full flex flex-col bg-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Punchline
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Field updates from the crew (newest first)
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {errorMessage ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-zinc-500">
            No job updates yet. SMS replies will show up here after Twilio
            posts to <code className="text-zinc-700">/api/sms</code>.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {row.job_name?.trim() || "—"}
                  </h2>
                  <time
                    className="text-sm tabular-nums text-zinc-500"
                    dateTime={row.created_at}
                  >
                    {formatTimestamp(row.created_at)}
                  </time>
                </div>
                {row.work_completed ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-700">
                    <span className="font-medium text-zinc-800">Done: </span>
                    {row.work_completed}
                  </p>
                ) : null}
                {row.blockers ? (
                  <p className="mt-2 text-sm leading-relaxed text-amber-900">
                    <span className="font-medium text-amber-950">
                      Blockers:{" "}
                    </span>
                    {row.blockers}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
