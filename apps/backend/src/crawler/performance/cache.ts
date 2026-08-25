/**
 * Performance Data Cache Layer
 * Provides fast in-memory & optional disk-backed caching for PSI and CrUX responses.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { NormalizedPerformanceResult } from "./provider";

export class PerformanceCache {
  private memoryCache = new Map<string, { result: NormalizedPerformanceResult; expiresAt: number }>();
  private cacheDir: string | undefined;
  private defaultTtlMs: number;

  constructor(options?: { cacheDir?: string; defaultTtlMs?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 24 * 60 * 60 * 1000; // 24 hours default
    if (options?.cacheDir) {
      this.cacheDir = options.cacheDir;
      try {
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
        }
      } catch (err) {
        console.warn("Could not initialize performance disk cache dir:", err);
      }
    }
  }

  private buildKey(url: string, strategy: "mobile" | "desktop", version = "v1"): string {
    const norm = url.trim().toLowerCase();
    const hash = crypto.createHash("sha256").update(`${norm}_${strategy}_${version}`).digest("hex").slice(0, 16);
    return `${strategy}_${hash}`;
  }

  get(url: string, strategy: "mobile" | "desktop"): NormalizedPerformanceResult | undefined {
    const key = this.buildKey(url, strategy);
    const now = Date.now();

    // 1. Check Memory Cache
    const mem = this.memoryCache.get(key);
    if (mem && mem.expiresAt > now) {
      return mem.result;
    }

    // 2. Check Disk Cache
    if (this.cacheDir) {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed.expiresAt && parsed.expiresAt > now) {
            this.memoryCache.set(key, { result: parsed.result, expiresAt: parsed.expiresAt });
            return parsed.result;
          }
        } catch (e) {
          // Ignore corrupt cache entry
        }
      }
    }

    return undefined;
  }

  set(url: string, strategy: "mobile" | "desktop", result: NormalizedPerformanceResult, ttlMs?: number): void {
    const key = this.buildKey(url, strategy);
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = Date.now() + ttl;

    this.memoryCache.set(key, { result, expiresAt });

    if (this.cacheDir) {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      try {
        fs.writeFileSync(filePath, JSON.stringify({ result, expiresAt, url, strategy }, null, 2));
      } catch (e) {
        // Disk write failure shouldn't throw
      }
    }
  }

  clear(): void {
    this.memoryCache.clear();
  }
}
