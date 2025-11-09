import path from "node:path";
import fs from "fs-extra";
import type { LighthouseRunRecord } from "../types";

const STORE_PATH = path.resolve(process.cwd(), "data", "lighthouse-runs.json");

async function ensureStore() {
  await fs.ensureDir(path.dirname(STORE_PATH));
  await fs.ensureFile(STORE_PATH);
  const stats = await fs.stat(STORE_PATH);
  if (stats.size === 0) {
    await fs.writeJSON(STORE_PATH, []);
  }
}

export function normalizeAuditUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.searchParams.sort();
  const normalizedPath = url.pathname.endsWith("/") && url.pathname !== "/" ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = normalizedPath || "/";
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export async function readLighthouseRuns(): Promise<LighthouseRunRecord[]> {
  await ensureStore();
  return fs.readJSON(STORE_PATH);
}

export async function writeLighthouseRuns(runs: LighthouseRunRecord[]) {
  await ensureStore();
  await fs.writeJSON(STORE_PATH, runs, { spaces: 2 });
}

export async function saveLighthouseRun(record: LighthouseRunRecord) {
  const runs = await readLighthouseRuns();
  runs.push(record);
  await writeLighthouseRuns(runs);
}

export async function getLighthouseRunById(id: string) {
  const runs = await readLighthouseRuns();
  return runs.find((run) => run.id === id) ?? null;
}

export async function getLatestLighthouseRun() {
  const runs = await readLighthouseRuns();
  return runs.at(-1) ?? null;
}

export async function getLatestLighthouseRunForUrl(rawUrl: string) {
  const normalizedUrl = normalizeAuditUrl(rawUrl);
  const runs = await readLighthouseRuns();
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    if (runs[i].url === normalizedUrl) {
      return runs[i];
    }
  }
  return null;
}

export async function getLighthouseRunsForUrl(rawUrl: string) {
  const normalizedUrl = normalizeAuditUrl(rawUrl);
  const runs = await readLighthouseRuns();
  return runs.filter((run) => run.url === normalizedUrl);
}
