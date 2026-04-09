export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #007aff, #5856d6)",
  "linear-gradient(135deg, #34c759, #30b0c7)",
  "linear-gradient(135deg, #ff9500, #ff3b30)",
  "linear-gradient(135deg, #af52de, #ff2d55)",
];

export function getAvatarGradient(name: string | null): string {
  if (!name) return AVATAR_GRADIENTS[0];
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

export function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

export function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function formatTimestampFull(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** e.g. "Mon Apr 7, 2:34 PM" in the browser's local timezone */
export function formatTimestampReadable(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export type BlockerRowFields = {
  blockers?: string | null;
  blockers_en?: string | null;
  blockers_es?: string | null;
  blocker_resolved?: boolean | null;
};

export type JobStatus = "active" | "blocked" | "complete";

/** Stable string for grouping, URLs, and Supabase filters (except null bucket). */
export function normalizeJobNameKey(name: string | null | undefined): string {
  const t = name?.trim();
  return t && t.length > 0 ? t : "Unspecified job";
}

export function rowHasBlockerContent(row: BlockerRowFields): boolean {
  return Boolean(
    row.blockers?.trim() ||
      row.blockers_en?.trim() ||
      row.blockers_es?.trim(),
  );
}

export function hasBlockerText(
  blockersEn: string | null,
  blockersEs: string | null,
  blockers?: string | null,
): boolean {
  return rowHasBlockerContent({
    blockers_en: blockersEn,
    blockers_es: blockersEs,
    blockers,
  });
}

/**
 * Newest-first list: resolved if marked in DB, or if a newer row has no blocker text.
 * (Display only; stats use countOpenBlockers.)
 */
export function isBlockerResolved(
  rowIndexInNewestFirst: number,
  updatesNewestFirst: BlockerRowFields[],
): boolean {
  const row = updatesNewestFirst[rowIndexInNewestFirst];
  if (!rowHasBlockerContent(row)) return false;
  if (row.blocker_resolved === true) return true;
  for (let i = 0; i < rowIndexInNewestFirst; i++) {
    const newer = updatesNewestFirst[i];
    if (!rowHasBlockerContent(newer)) return true;
  }
  return false;
}

/** Open blockers for stats: has blocker text and not explicitly resolved. */
export function countOpenBlockers(rows: BlockerRowFields[]): number {
  return rows.filter(
    (r) => rowHasBlockerContent(r) && r.blocker_resolved !== true,
  ).length;
}

type JobKeyedRow = BlockerRowFields & {
  job_name?: string | null;
  created_at: string;
};

function jobGroupKey(row: JobKeyedRow): string {
  return normalizeJobNameKey(row.job_name);
}

/** All jobs: sum of open blocker counts per job_name. */
export function countOpenBlockersAcrossJobs(rows: JobKeyedRow[]): number {
  const byJob = new Map<string, JobKeyedRow[]>();
  for (const r of rows) {
    const key = jobGroupKey(r);
    const g = byJob.get(key);
    if (g) g.push(r);
    else byJob.set(key, [r]);
  }
  let sum = 0;
  for (const group of byJob.values()) {
    sum += countOpenBlockers(group);
  }
  return sum;
}
