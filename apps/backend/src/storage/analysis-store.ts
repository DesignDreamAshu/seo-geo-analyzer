import path from "node:path";
import fs from "fs-extra";
import { normalizeAuditUrl } from "./lighthouse-store";
import type { AnalysisHistorySnapshot, AnalysisRecord } from "../analysis/types";

const STORE_PATH = path.resolve(process.cwd(), "data", "analysis-runs.json");

async function ensureStore() {
  await fs.ensureDir(path.dirname(STORE_PATH));
  await fs.ensureFile(STORE_PATH);
  const stats = await fs.stat(STORE_PATH);
  if (stats.size === 0) {
    await fs.writeJSON(STORE_PATH, []);
  }
}

export async function readAnalysisRuns(): Promise<AnalysisRecord[]> {
  await ensureStore();
  return fs.readJSON(STORE_PATH);
}

async function writeAnalysisRuns(runs: AnalysisRecord[]) {
  await ensureStore();
  await fs.writeJSON(STORE_PATH, runs, { spaces: 2 });
}

export async function saveAnalysisRun(record: AnalysisRecord) {
  const runs = await readAnalysisRuns();
  runs.push(record);
  await writeAnalysisRuns(runs);
}

export async function getAnalysisSnapshotsForUrl(
  rawUrl: string,
  limit = 10,
): Promise<AnalysisHistorySnapshot[]> {
  const normalizedUrl = normalizeAuditUrl(rawUrl);
  const runs = await readAnalysisRuns();
  const filtered = runs.filter((run) => run.normalizedUrl === normalizedUrl);
  if (!filtered.length) {
    return [];
  }

  const recent = filtered.slice(Math.max(filtered.length - limit, 0));
  return recent.map((run) => ({
    timestamp: run.createdAt,
    overallScore: run.overall,
  }));
}

export async function getLatestAnalysisForUrl(rawUrl: string): Promise<AnalysisRecord | null> {
  const normalizedUrl = normalizeAuditUrl(rawUrl);
  const runs = await readAnalysisRuns();
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    if (runs[i].normalizedUrl === normalizedUrl) {
      return runs[i];
    }
  }
  return null;
}
