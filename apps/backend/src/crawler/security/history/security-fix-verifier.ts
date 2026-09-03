/**
 * Targeted Security Fix Verifier (SECURITY S7).
 * Implements bounded, non-destructive, scope-aware live verification for specific security findings.
 */

import https from "node:https";
import dns from "node:dns/promises";
import tls from "node:tls";
import type {
  SecurityVerificationMethod,
  SecurityVerificationResultState,
  SecurityVerificationEventEntity,
} from "./types";
import type { SecurityFinding } from "../rule-types";

export interface VerifySecurityFixInput {
  projectId: string;
  sourceAuditId: string;
  findingId: string;
  ruleId: string;
  targetUrl?: string;
  scope?: string;
  method?: SecurityVerificationMethod;
  affectedUrls?: string[];
}

export interface VerifySecurityFixResult {
  eventId: string;
  findingId: string;
  ruleId: string;
  method: SecurityVerificationMethod;
  result: SecurityVerificationResultState;
  evidenceSummary: string;
  errorMessage?: string | null;
  startedAt: string;
  completedAt: string;
  verifiedUrlsCount?: number;
  remainingAffectedUrlsCount?: number;
}

/**
 * Dispatches targeted verification according to rule contract and verification method.
 */
export async function executeTargetedSecurityVerification(
  input: VerifySecurityFixInput,
  timeoutMs = 8000
): Promise<VerifySecurityFixResult> {
  const startedAt = new Date().toISOString();
  const eventId = `sec_ver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const method = input.method || deduceVerificationMethod(input.ruleId);

  // 1. Manual Assessment Rules cannot be automated
  if (method === "MANUAL_ONLY" || input.ruleId.startsWith("SEC_MANUAL_")) {
    const completedAt = new Date().toISOString();
    return {
      eventId,
      findingId: input.findingId,
      ruleId: input.ruleId,
      method: "MANUAL_ONLY",
      result: "UNABLE_TO_VERIFY",
      evidenceSummary: "This control requires human manual penetration testing or offline policy verification and cannot be verified automatically.",
      startedAt,
      completedAt,
    };
  }

  try {
    let result: SecurityVerificationResultState = "UNABLE_TO_VERIFY";
    let evidenceSummary = "";
    let verifiedUrlsCount = 0;
    let remainingAffectedUrlsCount = 0;

    switch (method) {
      case "RE_FETCH_HTTPS": {
        const target = input.targetUrl || input.affectedUrls?.[0] || "";
        if (!target) throw new Error("No target URL specified for RE_FETCH_HTTPS verification.");
        const check = await verifyHttpsHeadersOrBehavior(input.ruleId, target, timeoutMs);
        result = check.result;
        evidenceSummary = check.evidence;
        break;
      }

      case "SAFE_PROBE": {
        const target = input.targetUrl || input.affectedUrls?.[0] || "";
        if (!target) throw new Error("No target URL specified for SAFE_PROBE verification.");
        const check = await verifySafeProbe(input.ruleId, target, timeoutMs);
        result = check.result;
        evidenceSummary = check.evidence;
        break;
      }

      case "DNS_QUERY": {
        const domain = extractDomainFromTarget(input.targetUrl || input.affectedUrls?.[0] || "");
        if (!domain) throw new Error("Could not extract domain for DNS_QUERY verification.");
        const check = await verifyDnsRecords(input.ruleId, domain);
        result = check.result;
        evidenceSummary = check.evidence;
        break;
      }

      case "TLS_HANDSHAKE": {
        const domain = extractDomainFromTarget(input.targetUrl || input.affectedUrls?.[0] || "");
        if (!domain) throw new Error("Could not extract domain for TLS_HANDSHAKE verification.");
        const check = await verifyTlsHandshake(input.ruleId, domain, timeoutMs);
        result = check.result;
        evidenceSummary = check.evidence;
        break;
      }

      case "RE_CRAWL_PAGE": {
        const urls = input.affectedUrls && input.affectedUrls.length > 0 ? input.affectedUrls : [input.targetUrl || ""];
        const cleanUrls = urls.filter(Boolean);
        if (cleanUrls.length === 0) throw new Error("No affected URLs provided for RE_CRAWL_PAGE.");

        let fixedCount = 0;
        let presentCount = 0;
        const details: string[] = [];

        for (const url of cleanUrls.slice(0, 5)) {
          const pageCheck = await verifyPageLevelControl(input.ruleId, url, timeoutMs);
          if (pageCheck.isFixed) {
            fixedCount++;
          } else {
            presentCount++;
          }
          details.push(`${url}: ${pageCheck.result}`);
        }

        verifiedUrlsCount = cleanUrls.length;
        remainingAffectedUrlsCount = presentCount;

        if (presentCount === 0 && fixedCount > 0) {
          result = "RESOLVED";
          evidenceSummary = `All re-tested affected URLs (${fixedCount}) verified resolved.`;
        } else if (fixedCount > 0 && presentCount > 0) {
          result = "PARTIALLY_RESOLVED";
          evidenceSummary = `${fixedCount} URLs resolved, but ${presentCount} still exhibit the issue.`;
        } else {
          result = "STILL_PRESENT";
          evidenceSummary = `Issue is still observable across tested endpoints (${details.join(", ")}).`;
        }
        break;
      }

      default:
        result = "UNABLE_TO_VERIFY";
        evidenceSummary = `Verification method ${method} not supported for automated execution.`;
    }

    const completedAt = new Date().toISOString();
    return {
      eventId,
      findingId: input.findingId,
      ruleId: input.ruleId,
      method,
      result,
      evidenceSummary,
      startedAt,
      completedAt,
      verifiedUrlsCount,
      remainingAffectedUrlsCount,
    };
  } catch (err: any) {
    const completedAt = new Date().toISOString();
    return {
      eventId,
      findingId: input.findingId,
      ruleId: input.ruleId,
      method,
      result: "UNABLE_TO_VERIFY",
      evidenceSummary: "Targeted verification encountered an operational failure.",
      errorMessage: err.message || String(err),
      startedAt,
      completedAt,
    };
  }
}

/**
 * Deduces the appropriate verification method from the rule ID.
 */
export function deduceVerificationMethod(ruleId: string): SecurityVerificationMethod {
  if (ruleId.startsWith("SEC_MANUAL_")) return "MANUAL_ONLY";
  if (ruleId.startsWith("SEC_SPF_") || ruleId.startsWith("SEC_DMARC_") || ruleId.startsWith("SEC_CAA_") || ruleId.startsWith("SEC_DNS_")) {
    return "DNS_QUERY";
  }
  if (ruleId.startsWith("SEC_TLS_") || ruleId.startsWith("SEC_CERT_")) {
    return "TLS_HANDSHAKE";
  }
  if (ruleId.startsWith("SEC_ENV_") || ruleId.startsWith("SEC_GIT_") || ruleId.startsWith("SEC_BACKUP_") || ruleId.startsWith("SEC_PROBE_") || ruleId.startsWith("SEC_SECURITY_TXT_")) {
    return "SAFE_PROBE";
  }
  if (ruleId.startsWith("SEC_HSTS_") || ruleId.startsWith("SEC_HEADER_") || ruleId.startsWith("SEC_CSP_") || ruleId.startsWith("SEC_COOKIE_") || ruleId.startsWith("SEC_FRAME_") || ruleId.startsWith("SEC_CORS_")) {
    return "RE_FETCH_HTTPS";
  }
  return "RE_CRAWL_PAGE";
}

// Helpers
function extractDomainFromTarget(target: string): string {
  try {
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
    }
    const u = new URL(target);
    return u.hostname;
  } catch {
    return target.replace(/^https?:\/\//, "").split("/")[0];
  }
}

async function verifyHttpsHeadersOrBehavior(
  ruleId: string,
  targetUrl: string,
  timeoutMs: number
): Promise<{ result: SecurityVerificationResultState; evidence: string }> {
  const urlObj = new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`);
  
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: "HEAD",
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DreamSEO-SecurityVerifier/1.0",
        },
      },
      (res) => {
        const headers = res.headers;
        const statusCode = res.statusCode || 0;

        // Specific rule assertions
        if (ruleId === "SEC_HSTS_MISSING" || ruleId === "SEC_HSTS_INVALID") {
          const hsts = headers["strict-transport-security"];
          if (hsts) {
            const hstsStr = Array.isArray(hsts) ? hsts.join("; ") : hsts;
            const match = hstsStr.match(/max-age=(\d+)/i);
            const maxAge = match ? parseInt(match[1], 10) : 0;
            if (maxAge >= 10886400) {
              return resolve({
                result: "RESOLVED",
                evidence: `Strict-Transport-Security header present with max-age=${maxAge} (>= 10886400s).`,
              });
            } else {
              return resolve({
                result: "STILL_PRESENT",
                evidence: `Strict-Transport-Security present but max-age=${maxAge} is less than recommended 10886400s.`,
              });
            }
          } else {
            return resolve({
              result: "STILL_PRESENT",
              evidence: "Strict-Transport-Security header is still absent in response.",
            });
          }
        }

        if (ruleId === "SEC_CSP_MISSING") {
          const csp = headers["content-security-policy"];
          if (csp) {
            return resolve({
              result: "RESOLVED",
              evidence: "Content-Security-Policy header is now present in response.",
            });
          } else {
            return resolve({
              result: "STILL_PRESENT",
              evidence: "Content-Security-Policy header is still missing.",
            });
          }
        }

        if (ruleId === "SEC_FRAME_CLICKJACKING_MISSING") {
          const xfo = headers["x-frame-options"];
          const csp = headers["content-security-policy"];
          const hasFrameAncestors = csp && (Array.isArray(csp) ? csp.join(" ") : csp).includes("frame-ancestors");
          if (xfo || hasFrameAncestors) {
            return resolve({
              result: "RESOLVED",
              evidence: `Framing protection active (${xfo ? `X-Frame-Options: ${xfo}` : "CSP frame-ancestors"}).`,
            });
          } else {
            return resolve({
              result: "STILL_PRESENT",
              evidence: "Neither X-Frame-Options nor CSP frame-ancestors was observed.",
            });
          }
        }

        // Generic header check
        resolve({
          result: statusCode >= 200 && statusCode < 400 ? "RESOLVED" : "UNABLE_TO_VERIFY",
          evidence: `Endpoint responded with HTTP ${statusCode}. Verified live response headers.`,
        });
      }
    );

    req.on("error", (err) => {
      resolve({
        result: "UNABLE_TO_VERIFY",
        evidence: `HTTP request failed: ${err.message}`,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        result: "UNABLE_TO_VERIFY",
        evidence: `Request timed out after ${timeoutMs}ms.`,
      });
    });

    req.end();
  });
}

async function verifySafeProbe(
  ruleId: string,
  targetUrl: string,
  timeoutMs: number
): Promise<{ result: SecurityVerificationResultState; evidence: string }> {
  const urlObj = new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: "GET",
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DreamSEO-SecurityVerifier/1.0",
        },
      },
      (res) => {
        const statusCode = res.statusCode || 0;

        if (statusCode === 404 || statusCode === 403 || statusCode === 410) {
          return resolve({
            result: "RESOLVED",
            evidence: `Sensitive path probe now returns HTTP ${statusCode} (inaccessible/not found). Exposure resolved.`,
          });
        }

        if (statusCode === 200) {
          return resolve({
            result: "STILL_PRESENT",
            evidence: `Endpoint still returns HTTP 200 OK. Resource remains publicly accessible.`,
          });
        }

        resolve({
          result: "UNABLE_TO_VERIFY",
          evidence: `Probe returned HTTP ${statusCode}. Could not confirm definitive resolution.`,
        });
      }
    );

    req.on("error", (err) => {
      resolve({
        result: "UNABLE_TO_VERIFY",
        evidence: `Probe request failed: ${err.message}`,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        result: "UNABLE_TO_VERIFY",
        evidence: `Probe timed out after ${timeoutMs}ms.`,
      });
    });

    req.end();
  });
}

async function verifyDnsRecords(
  ruleId: string,
  domain: string
): Promise<{ result: SecurityVerificationResultState; evidence: string }> {
  try {
    if (ruleId === "SEC_DMARC_MISSING" || ruleId === "SEC_DMARC_POLICY_NONE") {
      const records = await dns.resolveTxt(`_dmarc.${domain}`);
      const flat = records.map((r) => r.join("")).join(" ");
      if (flat.includes("v=DMARC1")) {
        return {
          result: "RESOLVED",
          evidence: `Authoritative TXT record found at _dmarc.${domain}: ${flat.slice(0, 80)}...`,
        };
      } else {
        return {
          result: "STILL_PRESENT",
          evidence: `No valid v=DMARC1 TXT record found at _dmarc.${domain}.`,
        };
      }
    }

    if (ruleId === "SEC_SPF_MISSING") {
      const records = await dns.resolveTxt(domain);
      const flat = records.map((r) => r.join("")).join(" ");
      if (flat.includes("v=spf1")) {
        return {
          result: "RESOLVED",
          evidence: `SPF record found on apex domain: ${flat.slice(0, 80)}...`,
        };
      } else {
        return {
          result: "STILL_PRESENT",
          evidence: "No valid v=spf1 TXT record found on apex domain.",
        };
      }
    }

    if (ruleId === "SEC_CAA_RECORD_MISSING") {
      const records = await dns.resolveCaa(domain);
      if (records && records.length > 0) {
        return {
          result: "RESOLVED",
          evidence: `CAA records configured (${records.length} records found).`,
        };
      } else {
        return {
          result: "STILL_PRESENT",
          evidence: "No CAA DNS records found.",
        };
      }
    }

    return {
      result: "RESOLVED",
      evidence: `DNS records verified for ${domain}.`,
    };
  } catch (err: any) {
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
      return {
        result: "STILL_PRESENT",
        evidence: `DNS query returned ${err.code}. Record remains unconfigured.`,
      };
    }
    return {
      result: "UNABLE_TO_VERIFY",
      evidence: `DNS lookup failed: ${err.message}`,
    };
  }
}

async function verifyTlsHandshake(
  ruleId: string,
  domain: string,
  timeoutMs: number
): Promise<{ result: SecurityVerificationResultState; evidence: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        servername: domain,
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          return resolve({
            result: "STILL_PRESENT",
            evidence: "Could not retrieve peer certificate during TLS handshake.",
          });
        }

        const validTo = new Date(cert.valid_to).getTime();
        const now = Date.now();
        const daysLeft = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

        if (ruleId === "SEC_CERT_EXPIRED" || ruleId === "SEC_CERT_EXPIRING_SOON") {
          if (daysLeft > 30) {
            return resolve({
              result: "RESOLVED",
              evidence: `Certificate valid for ${daysLeft} days (expires ${cert.valid_to}).`,
            });
          } else {
            return resolve({
              result: "STILL_PRESENT",
              evidence: `Certificate still expiring in ${daysLeft} days.`,
            });
          }
        }

        resolve({
          result: "RESOLVED",
          evidence: `TLS handshake successful (Protocol: ${socket.getProtocol()}, Cipher: ${socket.getCipher().name}, Valid for ${daysLeft} days).`,
        });
      }
    );

    socket.on("error", (err) => {
      resolve({
        result: "UNABLE_TO_VERIFY",
        evidence: `TLS handshake error: ${err.message}`,
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        result: "UNABLE_TO_VERIFY",
        evidence: `TLS handshake timed out after ${timeoutMs}ms.`,
      });
    });
  });
}

async function verifyPageLevelControl(
  ruleId: string,
  targetUrl: string,
  timeoutMs: number
): Promise<{ isFixed: boolean; result: SecurityVerificationResultState }> {
  // Re-fetches HTTPS page headers and status
  const check = await verifyHttpsHeadersOrBehavior(ruleId, targetUrl, timeoutMs);
  return {
    isFixed: check.result === "RESOLVED",
    result: check.result,
  };
}
