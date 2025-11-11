import path from "node:path";
import fs from "fs-extra";
import type { ShareRecord } from "../types";

const SHARE_STORE_PATH = path.resolve(process.cwd(), "data", "share-links.json");

async function ensureShareStore() {
  await fs.ensureDir(path.dirname(SHARE_STORE_PATH));
  await fs.ensureFile(SHARE_STORE_PATH);
  const stats = await fs.stat(SHARE_STORE_PATH);
  if (stats.size === 0) {
    await fs.writeJSON(SHARE_STORE_PATH, []);
  }
}

async function readShareRecords(): Promise<ShareRecord[]> {
  await ensureShareStore();
  return fs.readJSON(SHARE_STORE_PATH);
}

async function writeShareRecords(records: ShareRecord[]) {
  await ensureShareStore();
  await fs.writeJSON(SHARE_STORE_PATH, records, { spaces: 2 });
}

function filterActive(records: ShareRecord[]) {
  const now = Date.now();
  return records.filter((record) => new Date(record.expiresAt).getTime() > now);
}

export async function saveShareRecord(record: ShareRecord) {
  const records = await readShareRecords();
  const activeRecords = filterActive(records).filter((item) => item.token !== record.token);
  activeRecords.push(record);
  await writeShareRecords(activeRecords);
}

export async function getShareRecord(token: string) {
  const records = await readShareRecords();
  const activeRecords = filterActive(records);
  if (activeRecords.length !== records.length) {
    await writeShareRecords(activeRecords);
  }
  return activeRecords.find((record) => record.token === token) ?? null;
}
