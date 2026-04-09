"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  countOpenBlockers,
  countOpenBlockersAcrossJobs,
  formatTimestamp,
  getAvatarGradient,
  getInitials,
} from "@/lib/dashboard-ui";

type Language = "en" | "es";

export type JobRowRef = { id: string; name: string; status: string };

export type JobUpdateRow = {
  id: string;
  created_at: string;
  sender_name: string | null;
  job_name: string | null;
  job_id: string | null;
  /** Supabase may return a single object or a one-element array for the FK embed. */
  jobs?: JobRowRef | JobRowRef[] | null;
  work_completed_en: string | null;
  work_completed_es: string | null;
  blockers_en: string | null;
  blockers_es: string | null;
  materials_needed_en: string | null;
  materials_needed_es: string | null;
  blocker_resolved?: boolean | null;
};

function groupByJob(rows: JobUpdateRow[]): Map<string, JobUpdateRow[]> {
  const map = new Map<string, JobUpdateRow[]>();
  for (const row of rows) {
    const key =
      row.job_id ??
      `legacy::${row.job_name?.trim() || "Unspecified job"}`;
    const existing = map.get(key);
    if (existing) existing.push(row);
    else map.set(key, [row]);
  }
  return map;
}

function embeddedJob(row: JobUpdateRow | undefined): JobRowRef | null {
  const j = row?.jobs;
  if (!j) return null;
  return Array.isArray(j) ? j[0] ?? null : j;
}

function jobDisplayName(updates: JobUpdateRow[]): string {
  const first = updates[0];
  return (
    embeddedJob(first)?.name ??
    first?.job_name?.trim() ??
    "Unspecified job"
  );
}

function getStrings(lang: Language) {
  if (lang === "es") {
    return {
      activeJobs: "Obras activas",
      openBlockers: "Bloqueos abiertos",
      jobs: "Obras",
      completed: "Hecho",
      blocker: "Bloqueo",
      materials: "Materiales",
      unknown: "Desconocido",
      emptyTitle: "Sin actualizaciones",
      emptyBody: "Las actualizaciones por SMS aparecerán aquí.",
      updateLabel: (n: number) =>
        n === 1 ? "1 actualización" : `${n} actualizaciones`,
      blockerLabel: (n: number) =>
        n === 1 ? "1 bloqueo" : `${n} bloqueos`,
    };
  }
  return {
    activeJobs: "Active jobs",
    openBlockers: "Open blockers",
    jobs: "Jobs",
    completed: "Done",
    blocker: "Blocker",
    materials: "Materials",
    unknown: "Unknown",
    emptyTitle: "No updates yet",
    emptyBody: "SMS field updates will appear here.",
    updateLabel: (n: number) => (n === 1 ? "1 update" : `${n} updates`),
    blockerLabel: (n: number) => (n === 1 ? "1 blocker" : `${n} blockers`),
  };
}

export function ClientDashboard(props: {
  rows: JobUpdateRow[];
  errorMessage: string | null;
}) {
  const [lang, setLang] = useState<Language>("en");
  const t = useMemo(() => getStrings(lang), [lang]);
  const groups = useMemo(() => groupByJob(props.rows), [props.rows]);
  const jobCards = useMemo(() => Array.from(groups.entries()), [groups]);

  const totalOpenBlockers = useMemo(
    () => countOpenBlockersAcrossJobs(props.rows),
    [props.rows],
  );

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
        background: "#f2f2f7",
        minHeight: "100vh",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "0.5px solid rgba(0,0,0,0.1)",
          padding: "0 20px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "#1c1c1e",
            letterSpacing: "-0.01em",
          }}
        >
          Punchline
        </span>

        {/* Language toggle */}
        <div
          style={{
            display: "flex",
            background: "rgba(118,118,128,0.12)",
            borderRadius: 9,
            padding: 2,
            gap: 2,
          }}
        >
          {(["en", "es"] as Language[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              style={{
                fontSize: 13,
                fontWeight: 500,
                padding: "4px 14px",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
                background: lang === l ? "#fff" : "transparent",
                color: lang === l ? "#1c1c1e" : "#3c3c43",
                boxShadow:
                  lang === l
                    ? "0 1px 3px rgba(0,0,0,0.12), 0 0.5px 1px rgba(0,0,0,0.08)"
                    : "none",
              }}
            >
              {l === "en" ? "English" : "Español"}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ padding: "20px 20px 40px", maxWidth: 680, margin: "0 auto" }}>
        {props.errorMessage ? (
          <div
            role="alert"
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "14px 16px",
              color: "#ff3b30",
              fontSize: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            {props.errorMessage}
          </div>
        ) : jobCards.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 24px",
            }}
          >
            <p
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: "#1c1c1e",
                marginBottom: 6,
              }}
            >
              {t.emptyTitle}
            </p>
            <p style={{ fontSize: 14, color: "#8e8e93" }}>{t.emptyBody}</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 24,
              }}
            >
              <StatCard
                value={jobCards.length}
                label={t.activeJobs}
                color="#1c1c1e"
              />
              <StatCard
                value={totalOpenBlockers}
                label={t.openBlockers}
                color={totalOpenBlockers > 0 ? "#f59e0b" : "#1c1c1e"}
              />
            </div>

            {/* Section label */}
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#8e8e93",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                margin: "0 4px 8px",
              }}
            >
              {t.jobs}
            </p>

            {/* Job cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {jobCards.map(([groupKey, updates]) => {
                const openBlockerCount = countOpenBlockers(updates);

                const jobId = updates[0]?.job_id;
                const jobName = jobDisplayName(updates);

                const cardInner = (
                  <section
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      overflow: "hidden",
                      boxShadow:
                        "0 1px 3px rgba(0,0,0,0.06), 0 0.5px 1px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* Job header */}
                    <div
                      style={{
                        padding: "14px 16px 12px",
                        borderBottom: "0.5px solid rgba(0,0,0,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 10 }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "#e5f2ff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <rect
                              x="1"
                              y="10"
                              width="14"
                              height="2"
                              rx="1"
                              fill="#007aff"
                            />
                            <rect
                              x="3"
                              y="6"
                              width="10"
                              height="2"
                              rx="1"
                              fill="#007aff"
                              opacity="0.5"
                            />
                            <rect
                              x="6"
                              y="2"
                              width="4"
                              height="2"
                              rx="1"
                              fill="#007aff"
                              opacity="0.25"
                            />
                          </svg>
                        </div>
                        <div>
                          <h2
                            style={{
                              fontSize: 15,
                              fontWeight: 600,
                              color: "#1c1c1e",
                              letterSpacing: "-0.01em",
                              margin: 0,
                            }}
                          >
                            {jobName}
                          </h2>
                          <p
                            style={{
                              fontSize: 12,
                              color: "#8e8e93",
                              margin: "2px 0 0",
                            }}
                          >
                            {t.updateLabel(updates.length)}
                            {openBlockerCount > 0 && (
                              <span style={{ color: "#f59e0b" }}>
                                {" · "}
                                {t.blockerLabel(openBlockerCount)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {jobId ? (
                        <span
                          style={{
                            color: "#c7c7cc",
                            fontSize: 18,
                            lineHeight: 1,
                          }}
                          aria-hidden
                        >
                          ›
                        </span>
                      ) : null}
                    </div>

                    {/* Updates */}
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {updates.map((row) => {
                        const work =
                          lang === "es"
                            ? row.work_completed_es
                            : row.work_completed_en;
                        const blocker =
                          lang === "es" ? row.blockers_es : row.blockers_en;
                        const materials =
                          lang === "es"
                            ? row.materials_needed_es
                            : row.materials_needed_en;

                        return (
                          <li
                            key={row.id}
                            style={{
                              padding: "12px 16px",
                              borderBottom: "0.5px solid rgba(0,0,0,0.05)",
                            }}
                          >
                            {/* Sender row */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 8,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <div
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: "50%",
                                    background: getAvatarGradient(
                                      row.sender_name,
                                    ),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: "#fff",
                                    flexShrink: 0,
                                  }}
                                >
                                  {getInitials(row.sender_name)}
                                </div>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#1c1c1e",
                                  }}
                                >
                                  {row.sender_name?.trim() || t.unknown}
                                </span>
                              </div>
                              <time
                                dateTime={row.created_at}
                                style={{ fontSize: 11, color: "#8e8e93" }}
                              >
                                {formatTimestamp(row.created_at)}
                              </time>
                            </div>

                            {/* Fields */}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              {work && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "baseline",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#8e8e93",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.04em",
                                      minWidth: 64,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {t.completed}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: "#1c1c1e",
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {work}
                                  </span>
                                </div>
                              )}

                              {blocker && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "baseline",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#8e8e93",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.04em",
                                      minWidth: 64,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {t.blocker}
                                  </span>
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                      background: "#fff3cd",
                                      borderRadius: 7,
                                      padding: "4px 9px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: "50%",
                                        background: "#f59e0b",
                                        flexShrink: 0,
                                        display: "inline-block",
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontSize: 13,
                                        color: "#92400e",
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {blocker}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {materials && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "baseline",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#8e8e93",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.04em",
                                      minWidth: 64,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {t.materials}
                                  </span>
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      background: "#f2f2f7",
                                      borderRadius: 7,
                                      padding: "4px 9px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 13,
                                        color: "#3c3c43",
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {materials}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );

                if (jobId) {
                  return (
                    <Link
                      key={groupKey}
                      href={`/dashboard/jobs/${jobId}`}
                      prefetch
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                        borderRadius: 14,
                      }}
                    >
                      {cardInner}
                    </Link>
                  );
                }

                return (
                  <div key={groupKey} style={{ borderRadius: 14 }}>
                    {cardInner}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 300,
          color,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#8e8e93" }}>{label}</div>
    </div>
  );
}
