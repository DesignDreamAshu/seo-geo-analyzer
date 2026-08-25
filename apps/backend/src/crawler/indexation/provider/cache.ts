/**
 * Project-Isolated URL Inspection Record Cache.
 * Guarantees strict project boundary isolation and enforces TTL invalidation.
 */

import { IndexationEvidenceRecord } from "../types";

export class InspectionRecordCache {
  private static store = new Map<string, { record: IndexationEvidenceRecord; cachedAt: number }>();

  private static buildKey(projectId: string, normalizedUrl: string): string {
    return `${projectId.trim().toLowerCase()}::${normalizedUrl.trim().toLowerCase()}`;
  }

  public static get(projectId: string, normalizedUrl: string, ttlHours: number = 168): IndexationEvidenceRecord | null {
    const key = this.buildKey(projectId, normalizedUrl);
    const entry = this.store.get(key);
    if (!entry) return null;

    const ageMs = Date.now() - entry.cachedAt;
    const maxAgeMs = ttlHours * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      this.store.delete(key);
      return null;
    }

    return entry.record;
  }

  public static set(projectId: string, record: IndexationEvidenceRecord): void {
    const key = this.buildKey(projectId, record.normalizedUrl);
    this.store.set(key, { record, cachedAt: Date.now() });
  }

  public static clearProject(projectId: string): void {
    const prefix = `${projectId.trim().toLowerCase()}::`;
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }

  public static clearAll(): void {
    this.store.clear();
  }
}
