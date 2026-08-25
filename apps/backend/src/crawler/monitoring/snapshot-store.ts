/**
 * Immutable Crawl Snapshot Store.
 * Guarantees that certified historical snapshots cannot be mutated.
 */

import { CrawlSnapshot } from "./types";

export class ImmutableSnapshotError extends Error {
  constructor(snapshotId: string) {
    super(`Cannot modify finalized immutable snapshot: '${snapshotId}'. Create a new derived snapshot instead.`);
    this.name = "ImmutableSnapshotError";
  }
}

export class SnapshotStore {
  private snapshots = new Map<string, Readonly<CrawlSnapshot>>();

  public saveSnapshot(snapshot: CrawlSnapshot): Readonly<CrawlSnapshot> {
    if (this.snapshots.has(snapshot.snapshotId)) {
      const existing = this.snapshots.get(snapshot.snapshotId)!;
      if (existing.isFinalized) {
        throw new ImmutableSnapshotError(snapshot.snapshotId);
      }
    }

    const immutableSnapshot = deepFreeze({
      ...snapshot,
      isFinalized: true,
    });

    this.snapshots.set(snapshot.snapshotId, immutableSnapshot);
    return immutableSnapshot;
  }

  public getSnapshot(snapshotId: string): Readonly<CrawlSnapshot> | undefined {
    return this.snapshots.get(snapshotId);
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshots.has(snapshotId);
  }
}

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  Object.freeze(obj);

  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }

  return obj as Readonly<T>;
}
