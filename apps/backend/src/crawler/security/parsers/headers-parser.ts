/**
 * General Security Response Headers Fact Parser (SECURITY S1).
 * Parses all authoritative browser security headers and disclosure headers for a response.
 */

import type { ResponseSecurityHeadersFacts } from "../types";
import { extractCspFactsFromHeaders } from "./csp-parser";
import { extractHstsFactFromHeaders } from "./hsts-parser";

/**
 * Extracts and normalizes all security response headers from a response headers map.
 */
export function extractAllSecurityHeadersFacts(
  headers: Record<string, string | string[] | undefined>
): ResponseSecurityHeadersFacts {
  const normHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined && v !== null) {
      normHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
    }
  }

  // 1. CSP
  const { enforced: cspEnforced, reportOnly: cspReportOnly } = extractCspFactsFromHeaders(headers);

  // 2. HSTS
  const hsts = extractHstsFactFromHeaders(headers);

  // 3. X-Content-Type-Options
  const xctoRaw = normHeaders["x-content-type-options"] || null;
  const xContentTypeOptions = xctoRaw
    ? {
        raw: xctoRaw,
        isNoSniff: xctoRaw.trim().toLowerCase() === "nosniff",
        isMalformed: xctoRaw.trim().toLowerCase() !== "nosniff",
      }
    : null;

  // 4. Referrer-Policy
  const refRaw = normHeaders["referrer-policy"] || null;
  const referrerPolicy = refRaw
    ? {
        raw: refRaw,
        tokens: refRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        hasNoReferrer: refRaw.toLowerCase().includes("no-referrer"),
        hasStrictOriginWhenCrossOrigin: refRaw.toLowerCase().includes("strict-origin-when-cross-origin"),
        hasUnsafeUrl: refRaw.toLowerCase().includes("unsafe-url"),
        hasNoReferrerWhenDowngrade: refRaw.toLowerCase().includes("no-referrer-when-downgrade"),
      }
    : null;

  // 5. Permissions-Policy
  const permRaw = normHeaders["permissions-policy"] || null;
  let permissionsPolicy: ResponseSecurityHeadersFacts["permissionsPolicy"] = null;
  if (permRaw) {
    const parsedDirectives: Record<string, string[]> = {};
    const parts = permRaw.split(",").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx !== -1) {
        const feat = part.slice(0, eqIdx).trim().toLowerCase();
        const rawOrigins = part.slice(eqIdx + 1).trim().replace(/^\(|\)$/g, "");
        parsedDirectives[feat] = rawOrigins.split(/\s+/).filter(Boolean);
      } else {
        parsedDirectives[part.toLowerCase()] = [];
      }
    }
    permissionsPolicy = {
      raw: permRaw,
      parsedDirectives,
      directiveCount: Object.keys(parsedDirectives).length,
    };
  }

  // 6. X-Frame-Options
  const xfoRaw = normHeaders["x-frame-options"] || null;
  let xFrameOptions: ResponseSecurityHeadersFacts["xFrameOptions"] = null;
  if (xfoRaw) {
    const upper = xfoRaw.trim().toUpperCase();
    let normalized: "DENY" | "SAMEORIGIN" | "ALLOW-FROM" | "OTHER" = "OTHER";
    if (upper === "DENY") normalized = "DENY";
    else if (upper === "SAMEORIGIN") normalized = "SAMEORIGIN";
    else if (upper.startsWith("ALLOW-FROM")) normalized = "ALLOW-FROM";

    xFrameOptions = {
      raw: xfoRaw,
      normalized,
      isDeny: normalized === "DENY",
      isSameOrigin: normalized === "SAMEORIGIN",
      isMalformed: normalized === "OTHER",
    };
  }

  // 7. CORS
  const acaoRaw = normHeaders["access-control-allow-origin"] || null;
  const acacRaw = normHeaders["access-control-allow-credentials"] || null;
  const acamRaw = normHeaders["access-control-allow-methods"] || null;
  const acahRaw = normHeaders["access-control-allow-headers"] || null;
  const acehRaw = normHeaders["access-control-expose-headers"] || null;

  const isWildcardOrigin = acaoRaw?.trim() === "*";
  const isAllowCredentialsTrue = acacRaw?.trim().toLowerCase() === "true";
  const isDangerousWildcardCredentialsCombination = isWildcardOrigin && isAllowCredentialsTrue;

  const cors = {
    allowOriginRaw: acaoRaw,
    isWildcardOrigin,
    isSpecificOrigin: Boolean(acaoRaw && !isWildcardOrigin),
    allowCredentialsRaw: acacRaw,
    isAllowCredentialsTrue,
    isDangerousWildcardCredentialsCombination,
    allowMethods: acamRaw ? acamRaw.split(",").map((s) => s.trim()) : [],
    allowHeaders: acahRaw ? acahRaw.split(",").map((s) => s.trim()) : [],
    exposeHeaders: acehRaw ? acehRaw.split(",").map((s) => s.trim()) : [],
  };

  // 8. COOP
  const coopRaw = normHeaders["cross-origin-opener-policy"] || null;
  let coop: ResponseSecurityHeadersFacts["coop"] = null;
  if (coopRaw) {
    const val = coopRaw.trim().toLowerCase();
    let normalized: "same-origin" | "same-origin-allow-popups" | "unsafe-none" | "other" = "other";
    if (val === "same-origin") normalized = "same-origin";
    else if (val === "same-origin-allow-popups") normalized = "same-origin-allow-popups";
    else if (val === "unsafe-none") normalized = "unsafe-none";
    coop = { raw: coopRaw, normalized };
  }

  // 9. CORP
  const corpRaw = normHeaders["cross-origin-resource-policy"] || null;
  let corp: ResponseSecurityHeadersFacts["corp"] = null;
  if (corpRaw) {
    const val = corpRaw.trim().toLowerCase();
    let normalized: "same-origin" | "same-site" | "cross-origin" | "other" = "other";
    if (val === "same-origin") normalized = "same-origin";
    else if (val === "same-site") normalized = "same-site";
    else if (val === "cross-origin") normalized = "cross-origin";
    corp = { raw: corpRaw, normalized };
  }

  // 10. COEP
  const coepRaw = normHeaders["cross-origin-embedder-policy"] || null;
  let coep: ResponseSecurityHeadersFacts["coep"] = null;
  if (coepRaw) {
    const val = coepRaw.trim().toLowerCase();
    let normalized: "require-corp" | "credentialless" | "unsafe-none" | "other" = "other";
    if (val === "require-corp") normalized = "require-corp";
    else if (val === "credentialless") normalized = "credentialless";
    else if (val === "unsafe-none") normalized = "unsafe-none";
    coep = { raw: coepRaw, normalized };
  }

  // 11. Server & Tech Disclosure
  const rawServer = normHeaders["server"] || null;
  const rawXPoweredBy = normHeaders["x-powered-by"] || null;
  const rawXAspNetVersion = normHeaders["x-aspnet-version"] || null;
  const rawXAspNetMvcVersion = normHeaders["x-aspnetmvc-version"] || null;

  const disclosedTechnologies: string[] = [];
  if (rawServer) disclosedTechnologies.push(`Server: ${rawServer}`);
  if (rawXPoweredBy) disclosedTechnologies.push(`X-Powered-By: ${rawXPoweredBy}`);
  if (rawXAspNetVersion) disclosedTechnologies.push(`X-AspNet-Version: ${rawXAspNetVersion}`);
  if (rawXAspNetMvcVersion) disclosedTechnologies.push(`X-AspNetMvc-Version: ${rawXAspNetMvcVersion}`);

  const serverDisclosure = {
    rawServer,
    rawXPoweredBy,
    hasServerHeader: Boolean(rawServer),
    hasXPoweredBy: Boolean(rawXPoweredBy),
    disclosedTechnologies,
  };

  return {
    cspEnforced,
    cspReportOnly,
    hsts,
    xContentTypeOptions,
    referrerPolicy,
    permissionsPolicy,
    xFrameOptions,
    cors,
    coop,
    corp,
    coep,
    serverDisclosure,
  };
}
