/**
 * Safe Bounded Probes Engine (SECURITY S1).
 * Executes strictly bounded, rate-limited GET probes against predefined candidate files
 * with soft-404 baseline validation and secret-redacted evidence capture.
 */

import axios from "axios";
import * as crypto from "node:crypto";
import type { SafeProbeResultFact, SafeProbeTargetType } from "../types";
import { redactEnvSnippet, sanitizeEvidenceString } from "../redaction";

const DEFAULT_USER_AGENT = "DreamSEO-SecurityAuditBot/1.0 (+https://dreamseo.dev)";
const MAX_PROBE_BODY_CAPTURE_BYTES = 16 * 1024; // 16 KB max

interface ProbeDescriptor {
  path: string;
  targetType: SafeProbeTargetType;
  expectedContentType?: RegExp;
  signatureValidator: (data: string | Buffer) => { matched: boolean; signatureType?: string };
}

const PREDEFINED_PROBES: ProbeDescriptor[] = [
  {
    path: "/.env",
    targetType: "ENV_FILE",
    expectedContentType: /(text\/plain|application\/octet-stream|text\/)/i,
    signatureValidator: (data) => {
      const text = typeof data === "string" ? data : data.toString("utf-8");
      // Check for common env file key patterns at start of line
      const matchesEnvKey = /(^|\n)[A-Za-z0-9_]{2,40}\s*=\s*[^\s]/m.test(text);
      const containsEnvTokens =
        text.includes("APP_KEY") ||
        text.includes("DB_PASSWORD") ||
        text.includes("DATABASE_URL") ||
        text.includes("SECRET_KEY") ||
        text.includes("PORT=");
      return {
        matched: matchesEnvKey || containsEnvTokens,
        signatureType: matchesEnvKey ? "ENV_KEY_VALUE_PAIR" : "ENV_TOKENS",
      };
    },
  },
  {
    path: "/.git/HEAD",
    targetType: "GIT_HEAD",
    expectedContentType: /(text\/plain|application\/octet-stream|text\/)/i,
    signatureValidator: (data) => {
      const text = typeof data === "string" ? data : data.toString("utf-8");
      const matched = text.trim().startsWith("ref: refs/heads/") || /^[0-9a-f]{40}\b/i.test(text.trim());
      return {
        matched,
        signatureType: matched ? "GIT_HEAD_REF" : undefined,
      };
    },
  },
  {
    path: "/.git/config",
    targetType: "BACKUP_CONFIG",
    expectedContentType: /(text\/plain|application\/octet-stream|text\/)/i,
    signatureValidator: (data) => {
      const text = typeof data === "string" ? data : data.toString("utf-8");
      const matched = text.includes("[core]") || text.includes('[remote "origin"]');
      return {
        matched,
        signatureType: matched ? "GIT_CONFIG_SECTION" : undefined,
      };
    },
  },
  {
    path: "/.DS_Store",
    targetType: "DS_STORE",
    signatureValidator: (data) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      // Apple Desktop Services Store binary header: 0x00000001 followed by 'Bud1' or 'Bud2'
      const isDsStoreHeader =
        buf.length >= 8 &&
        buf[0] === 0x00 &&
        buf[1] === 0x00 &&
        buf[2] === 0x00 &&
        buf[3] === 0x01 &&
        buf.subarray(4, 8).toString("ascii") === "Bud1";
      return {
        matched: isDsStoreHeader,
        signatureType: isDsStoreHeader ? "APPLE_DS_STORE_HEADER" : undefined,
      };
    },
  },
];

function computeSha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Checks if a response appears to be an HTML catch-all/soft-404 page rather than an actual exposed file.
 */
function isSoft404Response(
  status: number,
  contentType: string | null,
  bodyText: string,
  sentinelFingerprint: string | null
): boolean {
  if (status !== 200) {
    return false;
  }
  const ct = (contentType || "").toLowerCase();
  // If expecting a raw config/binary but server returns rich HTML document, it is almost certainly a SPA / custom 404
  if (ct.includes("text/html")) {
    const lowerBody = bodyText.toLowerCase();
    if (
      lowerBody.includes("<!doctype html") ||
      lowerBody.includes("<html") ||
      lowerBody.includes("page not found") ||
      lowerBody.includes("404 not found") ||
      lowerBody.includes("cannot get")
    ) {
      return true;
    }
  }

  if (sentinelFingerprint && computeSha256(bodyText) === sentinelFingerprint) {
    return true;
  }

  return false;
}

/**
 * Executes safe, bounded probes against the origin domain.
 */
export async function executeSafeProbes(
  originUrl: string,
  timeoutMs = 4000
): Promise<SafeProbeResultFact[]> {
  const results: SafeProbeResultFact[] = [];

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originUrl);
  } catch {
    return results;
  }

  const baseOrigin = parsedOrigin.origin;
  const checkedAt = new Date().toISOString();

  // 1. Establish Soft-404 Sentinel Baseline
  let sentinelFingerprint: string | null = null;
  try {
    const sentinelUrl = `${baseOrigin}/_dreamseo_sentinel_random_probe_${Date.now()}`;
    const sentinelRes = await axios.get(sentinelUrl, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      timeout: timeoutMs,
      maxRedirects: 3,
      responseType: "text",
      validateStatus: () => true,
    });
    if (sentinelRes.status === 200 && typeof sentinelRes.data === "string") {
      sentinelFingerprint = computeSha256(sentinelRes.data);
    }
  } catch {
    // Sentinel check failed; proceed with heuristic soft-404 checking
  }

  // 2. Execute Predefined Bounded Probes sequentially (or limited concurrency)
  for (const descriptor of PREDEFINED_PROBES) {
    const targetUrl = `${baseOrigin}${descriptor.path}`;

    try {
      const response = await axios.get(targetUrl, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        timeout: timeoutMs,
        maxRedirects: 3,
        maxContentLength: MAX_PROBE_BODY_CAPTURE_BYTES,
        responseType: descriptor.targetType === "DS_STORE" ? "arraybuffer" : "text",
        validateStatus: () => true,
      });

      const httpStatus = response.status;
      const contentType = String(response.headers["content-type"] || "");
      const rawData = response.data;
      const byteLength = Buffer.isBuffer(rawData)
        ? rawData.length
        : typeof rawData === "string"
        ? Buffer.byteLength(rawData, "utf8")
        : 0;

      const bodyText = typeof rawData === "string" ? rawData : Buffer.from(rawData || "").toString("utf-8");
      const sha256 = computeSha256(Buffer.isBuffer(rawData) ? rawData : bodyText);

      const soft404 = isSoft404Response(httpStatus, contentType, bodyText, sentinelFingerprint);
      const sigResult = httpStatus === 200 && !soft404 ? descriptor.signatureValidator(rawData) : { matched: false };

      const isConfirmedExposed = httpStatus === 200 && !soft404 && sigResult.matched;

      let redactedSnippet = "";
      if (isConfirmedExposed) {
        if (descriptor.targetType === "ENV_FILE") {
          redactedSnippet = redactEnvSnippet(bodyText, 160);
        } else {
          redactedSnippet = sanitizeEvidenceString(bodyText.slice(0, 160), 160);
        }
      }

      results.push({
        targetType: descriptor.targetType,
        requestedUrl: targetUrl,
        path: descriptor.path,
        httpStatus,
        contentType: contentType || null,
        byteLength,
        isSoft404: soft404,
        signatureMatched: sigResult.matched,
        signatureType: sigResult.signatureType,
        isConfirmedExposed,
        responseFingerprintSha256: sha256,
        redactedEvidenceSnippet: redactedSnippet,
        checkedAt,
      });
    } catch (err: any) {
      results.push({
        targetType: descriptor.targetType,
        requestedUrl: targetUrl,
        path: descriptor.path,
        httpStatus: 0,
        contentType: null,
        byteLength: 0,
        isSoft404: false,
        signatureMatched: false,
        isConfirmedExposed: false,
        responseFingerprintSha256: "",
        redactedEvidenceSnippet: `Probe fetch error: ${err.message}`,
        checkedAt,
      });
    }
  }

  return results;
}
