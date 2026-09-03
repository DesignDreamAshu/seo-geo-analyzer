/**
 * Deterministic Finding Fingerprinting & Identity (SECURITY S2).
 * Ensures finding IDs are stable across crawls when the underlying root problem is identical.
 */

import * as crypto from "node:crypto";

export function generateFindingId(
  ruleId: string,
  scope: string,
  scopeKey: string,
  extraQualifier?: string
): string {
  const cleanRule = ruleId.trim().toUpperCase();
  const cleanScope = scope.trim().toLowerCase();
  const cleanKey = scopeKey.trim().toLowerCase();
  const cleanQualifier = extraQualifier ? `:${extraQualifier.trim().toLowerCase()}` : "";

  return `security:${cleanRule}:${cleanScope}:${cleanKey}${cleanQualifier}`;
}

export function computePolicyFingerprint(data: unknown): string {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}
