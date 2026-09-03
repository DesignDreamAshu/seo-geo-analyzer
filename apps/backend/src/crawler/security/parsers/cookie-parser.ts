/**
 * Set-Cookie Security Fact Parser (SECURITY S1).
 * Parses individual Set-Cookie headers into structured, redacted security facts.
 */

import type { CookieSecurityFact } from "../types";
import { redactCookieValue } from "../redaction";

const SESSION_COOKIE_NAME_PATTERN = /^(session|sess|sid|auth|token|jwt|connect\.sid|phpsessid|jsessionid|aspsessionid|laravel_session|_session_id|user_session|remember_token|login)/i;

/**
 * Parses a single Set-Cookie header string into a CookieSecurityFact.
 */
export function parseSingleSetCookie(
  rawCookieHeader: string,
  sourceUrl: string
): CookieSecurityFact | null {
  if (!rawCookieHeader || typeof rawCookieHeader !== "string") {
    return null;
  }

  const trimmed = rawCookieHeader.trim();
  if (!trimmed) {
    return null;
  }

  // Set-Cookie is structured as: <name>=<value>; <attr1>=<val1>; <attr2>
  const parts = trimmed.split(";").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const firstPart = parts[0];
  const eqIdx = firstPart.indexOf("=");
  if (eqIdx === -1) {
    return null;
  }

  const cookieName = firstPart.slice(0, eqIdx).trim();
  const rawValue = firstPart.slice(eqIdx + 1).trim();

  let isSecure = false;
  let isHttpOnly = false;
  let rawSameSite: string | null = null;
  let sameSite: CookieSecurityFact["sameSite"] = "unspecified";
  let domain: string | null = null;
  let path: string | null = null;
  let maxAgeSeconds: number | null = null;
  let expires: string | null = null;

  for (let i = 1; i < parts.length; i++) {
    const attrPart = parts[i];
    const attrEq = attrPart.indexOf("=");

    if (attrEq === -1) {
      const flag = attrPart.toLowerCase();
      if (flag === "secure") isSecure = true;
      if (flag === "httponly") isHttpOnly = true;
    } else {
      const attrName = attrPart.slice(0, attrEq).trim().toLowerCase();
      const attrVal = attrPart.slice(attrEq + 1).trim().replace(/^["']|["']$/g, "");

      if (attrName === "samesite") {
        rawSameSite = attrVal;
        const lowerVal = attrVal.toLowerCase();
        if (lowerVal === "strict") sameSite = "Strict";
        else if (lowerVal === "lax") sameSite = "Lax";
        else if (lowerVal === "none") sameSite = "None";
        else sameSite = "invalid";
      } else if (attrName === "domain") {
        domain = attrVal;
      } else if (attrName === "path") {
        path = attrVal;
      } else if (attrName === "max-age") {
        const parsed = parseInt(attrVal, 10);
        if (!isNaN(parsed)) maxAgeSeconds = parsed;
      } else if (attrName === "expires") {
        expires = attrVal;
      }
    }
  }

  let sourceOrigin = "";
  let setOverInsecureTransport = false;
  try {
    const parsedUrl = new URL(sourceUrl);
    sourceOrigin = parsedUrl.origin;
    setOverInsecureTransport = parsedUrl.protocol === "http:";
  } catch {
    sourceOrigin = sourceUrl;
  }

  const hasHostPrefix = cookieName.startsWith("__Host-");
  const hasSecurePrefix = cookieName.startsWith("__Secure-");

  // __Host- cookie requirements: Secure flag present, Path is /, no Domain attribute
  const isHostPrefixValid = hasHostPrefix
    ? isSecure && !domain && (path === "/" || path === null)
    : true;

  // __Secure- cookie requirements: Secure flag present
  const isSecurePrefixValid = hasSecurePrefix ? isSecure : true;

  const isSameSiteNoneWithoutSecure = sameSite === "None" && !isSecure;

  const isDomainExplicit = Boolean(domain);
  const isDomainBroad = Boolean(domain && (domain.startsWith(".") || domain.split(".").length >= 2));

  const isSuspectedSessionOrAuth = SESSION_COOKIE_NAME_PATTERN.test(cookieName);

  return {
    cookieName,
    redactedValue: redactCookieValue(rawValue),
    rawLength: rawValue.length,
    isSecure,
    isHttpOnly,
    sameSite,
    rawSameSite,
    domain,
    isDomainExplicit,
    isDomainBroad,
    path,
    maxAgeSeconds,
    expires,
    hasHostPrefix,
    hasSecurePrefix,
    isHostPrefixValid,
    isSecurePrefixValid,
    isSameSiteNoneWithoutSecure,
    setOverInsecureTransport,
    sourceUrl,
    sourceOrigin,
    isSuspectedSessionOrAuth,
  };
}

/**
 * Extracts all Set-Cookie headers from a response headers map.
 */
export function extractCookiesFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  sourceUrl: string
): CookieSecurityFact[] {
  const cookies: CookieSecurityFact[] = [];
  const setCookieVal = headers["set-cookie"];

  if (!setCookieVal) {
    return cookies;
  }

  if (Array.isArray(setCookieVal)) {
    for (const raw of setCookieVal) {
      const parsed = parseSingleSetCookie(String(raw), sourceUrl);
      if (parsed) cookies.push(parsed);
    }
  } else {
    // If it's a string, it might be a single cookie or combined
    const parsed = parseSingleSetCookie(String(setCookieVal), sourceUrl);
    if (parsed) cookies.push(parsed);
  }

  return cookies;
}
