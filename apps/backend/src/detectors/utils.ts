import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
import { DetectorIssue, IssueBuckets, IssueSeverity } from "./types";

export const HASH_BITS = 64;

export function createIssueBuckets(): IssueBuckets {
  return {
    critical: [],
    warnings: [],
    improvements: [],
  };
}

export function pushIssue(buckets: IssueBuckets, severity: IssueSeverity, issue: DetectorIssue) {
  buckets[severity].push(issue);
}

export async function fetchDocument(targetUrl: string) {
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": "DreamSEO-AuditBot/1.0 (+https://dreamseo.dev)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download HTML (${response.status})`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);
  return { document, html };
}

export function absoluteUrl(rawHref: string | null | undefined, base: URL): string | null {
  if (!rawHref) {
    return null;
  }

  try {
    return new URL(rawHref, base).toString();
  } catch {
    return null;
  }
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\s]+/g, " ")
    .match(/\b[a-z0-9][a-z0-9_-]{1,}\b/g) ?? [];
}

export function extractJsonLdPayloads(document: Document): unknown[] {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const payloads: unknown[] = [];

  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (!text) continue;

    try {
      payloads.push(JSON.parse(text));
    } catch {
      // Attempt to parse arrays separated by newlines
      try {
        const normalized = text
          .replace(/}\s*{/g, "},{")
          .replace(/]\s*\[/g, "],[")
          .replace(/}\s*]/g, "}]")
          .replace(/\[\s*{/g, "[{");
        payloads.push(JSON.parse(normalized));
      } catch {
        // ignore malformed entry
      }
    }
  }

  return payloads;
}

type JsonValue = Record<string, unknown> | JsonValue[] | string | number | null | boolean;

function collectJsonObjects(value: JsonValue, collection: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonObjects(entry as JsonValue, collection));
    return;
  }

  if (value && typeof value === "object") {
    collection.push(value as Record<string, unknown>);
    Object.values(value).forEach((child) => collectJsonObjects(child as JsonValue, collection));
  }
}

export function collectJsonLdByType(payloads: unknown[], predicate: (types: string[]) => boolean) {
  const matches: Record<string, unknown>[] = [];
  payloads.forEach((payload) => {
    const objects: Record<string, unknown>[] = [];
    collectJsonObjects(payload as JsonValue, objects);
    objects.forEach((obj) => {
      const rawType = obj["@type"];
      if (!rawType) return;
      const types = Array.isArray(rawType) ? rawType : [rawType];
      const normalized = types
        .map((type) => String(type).toLowerCase())
        .filter(Boolean);
      if (normalized.length && predicate(normalized)) {
        matches.push(obj);
      }
    });
  });
  return matches;
}

export function computeSimHash(text: string): bigint {
  const tokens = tokenize(text);
  if (!tokens.length) {
    return 0n;
  }

  const vector = Array.from({ length: HASH_BITS }, () => 0);

  tokens.forEach((token) => {
    const digest = createHash("sha1").update(token).digest();
    for (let bitIndex = 0; bitIndex < HASH_BITS; bitIndex += 1) {
      const byteIndex = Math.floor(bitIndex / 8);
      const innerIndex = 7 - (bitIndex % 8);
      const bit = (digest[byteIndex] >> innerIndex) & 1;
      vector[bitIndex] += bit === 1 ? 1 : -1;
    }
  });

  return vector.reduce((acc, value, index) => {
    if (value >= 0) {
      return acc | (1n << BigInt(HASH_BITS - index - 1));
    }
    return acc;
  }, 0n);
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let distance = 0;
  while (xor) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

export function simHashSimilarity(a: bigint, b: bigint): number {
  if (a === 0n && b === 0n) {
    return 1;
  }
  const dist = hammingDistance(a, b);
  return 1 - dist / HASH_BITS;
}
