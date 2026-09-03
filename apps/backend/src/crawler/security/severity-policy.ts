/**
 * Centralized Security Severity Policy (SECURITY S2).
 * Establishes defensible, standardized severities and classifications across all security rules.
 */

import type { SecuritySeverity, SecurityConfidence, SecurityVerificationClassification } from "./rule-types";

export interface RuleSeverityConfig {
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  classification: SecurityVerificationClassification;
}

export const CENTRAL_SECURITY_SEVERITY_POLICY: Record<string, RuleSeverityConfig> = {
  // 1. Transport & HTTPS
  SEC_HTTPS_UNAVAILABLE: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_HTTP_NO_HTTPS_REDIRECT: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_HTTP_REDIRECTS_TO_INSECURE_DESTINATION: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_MIXED_ACTIVE_CONTENT: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_MIXED_PASSIVE_CONTENT: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_CERT_EXPIRED: { severity: "critical", confidence: "confirmed", classification: "confirmed" },
  SEC_CERT_EXPIRING_SOON: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_CERT_HOSTNAME_MISMATCH: { severity: "critical", confidence: "confirmed", classification: "confirmed" },
  SEC_TLS_CERTIFICATE_UNVERIFIED: { severity: "high", confidence: "confirmed", classification: "confirmed" },

  // 2. HSTS
  SEC_HSTS_MISSING: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_HSTS_SHORT_MAX_AGE: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_HSTS_PRELOAD_NOT_ENABLED: { severity: "informational", confidence: "confirmed", classification: "confirmed" },

  // 3. CSP & Frame Protection
  SEC_CSP_MISSING: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_CSP_REPORT_ONLY_WITHOUT_ENFORCED_POLICY: { severity: "informational", confidence: "confirmed", classification: "confirmed" },
  SEC_CSP_UNSAFE_EVAL: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_CSP_UNSAFE_INLINE: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_CSP_BROAD_WILDCARD_SOURCE: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_CSP_OBJECT_SRC_UNRESTRICTED: { severity: "informational", confidence: "confirmed", classification: "confirmed" },
  SEC_CSP_BASE_URI_MISSING: { severity: "informational", confidence: "confirmed", classification: "confirmed" },
  SEC_CSP_MALFORMED: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_FRAME_PROTECTION_MISSING: { severity: "medium", confidence: "confirmed", classification: "confirmed" },

  // 4. Content Type & Referrer
  SEC_X_CONTENT_TYPE_OPTIONS_MISSING: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_X_CONTENT_TYPE_OPTIONS_INVALID: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_REFERRER_POLICY_MISSING: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_REFERRER_POLICY_OVERLY_PERMISSIVE: { severity: "low", confidence: "confirmed", classification: "confirmed" },

  // 5. Cookies
  SEC_COOKIE_SECURE_MISSING: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_COOKIE_HTTPONLY_MISSING: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_COOKIE_HOST_PREFIX_INVALID: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_COOKIE_SECURE_PREFIX_INVALID: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_COOKIE_SENT_OVER_INSECURE_TRANSPORT: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_COOKIE_OVERLY_BROAD_DOMAIN: { severity: "low", confidence: "medium", classification: "heuristic" },

  // 6. CORS
  SEC_CORS_WILDCARD_WITH_CREDENTIALS: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_CORS_WILDCARD: { severity: "informational", confidence: "confirmed", classification: "confirmed" },

  // 7. Information Disclosure
  SEC_X_POWERED_BY_DISCLOSURE: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_SERVER_VERSION_DISCLOSURE: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_DEBUG_HEADER_EXPOSURE: { severity: "informational", confidence: "confirmed", classification: "confirmed" },
  SEC_SOURCE_MAP_PUBLIC: { severity: "informational", confidence: "confirmed", classification: "confirmed" },

  // 8. Sensitive File Exposure
  SEC_ENV_FILE_EXPOSED: { severity: "critical", confidence: "confirmed", classification: "confirmed" },
  SEC_GIT_HEAD_EXPOSED: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_GIT_CONFIG_EXPOSED: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_DS_STORE_EXPOSED: { severity: "medium", confidence: "confirmed", classification: "confirmed" },

  // 9. Forms
  SEC_FORM_HTTPS_TO_HTTP: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_PASSWORD_FORM_OVER_HTTP: { severity: "critical", confidence: "confirmed", classification: "confirmed" },
  SEC_PASSWORD_FIELD_USING_GET: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_SENSITIVE_GET_FORM: { severity: "medium", confidence: "medium", classification: "heuristic" },
  SEC_EXTERNAL_FORM_SUBMISSION: { severity: "informational", confidence: "confirmed", classification: "confirmed" },

  // 10. Third-Party & SRI
  SEC_THIRD_PARTY_HTTP_SCRIPT: { severity: "high", confidence: "confirmed", classification: "confirmed" },
  SEC_THIRD_PARTY_HTTP_STYLESHEET: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_THIRD_PARTY_SRI_MISSING: { severity: "informational", confidence: "medium", classification: "heuristic" },

  // 11. Domain & Email Security
  SEC_CAA_MISSING: { severity: "informational", confidence: "confirmed", classification: "confirmed" },
  SEC_SPF_MISSING: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_DMARC_MISSING: { severity: "medium", confidence: "confirmed", classification: "confirmed" },
  SEC_DMARC_POLICY_NONE: { severity: "low", confidence: "confirmed", classification: "confirmed" },
  SEC_DMARC_PCT_PARTIAL: { severity: "low", confidence: "confirmed", classification: "confirmed" },

  // 12. Manual Coverage Limitations
  SEC_MANUAL_SQL_INJECTION: { severity: "high", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_XSS: { severity: "high", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_AUTH_BYPASS: { severity: "critical", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_BROKEN_ACCESS_CONTROL: { severity: "high", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_IDOR: { severity: "high", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_SSRF: { severity: "high", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_COMMAND_INJECTION: { severity: "critical", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_BUSINESS_LOGIC: { severity: "medium", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_PRIVILEGE_ESCALATION: { severity: "critical", confidence: "low", classification: "requires_manual_verification" },
  SEC_MANUAL_CSRF_ACTIVE_TEST: { severity: "medium", confidence: "low", classification: "requires_manual_verification" },
};
