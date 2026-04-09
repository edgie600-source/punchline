"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  countOpenBlockers,
  formatTimestamp,
  formatTimestampReadable,
  getAvatarGradient,
  getInitials,
  hasBlockerText,
  isBlockerResolved,
  type JobStatus,
} from "@/lib/dashboard-ui";

export type JobDetailUpdateRow = {
  id: string;
  created_at: string;
  sender_name: string | null;
  work_completed_en: string | null;
  work_completed_es: string | null;
  blockers_en: string | null;
  blockers_es: string | null;
  materials_needed_en: string | null;
  materials_needed_es: string | null;
  raw_message: string | null;
  blocker_resolved?: boolean | null;
};

type Language = "en" | "es";

function getStrings(lang: Language) {
  if (lang === "es") {
    return {
      back: "Dashboard",
      insights: "Insights",
      totalUpdates: "Actualizaciones",
      openBlockers: "Bloqueos abiertos",
      lastUpdate: "Última actualización",
      crew: "Equipo",
      noneYet: "Ninguna aún",
      progress: "Progreso",
      blocker: "Bloqueo",
      materials: "Materiales",
      original: "Ver mensaje original",
      unknown: "Desconocido",
      resolve: "Resolver",
      resolving: "…",
    };
  }
  return {
    back: "Dashboard",
    insights: "Insights",
    totalUpdates: "Total updates",
    openBlockers: "Open blockers",
    lastUpdate: "Last update",
    crew: "Crew check-ins",
    noneYet: "None yet",
    progress: "Progress",
    blocker: "Blocker",
    materials: "Materials",
    original: "View original message",
    unknown: "Unknown",
    resolve: "Resolve",
    resolving: "…",
  };
}

function statusLabel(status: JobStatus, lang: Language): string {
  if (lang === "es") {
    if (status === "blocked") return "Bloqueado";
    if (status === "complete") return "Completo";
    return "Activo";
  }
  if (status === "blocked") return "Blocked";
  if (status === "complete") return "Complete";
  return "Active";
}

function statusBadgeStyle(status: JobStatus): CSSProperties {
  if (status === "blocked") {
    return {
      background: "#fff3cd",
      color: "#92400e",
      border: "0.5px solid rgba(245, 158, 11, 0.35)",
    };
  }
  if (status === "complete") {
    return {
      background: "#d1fae5",
      color: "#065f46",
      border: "0.5px solid rgba(16, 185, 129, 0.35)",
    };
  }
  return {
    background: "#e5f2ff",
    color: "#007aff",
    border: "0.5px solid rgba(0, 122, 255, 0.25)",
  };
}

function StatChip({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        flex: "1 1 120px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 500,
          color: valueColor ?? "#1c1c1e",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#8e8e93", lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

function LightningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9.5.5L3.5 9h3l-1 6.5L12.5 7h-3L9.5.5z"
        fill="#f59e0b"
        stroke="#d97706"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClientJobDetail(props: {
  job: { id: string; name: string; status: JobStatus; created_at: string };
  updates: JobDetailUpdateRow[];
  loadError: string | null;
  insightBullets: string[];
  insightError: string | null;
  stats: {
    totalUpdates: number;
    openBlockers: number;
    lastUpdateAt: string | null;
    crewCount: number;
  };
}) {
  const [lang, setLang] = useState<Language>("en");
  const t = useMemo(() => getStrings(lang), [lang]);

  const [updates, setUpdates] = useState(() => props.updates);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    setUpdates(props.updates);
  }, [props.updates]);

  const openBlockers = useMemo(() => countOpenBlockers(updates), [updates]);

  const jobStatus = props.job.status;

  async function resolveBlocker(updateId: string) {
    if (resolvingId) return;
    const snapshot = updates;
    setUpdates((prev) =>
      prev.map((row) =>
        row.id === updateId ? { ...row, blocker_resolved: true } : row,
      ),
    );
    setResolvingId(updateId);
    try {
      const res = await fetch(
        `/api/job-updates/${encodeURIComponent(updateId)}/resolve-blocker`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: props.job.id }),
        },
      );
      if (!res.ok) throw new Error("request failed");
    } catch {
      setUpdates(snapshot);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
        background: "#f2f2f7",
        minHeight: "100vh",
      }}
    >
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
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 15,
            fontWeight: 500,
            color: "#007aff",
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
            ←
          </span>
          {t.back}
        </Link>

        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#1c1c1e",
              letterSpacing: "-0.02em",
              margin: 0,
              lineHeight: 1.25,
              flex: 1,
            }}
          >
            {props.job.name}
          </h1>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 8,
              flexShrink: 0,
              ...statusBadgeStyle(jobStatus),
            }}
          >
            {statusLabel(jobStatus, lang)}
          </span>
        </header>

        {props.loadError ? (
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
            {props.loadError}
          </div>
        ) : (
          <>
            {/* Insights */}
            <section
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "16px 18px",
                marginBottom: 16,
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.06), 0 0.5px 1px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <LightningIcon />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1c1c1e",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t.insights}
                </span>
              </div>
              {props.insightError ? (
                <p style={{ margin: 0, fontSize: 14, color: "#ff3b30" }}>
                  {props.insightError}
                </p>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    color: "#3c3c43",
                    fontSize: 14,
                    lineHeight: 1.55,
                  }}
                >
                  {props.insightBullets.map((b, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Stats */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <StatChip label={t.totalUpdates} value={props.stats.totalUpdates} />
              <StatChip
                label={t.openBlockers}
                value={openBlockers}
                valueColor={openBlockers > 0 ? "#f59e0b" : "#1c1c1e"}
              />
              <StatChip
                label={t.lastUpdate}
                value={
                  props.stats.lastUpdateAt
                    ? formatTimestamp(props.stats.lastUpdateAt)
                    : t.noneYet
                }
              />
              <StatChip label={t.crew} value={props.stats.crewCount} />
            </div>

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
              {lang === "es" ? "Historial" : "Update feed"}
            </p>

            {updates.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "#8e8e93",
                  fontSize: 14,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                {lang === "es"
                  ? "Aún no hay actualizaciones para esta obra."
                  : "No updates for this job yet."}
              </div>
            ) : (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow:
                    "0 1px 3px rgba(0,0,0,0.06), 0 0.5px 1px rgba(0,0,0,0.04)",
                }}
              >
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {updates.map((row, index) => {
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
                    const resolved =
                      hasBlockerText(row.blockers_en, row.blockers_es) &&
                      isBlockerResolved(index, updates);

                    return (
                      <li
                        key={row.id}
                        style={{
                          padding: "14px 16px",
                          borderBottom: "0.5px solid rgba(0,0,0,0.05)",
                        }}
                      >
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
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: getAvatarGradient(row.sender_name),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#fff",
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(row.sender_name)}
                            </div>
                            <span
                              style={{
                                fontSize: 14,
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
                            {formatTimestampReadable(row.created_at)}
                          </time>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {work ? (
                            <FieldRow label={t.progress} value={work} plain />
                          ) : null}
                          {blocker ? (
                            <FieldRow
                              label={t.blocker}
                              value={blocker}
                              blocker
                              resolved={resolved}
                              blockerAction={
                                resolved ? undefined : (
                                  <button
                                    type="button"
                                    disabled={resolvingId !== null}
                                    onClick={() => resolveBlocker(row.id)}
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      fontFamily: "inherit",
                                      padding: "4px 10px",
                                      borderRadius: 7,
                                      border: "0.5px solid rgba(0,122,255,0.35)",
                                      background: "#fff",
                                      color: "#007aff",
                                      cursor:
                                        resolvingId !== null
                                          ? "default"
                                          : "pointer",
                                      opacity: resolvingId !== null ? 0.5 : 1,
                                    }}
                                  >
                                    {resolvingId === row.id
                                      ? t.resolving
                                      : t.resolve}
                                  </button>
                                )
                              }
                            />
                          ) : null}
                          {materials ? (
                            <FieldRow label={t.materials} value={materials} materials />
                          ) : null}
                        </div>

                        <details
                          style={{
                            marginTop: 10,
                            fontSize: 13,
                          }}
                        >
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "#007aff",
                              fontWeight: 500,
                              listStyle: "none",
                            }}
                          >
                            {t.original}
                          </summary>
                          <pre
                            style={{
                              margin: "8px 0 0",
                              padding: "10px 12px",
                              background: "#f2f2f7",
                              borderRadius: 8,
                              fontSize: 12,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              color: "#3c3c43",
                              fontFamily: "inherit",
                              lineHeight: 1.45,
                            }}
                          >
                            {row.raw_message?.trim() || "—"}
                          </pre>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FieldRow({
  label,
  value,
  plain,
  materials,
  blocker,
  resolved,
  blockerAction,
}: {
  label: string;
  value: string;
  plain?: boolean;
  materials?: boolean;
  blocker?: boolean;
  resolved?: boolean;
  blockerAction?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: blocker ? "center" : "baseline",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#8e8e93",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          minWidth: 72,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      {blocker ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: resolved ? "#f2f2f7" : "#fff3cd",
              borderRadius: 7,
              padding: "4px 9px",
              opacity: resolved ? 0.85 : 1,
            }}
          >
            {!resolved ? (
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
            ) : null}
            <span
              style={{
                fontSize: 13,
                color: resolved ? "#8e8e93" : "#92400e",
                lineHeight: 1.4,
                textDecoration: resolved ? "line-through" : undefined,
              }}
            >
              {value}
            </span>
          </div>
          {blockerAction}
        </div>
      ) : (
        <span
          style={{
            fontSize: 13,
            color: plain || materials ? "#1c1c1e" : "#3c3c43",
            lineHeight: 1.5,
            ...(materials
              ? {
                  display: "inline-flex",
                  background: "#f2f2f7",
                  borderRadius: 7,
                  padding: "4px 9px",
                }
              : {}),
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
