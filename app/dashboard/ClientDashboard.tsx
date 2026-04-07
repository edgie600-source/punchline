"use client";

import { useMemo, useState } from "react";

type Language = "en" | "es";

export type JobUpdateRow = {
  id: string;
  created_at: string;
  sender_name: string | null;
  job_name: string | null;
  work_completed_en: string | null;
  work_completed_es: string | null;
  blockers_en: string | null;
  blockers_es: string | null;
  materials_needed_en: string | null;
  materials_needed_es: string | null;
};

export function ClientDashboard(props: {
  rows: JobUpdateRow[];
  errorMessage: string | null;
}) {
  const [lang, setLang] = useState<Language>("en");

  const groups = useMemo(() => groupByJobName(props.rows), [props.rows]);
  const jobCards = useMemo(() => Array.from(groups.entries()), [groups]);

  const t = useMemo(() => getStrings(lang), [lang]);

  return (
    <div className="min-h-full flex flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Punchline</h1>
            <p className="mt-1 text-sm text-slate-700">{t.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {t.language}
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
              <ToggleButton
                active={lang === "en"}
                onClick={() => setLang("en")}
                label="English"
              />
              <ToggleButton
                active={lang === "es"}
                onClick={() => setLang("es")}
                label="Español"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {props.errorMessage ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {props.errorMessage}
          </div>
        ) : jobCards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-slate-700">
            {t.emptyState}{" "}
            <code className="text-slate-900">/api/sms</code>.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobCards.map(([jobName, updates]) => (
              <section
                key={jobName}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-base font-semibold leading-6 text-slate-900">
                    {jobName}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {updates.length} {t.updateLabel(updates.length)}
                  </p>
                </div>

                <ul className="divide-y divide-slate-100">
                  {updates.map((row) => {
                    const work =
                      lang === "es" ? row.work_completed_es : row.work_completed_en;
                    const blockers =
                      lang === "es" ? row.blockers_es : row.blockers_en;
                    const materials =
                      lang === "es"
                        ? row.materials_needed_es
                        : row.materials_needed_en;

                    return (
                      <li key={row.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {row.sender_name?.trim() || t.unknownSender}
                          </p>
                          <time
                            className="text-xs tabular-nums text-slate-700"
                            dateTime={row.created_at}
                          >
                            {formatTimestamp(row.created_at)}
                          </time>
                        </div>

                        {work ? (
                          <p className="mt-2 text-sm leading-relaxed text-slate-900">
                            <span className="font-semibold text-slate-900">
                              {t.completed}
                            </span>{" "}
                            <span className="text-slate-800">{work}</span>
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-700">
                            {t.noWorkDetails}
                          </p>
                        )}

                        {blockers ? (
                          <p className="mt-2 text-sm leading-relaxed text-slate-900">
                            <span className="font-semibold text-slate-900">
                              {t.blockers}
                            </span>{" "}
                            <span className="text-slate-800">{blockers}</span>
                          </p>
                        ) : null}

                        {materials ? (
                          <p className="mt-2 text-sm leading-relaxed text-slate-900">
                            <span className="font-semibold text-slate-900">
                              {t.materials}
                            </span>{" "}
                            <span className="text-slate-800">{materials}</span>
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ToggleButton(props: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "px-3 py-1.5 text-sm font-medium transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        props.active
          ? "rounded-md bg-white text-slate-900 shadow-sm"
          : "rounded-md text-slate-700 hover:text-slate-900",
      ].join(" ")}
      aria-pressed={props.active}
    >
      {props.label}
    </button>
  );
}

function groupByJobName(rows: JobUpdateRow[]): Map<string, JobUpdateRow[]> {
  const map = new Map<string, JobUpdateRow[]>();
  for (const row of rows) {
    const key = row.job_name?.trim() || "Unspecified job";
    const existing = map.get(key);
    if (existing) existing.push(row);
    else map.set(key, [row]);
  }
  return map;
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

function getStrings(lang: Language) {
  if (lang === "es") {
    return {
      language: "Idioma",
      subtitle: "Actualizaciones agrupadas por obra (más recientes primero)",
      emptyState:
        "Todavía no hay actualizaciones. Los SMS aparecerán aquí después de que Twilio envíe a",
      unknownSender: "Remitente desconocido",
      completed: "Completado:",
      blockers: "Bloqueos:",
      materials: "Materiales:",
      noWorkDetails: "No se proporcionaron detalles del trabajo.",
      updateLabel: (n: number) => (n === 1 ? "actualización" : "actualizaciones"),
    };
  }

  return {
    language: "Language",
    subtitle: "Job updates grouped by job (newest first)",
    emptyState:
      "No job updates yet. SMS replies will show up here after Twilio posts to",
    unknownSender: "Unknown sender",
    completed: "Completed:",
    blockers: "Blockers:",
    materials: "Materials:",
    noWorkDetails: "No work details provided.",
    updateLabel: (n: number) => (n === 1 ? "update" : "updates"),
  };
}

