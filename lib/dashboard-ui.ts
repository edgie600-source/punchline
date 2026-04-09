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
  blockers_en: string | null;
  blockers_es: string | null;
  blocker_resolved?: boolean | null;
};

export type JobStatus = "active" | "blocked" | "complete";

export function hasBlockerText(
  blockersEn: string | null,
  blockersEs: string | null,
): boolean {
  const b = (blockersEn ?? blockersEs ?? "").trim();
  return b.length > 0;
}

/**
 * Newest-first list: resolved if marked in DB, or if a newer row has no blocker text.
 */
export function isBlockerResolved(
  rowIndexInNewestFirst: number,
  updatesNewestFirst: BlockerRowFields[],
): boolean {
  const row = updatesNewestFirst[rowIndexInNewestFirst];
  if (!hasBlockerText(row.blockers_en, row.blockers_es)) return false;
  if (row.blocker_resolved === true) return true;
  for (let i = 0; i < rowIndexInNewestFirst; i++) {
    const newer = updatesNewestFirst[i];
    if (!hasBlockerText(newer.blockers_en, newer.blockers_es)) return true;
  }
  return false;
}

export function countOpenBlockers(
  updatesNewestFirst: BlockerRowFields[],
): number {
  let n = 0;
  for (let i = 0; i < updatesNewestFirst.length; i++) {
    const row = updatesNewestFirst[i];
    if (!hasBlockerText(row.blockers_en, row.blockers_es)) continue;
    if (!isBlockerResolved(i, updatesNewestFirst)) n += 1;
  }
  return n;
}

type JobKeyedRow = BlockerRowFields & {
  job_id?: string | null;
  job_name?: string | null;
  created_at: string;
};

function jobGroupKey(row: JobKeyedRow): string {
  return row.job_id ?? `legacy::${row.job_name?.trim() || ""}`;
}

/** All jobs: sum of open blockers per job (newest-first order within each job). */
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
    const sorted = [...group].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    sum += countOpenBlockers(sorted);
  }
  return sum;
}
