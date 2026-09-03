/**
 * Strict-Transport-Security (HSTS) Fact Parser (SECURITY S1).
 * Extracts authoritative facts for HSTS configuration without deciding pass/fail score.
 */

import type { HstsHeaderFact } from "../types";

export function parseHstsHeader(rawHeader: string | null | undefined): HstsHeaderFact | null {
  if (!rawHeader || typeof rawHeader !== "string") {
    return null;
  }

  const trimmed = rawHeader.trim();
  if (!trimmed) {
    return null;
  }

  const parseErrors: string[] = [];
  const parts = trimmed.split(";").map((p) => p.trim()).filter(Boolean);

  let maxAgeSeconds: number | null = null;
  let includeSubDomains = false;
  let preload = false;

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx !== -1) {
      const directiveName = part.slice(0, eqIdx).trim().toLowerCase();
      const directiveVal = part.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");

      if (directiveName === "max-age") {
        const parsedNum = parseInt(directiveVal, 10);
        if (isNaN(parsedNum) || parsedNum < 0) {
          parseErrors.push(`Invalid max-age value: "${directiveVal}"`);
        } else {
          maxAgeSeconds = parsedNum;
        }
      }
    } else {
      const lower = part.toLowerCase();
      if (lower === "includesubdomains") {
        includeSubDomains = true;
      } else if (lower === "preload") {
        preload = true;
      } else {
        parseErrors.push(`Unrecognized HSTS directive: "${part}"`);
      }
    }
  }

  if (maxAgeSeconds === null) {
    parseErrors.push("Missing required max-age directive in Strict-Transport-Security header");
  }

  const isMalformed = parseErrors.length > 0 || maxAgeSeconds === null;
  const maxAgeDays = maxAgeSeconds !== null ? Math.round((maxAgeSeconds / 86400) * 10) / 10 : null;

  return {
    rawHeader: trimmed,
    parsedSuccessfully: !isMalformed,
    parseErrors,
    maxAgeSeconds,
    maxAgeDays,
    includeSubDomains,
    preload,
    isZeroMaxAge: maxAgeSeconds === 0,
    isMalformed,
  };
}

export function extractHstsFactFromHeaders(
  headers: Record<string, string | string[] | undefined>
): HstsHeaderFact | null {
  const hstsVal = headers["strict-transport-security"];
  if (!hstsVal) return null;
  if (Array.isArray(hstsVal)) {
    return parseHstsHeader(String(hstsVal[0]));
  }
  return parseHstsHeader(String(hstsVal));
}
