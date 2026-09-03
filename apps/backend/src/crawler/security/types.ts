/**
 * Security Evidence Architecture Type Definitions (SECURITY S1).
 * Defines authoritative fact models for Website Security Posture auditing.
 * 
 * NOTE: Fact models contain ONLY authoritative observed data.
 * Rule evaluation, severity, scoring, remediation, and PASS/FAIL logic belong to later stages (S2+).
 */

import type { SupportedPlatform } from "../fix-intelligence/types";

export type SecurityCapabilityStatus =
  | "AVAILABLE"
  | "NOT_AVAILABLE"
  | "NOT_OBSERVABLE"
  | "ERROR";

export interface SecurityCapabilities {
  tlsCertificateInspection: SecurityCapabilityStatus;
  tlsNegotiatedCipher: SecurityCapabilityStatus;
  tlsDeprecatedProtocolProbing: SecurityCapabilityStatus; // NOT_AVAILABLE unless active multi-protocol handshake performed
  securityHeaderAnalysis: SecurityCapabilityStatus;
  cspDirectiveParsing: SecurityCapabilityStatus;
  hstsDirectiveParsing: SecurityCapabilityStatus;
  cookieAttributeInspection: SecurityCapabilityStatus;
  mixedContentDetection: SecurityCapabilityStatus;
  formTransportInspection: SecurityCapabilityStatus;
  thirdPartyOriginInventory: SecurityCapabilityStatus;
  subresourceIntegrityObservation: SecurityCapabilityStatus;
  dnsCaaInspection: SecurityCapabilityStatus;
  dnsSpfDmarcInspection: SecurityCapabilityStatus;
  dnssecValidation: SecurityCapabilityStatus; // NOT_OBSERVABLE without DO-flag resolver / validating recursive stub
  safeSensitiveFileProbing: SecurityCapabilityStatus;
  frameworkVersionObservation: SecurityCapabilityStatus;
  activeExploitationTesting: SecurityCapabilityStatus; // Always NOT_AVAILABLE (passive auditing only)
}

export type FactScope =
  | "URL"
  | "RESOURCE"
  | "ORIGIN"
  | "HOST"
  | "DOMAIN"
  | "SITE";

/**
 * URL / HTTP Response Security Facts (Scoped to individual HTTP response)
 */
export interface UrlResponseSecurityFacts {
  requestedUrl: string;
  finalUrl: string;
  protocol: "http:" | "https:" | string;
  hostname: string;
  origin: string;
  httpStatus: number;
  isRedirect: boolean;
  redirectChain: Array<{ statusCode: number; fromUrl: string; toUrl: string }>;
  contentType: string;
  rawHeaders: Record<string, string | string[] | undefined>;
  redactedHeaders: Record<string, string | string[] | undefined>;
  responseTimestamp: string;
  isHttps: boolean;
  isInsecureHttp: boolean;
}

/**
 * CSP Directives Fact Model
 */
export interface CspDirectiveFact {
  directiveName: string;
  rawValues: string[];
  hasUnsafeInline: boolean;
  hasUnsafeEval: boolean;
  hasUnsafeHashes: boolean;
  hasStrictDynamic: boolean;
  hasWildcard: boolean;
  hasHttpSource: boolean;
  hasDataUri: boolean;
  hasNone: boolean;
  hasSelf: boolean;
  sources: string[];
}

export interface CspHeaderFact {
  rawHeader: string;
  isReportOnly: boolean;
  isEnforced: boolean;
  parsedSuccessfully: boolean;
  parseErrors: string[];
  directives: Record<string, CspDirectiveFact>;
  directiveCount: number;
  hasDefaultSrc: boolean;
  hasScriptSrc: boolean;
  hasStyleSrc: boolean;
  hasObjectSrc: boolean;
  hasBaseUri: boolean;
  hasFrameAncestors: boolean;
  hasUpgradeInsecureRequests: boolean;
  hasBlockAllMixedContent: boolean;
  reportUri?: string | null;
  reportTo?: string | null;
}

/**
 * HSTS Fact Model
 */
export interface HstsHeaderFact {
  rawHeader: string;
  parsedSuccessfully: boolean;
  parseErrors: string[];
  maxAgeSeconds: number | null;
  maxAgeDays: number | null;
  includeSubDomains: boolean;
  preload: boolean;
  isZeroMaxAge: boolean;
  isMalformed: boolean;
}

/**
 * Security Headers Facts for a single response
 */
export interface ResponseSecurityHeadersFacts {
  cspEnforced: CspHeaderFact[];
  cspReportOnly: CspHeaderFact[];
  hsts: HstsHeaderFact | null;
  xContentTypeOptions: {
    raw: string | null;
    isNoSniff: boolean;
    isMalformed: boolean;
  } | null;
  referrerPolicy: {
    raw: string | null;
    tokens: string[];
    hasNoReferrer: boolean;
    hasStrictOriginWhenCrossOrigin: boolean;
    hasUnsafeUrl: boolean;
    hasNoReferrerWhenDowngrade: boolean;
  } | null;
  permissionsPolicy: {
    raw: string | null;
    parsedDirectives: Record<string, string[]>;
    directiveCount: number;
  } | null;
  xFrameOptions: {
    raw: string | null;
    normalized: "DENY" | "SAMEORIGIN" | "ALLOW-FROM" | "OTHER" | null;
    isDeny: boolean;
    isSameOrigin: boolean;
    isMalformed: boolean;
  } | null;
  cors: {
    allowOriginRaw: string | null;
    isWildcardOrigin: boolean;
    isSpecificOrigin: boolean;
    allowCredentialsRaw: string | null;
    isAllowCredentialsTrue: boolean;
    isDangerousWildcardCredentialsCombination: boolean;
    allowMethods: string[];
    allowHeaders: string[];
    exposeHeaders: string[];
  };
  coop: {
    raw: string | null;
    normalized: "same-origin" | "same-origin-allow-popups" | "unsafe-none" | "other" | null;
  } | null;
  corp: {
    raw: string | null;
    normalized: "same-origin" | "same-site" | "cross-origin" | "other" | null;
  } | null;
  coep: {
    raw: string | null;
    normalized: "require-corp" | "credentialless" | "unsafe-none" | "other" | null;
  } | null;
  serverDisclosure: {
    rawServer: string | null;
    rawXPoweredBy: string | null;
    hasServerHeader: boolean;
    hasXPoweredBy: boolean;
    disclosedTechnologies: string[];
  };
}

/**
 * Cookie Security Facts
 */
export interface CookieSecurityFact {
  cookieName: string;
  redactedValue: string;
  rawLength: number;
  isSecure: boolean;
  isHttpOnly: boolean;
  sameSite: "Strict" | "Lax" | "None" | "unspecified" | "invalid";
  rawSameSite: string | null;
  domain: string | null;
  isDomainExplicit: boolean;
  isDomainBroad: boolean; // e.g. domain=.example.com vs host-only
  path: string | null;
  maxAgeSeconds: number | null;
  expires: string | null;
  hasHostPrefix: boolean; // __Host-
  hasSecurePrefix: boolean; // __Secure-
  isHostPrefixValid: boolean; // __Host- requires Secure, Path=/, and no Domain attribute
  isSecurePrefixValid: boolean; // __Secure- requires Secure
  isSameSiteNoneWithoutSecure: boolean;
  setOverInsecureTransport: boolean;
  sourceUrl: string;
  sourceOrigin: string;
  isSuspectedSessionOrAuth: boolean;
}

/**
 * Resource Security Facts
 */
export type SecurityResourceType =
  | "script"
  | "stylesheet"
  | "image"
  | "font"
  | "iframe"
  | "audio"
  | "video"
  | "fetch_xhr"
  | "other";

export interface ResourceSecurityFact {
  rawUrl: string;
  resolvedAbsoluteUrl: string;
  resourceOrigin: string;
  resourceType: SecurityResourceType;
  isFirstParty: boolean;
  isThirdParty: boolean;
  isHttps: boolean;
  isInsecureHttp: boolean;
  sourcePageUrl: string;
  sourcePageIsHttps: boolean;
  isMixedContent: boolean;
  isMixedActiveContent: boolean; // script, stylesheet, iframe
  isMixedPassiveContent: boolean; // image, font, media
  hasIntegrity: boolean;
  integrityAttribute: string | null;
  hasValidSriHash: boolean; // sha256-, sha384-, sha512-
  crossOriginAttribute: string | null;
  domSelector?: string | null;
}

/**
 * Form Security Facts
 */
export interface FormSecurityFact {
  sourcePageUrl: string;
  sourcePageIsHttps: boolean;
  formId?: string | null;
  rawAction: string | null;
  resolvedAbsoluteActionUrl: string;
  actionOrigin: string;
  actionIsHttps: boolean;
  actionIsInsecureHttp: boolean;
  isCrossDomainAction: boolean;
  method: "GET" | "POST" | "PUT" | "DELETE" | "DIALOG" | "UNKNOWN";
  hasPasswordInput: boolean;
  passwordInputCount: number;
  hasFileInput: boolean;
  fileInputCount: number;
  hasSensitiveInputInGetForm: boolean;
  inputs: Array<{
    type: string;
    name?: string | null;
    id?: string | null;
    autocomplete?: string | null;
    isPassword: boolean;
    isSensitive: boolean;
  }>;
  hasVisibleCsrfTokenCandidate: boolean;
  csrfTokenNameCandidate?: string | null;
}

/**
 * Host TLS & Certificate Facts (Cached per Hostname:Port)
 */
export interface TlsCertificateSubject {
  commonName: string | null;
  organization: string | null;
  organizationalUnit: string | null;
  country: string | null;
}

export interface TlsCertificateIssuer {
  commonName: string | null;
  organization: string | null;
  country: string | null;
}

export interface HostTlsSecurityFacts {
  host: string;
  port: number;
  inspectedSuccessfully: boolean;
  isHttpsAvailable: boolean;
  inspectionError?: string | null;
  inspectionTimestamp: string;
  certificate?: {
    subject: TlsCertificateSubject;
    issuer: TlsCertificateIssuer;
    subjectAltNames: string[];
    validFrom: string;
    validTo: string;
    validFromTimestamp: number;
    validToTimestamp: number;
    daysRemaining: number;
    isExpired: boolean;
    isExpiringSoon: boolean; // <= 30 days
    isNotYetValid: boolean;
    fingerprint256: string;
    serialNumber: string;
    isHostnameMatch: boolean;
    hostnameMatchReason?: string;
  };
  connection?: {
    authorized: boolean;
    authorizationError?: string | null;
    negotiatedProtocol: string | null; // e.g. "TLSv1.3", "TLSv1.2"
    negotiatedCipher: {
      name: string;
      version?: string;
    } | null;
    ephemeralKeyInfo?: Record<string, unknown> | null;
  };
  protocolSupport: {
    testedProtocols: string[];
    // S1 note: Active testing of deprecated protocols is explicitly tracked
    isDeprecatedProtocolProbed: boolean;
  };
}

/**
 * Domain & DNS Security Facts (Scoped to Domain/Host)
 */
export interface DomainDnsSecurityFacts {
  domain: string;
  host: string;
  queryTimestamp: string;
  dnsResolverStatus: "SUCCESS" | "PARTIAL" | "ERROR";
  resolverErrorMessage?: string | null;
  caaRecords: Array<{
    flags: number;
    tag: string;
    value: string;
  }>;
  hasCaaRecord: boolean;
  txtRecords: string[][];
  spfRecords: string[];
  hasSpfRecord: boolean;
  isSpfSyntacticallyValid: boolean;
  dmarcRecord: string | null;
  hasDmarcRecord: boolean;
  dmarcPolicy: "none" | "quarantine" | "reject" | "unspecified" | "invalid";
  dmarcSubdomainPolicy?: "none" | "quarantine" | "reject" | null;
  dmarcPercentage?: number | null;
  dmarcRua?: string[] | null;
  dmarcRuf?: string[] | null;
  dnssec: {
    capability: SecurityCapabilityStatus; // NOT_OBSERVABLE in standard Node resolver
    status: "CONFIRMED_ENABLED" | "CONFIRMED_DISABLED" | "NOT_OBSERVABLE" | "QUERY_ERROR";
    details: string;
  };
}

/**
 * Third-Party Origin Inventory (Site-Wide Aggregated)
 */
export interface ThirdPartyOriginFact {
  origin: string;
  hostname: string;
  resourceCount: number;
  resourceTypes: SecurityResourceType[];
  affectedPagesCount: number;
  sampleResourceUrls: string[];
  samplePageUrls: string[];
  isHttps: boolean;
  hasInsecureHttpResources: boolean;
  sriCoverage: {
    totalApplicableResources: number; // scripts and styles
    resourcesWithSri: number;
    resourcesWithoutSri: number;
  };
}

export interface ThirdPartyInventoryFacts {
  totalUniqueOrigins: number;
  thirdPartyOriginsCount: number;
  firstPartyOriginsCount: number;
  totalThirdPartyResources: number;
  thirdPartyOrigins: ThirdPartyOriginFact[];
}

/**
 * Safe Bounded Probes Fact Model
 */
export type SafeProbeTargetType =
  | "ENV_FILE"
  | "GIT_HEAD"
  | "DS_STORE"
  | "SOURCE_MAP"
  | "BACKUP_CONFIG";

export interface SafeProbeResultFact {
  targetType: SafeProbeTargetType;
  requestedUrl: string;
  path: string;
  httpStatus: number;
  contentType: string | null;
  byteLength: number;
  isSoft404: boolean;
  signatureMatched: boolean;
  signatureType?: string;
  isConfirmedExposed: boolean; // HTTP 200 + signature match + NOT soft 404
  responseFingerprintSha256: string;
  redactedEvidenceSnippet: string;
  checkedAt: string;
}

/**
 * Platform Security Evidence (Reused from core platform detection)
 */
export interface PlatformSecurityFacts {
  detectedPlatform: SupportedPlatform;
  confidence: number;
  signals: string[];
  isHighConfidence: boolean;
  ownershipScope: "USER_CONFIGURABLE" | "PLATFORM_HOSTING_CONTROLLED" | "HYBRID" | "UNKNOWN";
}

export interface SecurityTxtFacts {
  hasSecurityTxt: boolean;
  requestedUrl: string;
  httpStatus: number;
  isHttps: boolean;
  contact: string[];
  expires: string | null;
  isExpired: boolean;
  canonical: string | null;
  policy: string | null;
  encryption: string | null;
  acknowledgments: string | null;
  preferredLanguages: string | null;
  rawText: string | null;
}

export interface SecurityAdvisoryFacts {
  isProviderConfigured: boolean;
  providerId: string | null;
  advisoriesByPackage: Record<string, any[]>;
  totalKnownVulnerabilities: number;
}

/**
 * Complete Aggregated Security Facts Container (SECURITY S1 Output)
 */
export interface SecurityAuditFacts {
  targetDomain: string;
  seedUrl: string;
  auditTimestamp: string;
  capabilities: SecurityCapabilities;
  urlFacts: Map<string, UrlResponseSecurityFacts> | Record<string, UrlResponseSecurityFacts>;
  securityHeadersByUrl: Record<string, ResponseSecurityHeadersFacts>;
  cookies: CookieSecurityFact[];
  resources: ResourceSecurityFact[];
  mixedContentOccurrences: ResourceSecurityFact[];
  forms: FormSecurityFact[];
  tlsByHost: Record<string, HostTlsSecurityFacts>;
  dnsByDomain: Record<string, DomainDnsSecurityFacts>;
  thirdPartyInventory: ThirdPartyInventoryFacts;
  safeProbes: SafeProbeResultFact[];
  platform: PlatformSecurityFacts;
  securityTxt?: SecurityTxtFacts | null;
  advisories?: SecurityAdvisoryFacts | null;
}

