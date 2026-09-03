/**
 * Security Implementation Map Builder (SECURITY S4).
 * Clusters discrete security findings into high-leverage, owner-grouped implementation actions.
 */

import type { SecurityFinding } from "../rule-types";
import type {
  SecurityRemediation,
  SecurityImplementationMap,
  SecurityImplementationAction,
  SecurityOwnership,
  SecurityFixDifficulty,
  SecurityEffortClass,
} from "./remediation-types";

export function buildSecurityImplementationMap(
  findings: SecurityFinding[],
  remediations: SecurityRemediation[]
): SecurityImplementationMap {
  const remByRule = new Map<string, SecurityRemediation>();
  for (const r of remediations) {
    remByRule.set(r.ruleId, r);
  }

  const actions: SecurityImplementationAction[] = [];
  const processedRuleIds = new Set<string>();

  // 1. Cluster: Global Web Server & CDN Response Headers
  const headerRules = [
    "SEC_HSTS_MISSING",
    "SEC_HSTS_SHORT_MAX_AGE",
    "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING",
    "SEC_HSTS_PRELOAD_NOT_ENABLED",
    "SEC_X_CONTENT_TYPE_OPTIONS_MISSING",
    "SEC_X_CONTENT_TYPE_OPTIONS_INVALID",
    "SEC_REFERRER_POLICY_MISSING",
    "SEC_REFERRER_POLICY_OVERLY_PERMISSIVE",
    "SEC_FRAME_PROTECTION_MISSING",
    "SEC_CSP_MISSING",
    "SEC_CSP_UNSAFE_INLINE",
    "SEC_CSP_UNSAFE_EVAL",
    "SEC_CSP_BROAD_WILDCARD_SOURCE",
    "SEC_CSP_OBJECT_SRC_UNRESTRICTED",
    "SEC_CSP_BASE_URI_MISSING",
  ];
  const matchedHeaders = findings.filter(f => headerRules.includes(f.ruleId));
  if (matchedHeaders.length > 0) {
    const findingIds = matchedHeaders.map(f => f.id);
    const ruleIds = Array.from(new Set(matchedHeaders.map(f => f.ruleId)));
    const totalAffectedUrls = Array.from(new Set(matchedHeaders.flatMap(f => f.affectedUrls || []))).length;
    actions.push({
      actionId: "SEC_ACT_GLOBAL_HEADERS",
      title: "Configure Global Security Response Headers on Web Server / CDN",
      description: `Deploy standardized response headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Frame Protection) at your edge CDN or web server.`,
      primaryOwner: "WEB_SERVER",
      secondaryOwners: ["CDN", "HOSTING_PROVIDER"],
      difficulty: "MODERATE",
      estimatedEffortClass: "UNDER_1_HOUR",
      resolvedRuleIds: ruleIds,
      resolvedFindingIds: findingIds,
      affectedUrlsCount: totalAffectedUrls,
      affectedOccurrencesCount: matchedHeaders.reduce((sum, f) => sum + (f.affectedOccurrences || 1), 0),
      isGlobalFix: true,
      implementationSummary: `1 configuration update on your CDN/web server resolves ${ruleIds.length} security header issues across ${totalAffectedUrls} URLs.`
    });
    ruleIds.forEach(id => processedRuleIds.add(id));
  }

  // 2. Cluster: Sensitive Files Exposure & Credential Rotation
  const sensitiveRules = ["SEC_ENV_FILE_EXPOSED", "SEC_GIT_HEAD_EXPOSED", "SEC_GIT_CONFIG_EXPOSED", "SEC_DS_STORE_EXPOSED"];
  const matchedSensitive = findings.filter(f => sensitiveRules.includes(f.ruleId));
  if (matchedSensitive.length > 0) {
    const findingIds = matchedSensitive.map(f => f.id);
    const ruleIds = Array.from(new Set(matchedSensitive.map(f => f.ruleId)));
    actions.push({
      actionId: "SEC_ACT_SENSITIVE_FILES",
      title: "Block Public Dotfiles & Rotate Potentially Compromised Secrets",
      description: "Remove public access to exposed configuration and metadata files (.env, .git, .DS_Store) and rotate all production credentials.",
      primaryOwner: "DEVELOPER",
      secondaryOwners: ["WEB_SERVER", "HOSTING_PROVIDER"],
      difficulty: "ADVANCED",
      estimatedEffortClass: "FEW_HOURS",
      resolvedRuleIds: ruleIds,
      resolvedFindingIds: findingIds,
      affectedUrlsCount: matchedSensitive.length,
      affectedOccurrencesCount: matchedSensitive.length,
      isGlobalFix: true,
      implementationSummary: "Deny web access to dotfiles in server config and rotate database and API keys."
    });
    ruleIds.forEach(id => processedRuleIds.add(id));
  }

  // 3. Cluster: Transport, SSL Certificate & Mixed Content
  const transportRules = [
    "SEC_HTTPS_UNAVAILABLE",
    "SEC_HTTP_NO_HTTPS_REDIRECT",
    "SEC_CERT_EXPIRED",
    "SEC_CERT_EXPIRING_SOON",
    "SEC_CERT_HOSTNAME_MISMATCH",
    "SEC_TLS_CERTIFICATE_UNVERIFIED",
    "SEC_MIXED_ACTIVE_CONTENT",
    "SEC_MIXED_PASSIVE_CONTENT",
    "SEC_THIRD_PARTY_HTTP_SCRIPT",
    "SEC_THIRD_PARTY_HTTP_STYLESHEET",
  ];
  const matchedTransport = findings.filter(f => transportRules.includes(f.ruleId));
  if (matchedTransport.length > 0) {
    const findingIds = matchedTransport.map(f => f.id);
    const ruleIds = Array.from(new Set(matchedTransport.map(f => f.ruleId)));
    const totalAffected = Array.from(new Set(matchedTransport.flatMap(f => f.affectedUrls || []))).length;
    actions.push({
      actionId: "SEC_ACT_TRANSPORT_ENCRYPTION",
      title: "Upgrade Transport Encryption & Replace Insecure HTTP Assets",
      description: "Ensure complete HTTPS enforcement, valid TLS certificate coverage, and upgrade all embedded HTTP asset links to HTTPS.",
      primaryOwner: "DEVELOPER",
      secondaryOwners: ["WEB_SERVER", "HOSTING_PROVIDER", "CONTENT_EDITOR"],
      difficulty: "MODERATE",
      estimatedEffortClass: "UNDER_1_HOUR",
      resolvedRuleIds: ruleIds,
      resolvedFindingIds: findingIds,
      affectedUrlsCount: totalAffected,
      affectedOccurrencesCount: matchedTransport.reduce((sum, f) => sum + (f.affectedOccurrences || 1), 0),
      isGlobalFix: true,
      implementationSummary: "Renew TLS certificates and update internal template URLs from http:// to https://."
    });
    ruleIds.forEach(id => processedRuleIds.add(id));
  }

  // 4. Cluster: DNS & Domain Email Records (SPF, DMARC, CAA)
  const dnsRules = ["SEC_CAA_MISSING", "SEC_SPF_MISSING", "SEC_DMARC_MISSING", "SEC_DMARC_POLICY_NONE", "SEC_DMARC_PCT_PARTIAL"];
  const matchedDns = findings.filter(f => dnsRules.includes(f.ruleId));
  if (matchedDns.length > 0) {
    const findingIds = matchedDns.map(f => f.id);
    const ruleIds = Array.from(new Set(matchedDns.map(f => f.ruleId)));
    actions.push({
      actionId: "SEC_ACT_DNS_AUTHENTICATION",
      title: "Configure Domain DNS Email & Certificate Authority Authorization Records",
      description: "Publish SPF, DMARC, and CAA records at your authoritative DNS provider to prevent email spoofing and restrict certificate issuance.",
      primaryOwner: "DNS_PROVIDER",
      secondaryOwners: ["EMAIL_ADMIN", "SITE_OWNER"],
      difficulty: "MODERATE",
      estimatedEffortClass: "UNDER_1_HOUR",
      resolvedRuleIds: ruleIds,
      resolvedFindingIds: findingIds,
      affectedUrlsCount: 1,
      affectedOccurrencesCount: matchedDns.length,
      isGlobalFix: true,
      implementationSummary: "Add distinct DNS records in your domain DNS management portal: individual TXT records for SPF and _dmarc, and separate CAA record(s) for your certificate authority."
    });
    ruleIds.forEach(id => processedRuleIds.add(id));
  }

  // 5. Cluster: Forms & Cookie Security
  const appRules = [
    "SEC_FORM_HTTPS_TO_HTTP",
    "SEC_PASSWORD_FORM_OVER_HTTP",
    "SEC_PASSWORD_FIELD_USING_GET",
    "SEC_SENSITIVE_GET_FORM",
    "SEC_COOKIE_SECURE_MISSING",
    "SEC_COOKIE_HTTPONLY_MISSING",
    "SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE",
    "SEC_COOKIE_HOST_PREFIX_INVALID",
    "SEC_COOKIE_SECURE_PREFIX_INVALID",
    "SEC_COOKIE_SENT_OVER_INSECURE_TRANSPORT",
    "SEC_CORS_WILDCARD_WITH_CREDENTIALS",
    "SEC_X_POWERED_BY_DISCLOSURE",
    "SEC_SERVER_VERSION_DISCLOSURE",
  ];
  const matchedApp = findings.filter(f => appRules.includes(f.ruleId));
  if (matchedApp.length > 0) {
    const findingIds = matchedApp.map(f => f.id);
    const ruleIds = Array.from(new Set(matchedApp.map(f => f.ruleId)));
    const totalAffected = Array.from(new Set(matchedApp.flatMap(f => f.affectedUrls || []))).length;
    actions.push({
      actionId: "SEC_ACT_APPLICATION_SECURITY",
      title: "Harden Application Forms, Session Cookies & Suppress Technology Disclosure",
      description: "Update backend application cookie flags, ensure forms submit via POST over HTTPS, and suppress framework disclosure headers.",
      primaryOwner: "APPLICATION",
      secondaryOwners: ["DEVELOPER"],
      difficulty: "MODERATE",
      estimatedEffortClass: "UNDER_1_HOUR",
      resolvedRuleIds: ruleIds,
      resolvedFindingIds: findingIds,
      affectedUrlsCount: totalAffected,
      affectedOccurrencesCount: matchedApp.reduce((sum, f) => sum + (f.affectedOccurrences || 1), 0),
      isGlobalFix: false,
      implementationSummary: "Update session cookie options and form markup in your application codebase."
    });
    ruleIds.forEach(id => processedRuleIds.add(id));
  }

  // 6. Remaining Unclustered Individual Findings
  for (const f of findings) {
    if (!processedRuleIds.has(f.ruleId)) {
      const rem = remByRule.get(f.ruleId);
      const owner = rem?.ownership[0] || "DEVELOPER";
      actions.push({
        actionId: `SEC_ACT_${f.ruleId}`,
        title: f.title,
        description: rem?.recommendedAction || f.description,
        primaryOwner: owner,
        secondaryOwners: rem?.ownership.slice(1),
        difficulty: rem?.difficulty || "MODERATE",
        estimatedEffortClass: rem?.estimatedEffortClass || "UNDER_1_HOUR",
        resolvedRuleIds: [f.ruleId],
        resolvedFindingIds: [f.id],
        affectedUrlsCount: f.affectedUrls?.length || 1,
        affectedOccurrencesCount: f.affectedOccurrences || 1,
        isGlobalFix: rem?.globalEfficiency.isGlobalFix || false,
        implementationSummary: rem?.exactRecommendedChange || f.description
      });
      processedRuleIds.add(f.ruleId);
    }
  }

  // Group by owner
  const actionsByOwner: Record<SecurityOwnership, SecurityImplementationAction[]> = {
    SITE_OWNER: [],
    CONTENT_EDITOR: [],
    DEVELOPER: [],
    CMS_ADMIN: [],
    APPLICATION: [],
    WEB_SERVER: [],
    CDN: [],
    DNS_PROVIDER: [],
    HOSTING_PROVIDER: [],
    EMAIL_ADMIN: [],
    THIRD_PARTY_PROVIDER: [],
    PLATFORM_CONTROLLED: [],
  };

  for (const a of actions) {
    if (actionsByOwner[a.primaryOwner]) {
      actionsByOwner[a.primaryOwner].push(a);
    } else {
      actionsByOwner.DEVELOPER.push(a);
    }
  }

  return {
    totalActions: actions.length,
    totalResolvedFindings: findings.length,
    actionsByOwner,
    actions,
    globalActionsCount: actions.filter(a => a.isGlobalFix).length,
  };
}
