/**
 * GSC Persistence & Cache Layer
 * Persists raw and aggregated GSC analytics data to prevent repeated API calls.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface GscCacheEntry<T> {
  property: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  fetchedAt: string;
  expiresAt: number;
  data: T;
}

export class GscCache {
  private memoryCache = new Map<string, GscCacheEntry<any>>();
  private cacheDir: string | undefined;
  private defaultTtlMs: number;

  constructor(options?: { cacheDir?: string; defaultTtlMs?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 12 * 60 * 60 * 1000; // 12 hours
    if (options?.cacheDir) {
      this.cacheDir = options.cacheDir;
      try {
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
        }
      } catch (err) {
        console.warn("Could not initialize GSC cache dir:", err);
      }
    }
  }

  private buildKey(property: string, startDate: string, endDate: string, dimensions: string[]): string {
    const rawKey = `${property}_${startDate}_${endDate}_${dimensions.sort().join(",")}`;
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
    return `gsc_${hash}`;
  }

  get<T>(property: string, startDate: string, endDate: string, dimensions: string[]): T | undefined {
    const key = this.buildKey(property, startDate, endDate, dimensions);
    const now = Date.now();

    // Memory cache
    const mem = this.memoryCache.get(key);
    if (mem && mem.expiresAt > now) {
      return mem.data as T;
    }

    // Disk cache
    if (this.cacheDir) {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          const parsed: GscCacheEntry<T> = JSON.parse(raw);
          if (parsed.expiresAt && parsed.expiresAt > now) {
            this.memoryCache.set(key, parsed);
            return parsed.data;
          }
        } catch {
          // Ignore corrupt entry
        }
      }
    }

    return undefined;
  }

  set<T>(property: string, startDate: string, endDate: string, dimensions: string[], data: T, ttlMs?: number): void {
    const key = this.buildKey(property, startDate, endDate, dimensions);
    const ttl = ttlMs ?? this.defaultTtlMs;
    const now = Date.now();
    const entry: GscCacheEntry<T> = {
      property,
      startDate,
      endDate,
      dimensions,
      fetchedAt: new Date(now).toISOString(),
      expiresAt: now + ttl,
      data,
    };

    this.memoryCache.set(key, entry);

    if (this.cacheDir) {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      try {
        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
      } catch {
        // Ignore disk write failure
      }
    }
  }

  clear(): void {
    this.memoryCache.clear();
  }
}
