/**
 * Comprehensive Security Fix Intelligence Generator (SECURITY S4).
 * Translates certified security findings into structured, progressive, actionable remediation blueprints.
 */

import type { SecurityFinding } from "../rule-types";
import type { SecurityAuditFacts } from "../types";
import type {
  SecurityRemediation,
  SecurityPlatformType,
  SecurityOwnership,
  SecurityRemediationScope,
  SecurityFixDifficulty,
  SecurityEffortClass,
  SecurityPlatformInstruction,
  SecurityCodeExample,
  SecurityReference,
} from "./remediation-types";
import { getWebflowInstruction } from "./platform-adapters/webflow-adapter";
import { getWordPressInstruction } from "./platform-adapters/wordpress-adapter";
import { getNextJsInstruction } from "./platform-adapters/nextjs-adapter";
import { getShopifyInstruction } from "./platform-adapters/shopify-adapter";
import { getServerCdnInstructions } from "./platform-adapters/server-cdn-adapter";

/**
 * Maps detected platform string to SecurityPlatformType enum.
 */
export function resolvePlatformType(facts: SecurityAuditFacts, override?: SecurityPlatformType): SecurityPlatformType {
  if (override) return override;
  const plat = (facts.platform?.detectedPlatform || "").toLowerCase();
  if (plat.includes("webflow")) return "WEBFLOW";
  if (plat.includes("wordpress") || plat.includes("wp")) return "WORDPRESS";
  if (plat.includes("next")) return "NEXT_JS";
  if (plat.includes("shopify")) return "SHOPIFY";
  return "GENERIC";
}

/**
 * Generates an exhaustive SecurityRemediation blueprint for a given SecurityFinding.
 */
export function generateSecurityRemediation(
  finding: SecurityFinding,
  facts: SecurityAuditFacts,
  platformOverride?: SecurityPlatformType
): SecurityRemediation {
  const detectedPlatform = resolvePlatformType(facts, platformOverride);
  const ruleId = finding.ruleId;
  const affectedCount = finding.affectedUrls?.length || 1;
  const occurrencesCount = finding.affectedOccurrences || affectedCount;

  // 1. Compile Platform Instructions
  const platformInstructions: SecurityPlatformInstruction[] = [];
  const webflowInst = getWebflowInstruction(ruleId);
  const wpInst = getWordPressInstruction(ruleId);
  const nextInst = getNextJsInstruction(ruleId);
  const shopifyInst = getShopifyInstruction(ruleId);
  const serverCdnInsts = getServerCdnInstructions(ruleId);

  if (detectedPlatform === "WEBFLOW" && webflowInst) platformInstructions.push(webflowInst);
  else if (detectedPlatform === "WORDPRESS" && wpInst) platformInstructions.push(wpInst);
  else if (detectedPlatform === "NEXT_JS" && nextInst) platformInstructions.push(nextInst);
  else if (detectedPlatform === "SHOPIFY" && shopifyInst) platformInstructions.push(shopifyInst);

  // Always append server / CDN variants if applicable
  for (const s of serverCdnInsts) {
    if (!platformInstructions.some(p => p.platform === s.platform)) {
      platformInstructions.push(s);
    }
  }

  // 2. Build Base Remediation Schema depending on Rule Family
  return buildRuleSpecificRemediation(finding, facts, detectedPlatform, platformInstructions);
}

function buildRuleSpecificRemediation(
  finding: SecurityFinding,
  facts: SecurityAuditFacts,
  platform: SecurityPlatformType,
  platformInstructions: SecurityPlatformInstruction[]
): SecurityRemediation {
  const ruleId = finding.ruleId;
  const affectedUrls = finding.affectedUrls || [];
  const affectedCount = affectedUrls.length || 1;
  const occurrencesCount = finding.affectedOccurrences || affectedCount;

  // Global scope intelligence formatting
  const isGlobalFix = finding.scope === "HOST" || finding.scope === "DOMAIN" || finding.scope === "SITE";
  const globalEfficiency = {
    isGlobalFix,
    fixOnce: isGlobalFix,
    affectedUrlsCount: affectedCount,
    affectedOccurrencesCount: occurrencesCount,
    scope: (finding.scope || "PAGE") as SecurityRemediationScope,
    explanation: isGlobalFix
      ? `1 ${finding.scope.toLowerCase()} configuration change resolves this issue across all ${affectedCount} affected URL(s).`
      : `Resolve on the specific affected resource or page component.`,
  };

  // Switch by Rule Category
  switch (ruleId) {
    // -------------------------------------------------------------
    // 1. TRANSPORT & HTTPS
    // -------------------------------------------------------------
    case "SEC_HTTPS_UNAVAILABLE":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "The website does not support HTTPS connections on port 443.",
        simpleExplanation: "Your website cannot be accessed securely using HTTPS. Visitors and browsers will see security warnings.",
        whatIsWrong: `Port 443 on host ${facts.targetDomain} is either closed, refusing connections, or not listening for TLS handshakes.`,
        whyItMatters: "Without HTTPS, all data transmitted between visitors and the website (passwords, cookies, form data) travels in plaintext across public networks.",
        evidenceExplanation: `Connection attempt to https://${facts.targetDomain}:443 failed: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "This affects all connections to this host.",
        actionability: "PROVIDER_ACTIONABLE",
        ownership: ["WEB_SERVER", "HOSTING_PROVIDER", "CDN"],
        recommendedAction: "Provision a valid TLS certificate and enable HTTPS on your web server or CDN.",
        exactRecommendedChange: "Enable SSL/TLS termination on port 443 and attach a recognized certificate.",
        implementationSteps: [
          "Request a free TLS certificate via Let's Encrypt or your hosting provider.",
          "Bind port 443 to your web server (Nginx/Apache) or enable HTTPS in your CDN dashboard (Cloudflare).",
          "Verify the HTTPS listener responds with a valid certificate handshake."
        ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "Nginx SSL Server Block",
            language: "nginx",
            code: `server {\n  listen 443 ssl http2;\n  server_name ${facts.targetDomain};\n  ssl_certificate /etc/letsencrypt/live/${facts.targetDomain}/fullchain.pem;\n  ssl_certificate_key /etc/letsencrypt/live/${facts.targetDomain}/privkey.pem;\n}`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "Ensure private keys are kept secure with strict file permissions (chmod 600)."
        ],
        prerequisites: ["DNS A/AAAA records correctly point to the server IP."],
        verificationSteps: ["Connect to https://yourdomain.com in a browser and verify a secure padlock."],
        automatedVerification: {
          supported: true,
          method: "TLS_HANDSHAKE",
          requiredFacts: ["tlsByHost"],
          successCondition: "Port 443 connects successfully with a valid authorized certificate.",
          failureCondition: "Connection refused, timeout, or TLS handshake error on port 443."
        },
        expectedImpact: "Enables encrypted communication for all site visitors and removes browser security warnings.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "MODERATE",
        estimatedEffortClass: "UNDER_1_HOUR",
        references: [
          { title: "MDN HTTPS Overview", url: "https://developer.mozilla.org/en-US/docs/Glossary/HTTPS", source: "MDN" }
        ],
        limitations: []
      };

    case "SEC_HTTP_NO_HTTPS_REDIRECT":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "Plaintext HTTP requests do not automatically redirect to HTTPS.",
        simpleExplanation: "When someone visits the non-secure 'http://' version of your site, they stay on HTTP instead of automatically moving to secure 'https://'.",
        whatIsWrong: `${affectedCount} HTTP URL(s) responded with HTTP 200 without redirecting to HTTPS.`,
        whyItMatters: "Users typing your domain directly into a browser may accidentally browse over insecure plaintext.",
        evidenceExplanation: `HTTP URLs did not issue a 301/308 redirect to HTTPS: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "Configured globally on the HTTP (port 80) server block or CDN edge.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["WEB_SERVER", "CDN"],
        recommendedAction: "Add an automatic 301/308 permanent redirect from HTTP to HTTPS.",
        exactRecommendedChange: "Redirect all port 80 HTTP traffic to https://$host$request_uri.",
        implementationSteps: [
          "Open your web server configuration for port 80.",
          "Add a 301 permanent redirect rule to HTTPS.",
          "Test with `curl -IL http://yourdomain.com`."
        ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "Nginx HTTP to HTTPS 301 Redirect",
            language: "nginx",
            code: `server {\n  listen 80;\n  server_name ${facts.targetDomain} www.${facts.targetDomain};\n  return 301 https://$host$request_uri;\n}`,
            context: "CONFIG"
          },
          {
            title: "Apache HTTP to HTTPS Redirect (.htaccess)",
            language: "apache",
            code: `RewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "Ensure your HTTPS site is fully functional before enforcing redirects to prevent redirect loops."
        ],
        prerequisites: ["HTTPS is working on port 443."],
        verificationSteps: ["Request the HTTP URL and verify a 301 response pointing to HTTPS."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["urlFacts"],
          successCondition: "HTTP request returns 301/302/308 redirect pointing to https://.",
          failureCondition: "HTTP request returns status 200 or points to an insecure destination."
        },
        expectedImpact: "Guarantees all traffic is upgraded to secure transport.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "Nginx HTTP to HTTPS Redirection", url: "https://nginx.org/en/docs/http/converting_rewrite_rules.html", source: "PLATFORM_DOCS" }
        ],
        limitations: []
      };

    case "SEC_MIXED_ACTIVE_CONTENT":
    case "SEC_MIXED_PASSIVE_CONTENT":
      const isActive = ruleId === "SEC_MIXED_ACTIVE_CONTENT";
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: `HTTPS pages load ${isActive ? "active scripts/stylesheets" : "passive images/media"} over insecure HTTP.`,
        simpleExplanation: `Your secure HTTPS page is loading ${isActive ? "code (scripts or stylesheets)" : "images"} over non-secure HTTP. Browsers will ${isActive ? "block them" : "show a broken padlock"}.`,
        whatIsWrong: `${occurrencesCount} insecure resource(s) loaded on secure HTTPS pages.`,
        whyItMatters: isActive
          ? "Active mixed content (scripts/styles) can be intercepted and modified by attackers on insecure networks to execute malicious code."
          : "Passive mixed content allows network eavesdroppers to track images and weakens browser connection indicators.",
        evidenceExplanation: `Observed insecure resources: ${JSON.stringify(finding.evidence)}`,
        scope: "RESOURCE",
        scopeExplanation: "Applies to the specific embedded resource URLs.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["DEVELOPER", "CONTENT_EDITOR"],
        recommendedAction: "Update resource URLs to use `https://` or host them locally.",
        exactRecommendedChange: "Change `http://` to `https://` for all internal and external asset URLs.",
        implementationSteps: [
          "Locate the HTML template or custom code embed containing the `http://` asset URL.",
          "Check if the host supports HTTPS by loading the asset with `https://` in a browser tab.",
          "Update the URL in your template or CMS content."
        ],
        codeExamples: [
          {
            title: "Asset URL Protocol Fix",
            language: "html",
            code: `<!-- Before: Insecure -->\n<script src="http://cdn.example.com/app.js"></script>\n\n<!-- After: Secure -->\n<script src="https://cdn.example.com/app.js"></script>`,
            context: "RECOMMENDED"
          }
        ],
        configurationExamples: [],
        platformInstructions,
        risksAndCautions: [
          "Verify the external CDN supports HTTPS before switching; if not, download the file and serve it locally."
        ],
        prerequisites: [],
        verificationSteps: ["Reload the page and check the browser console for mixed content warnings."],
        automatedVerification: {
          supported: true,
          method: "RE_CRAWL_PAGE",
          requiredFacts: ["mixedContentOccurrences", "resources"],
          successCondition: "All page resources on HTTPS pages use https:// or relative paths.",
          failureCondition: "One or more resources on HTTPS pages use http://."
        },
        expectedImpact: "Prevents browser script blocking and maintains full green padlock integrity.",
        affectedUrls,
        affectedResources: finding.affectedResources,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "MDN Mixed Content", url: "https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content", source: "MDN" }
        ],
        limitations: []
      };

    case "SEC_CERT_EXPIRED":
    case "SEC_CERT_EXPIRING_SOON":
    case "SEC_CERT_HOSTNAME_MISMATCH":
    case "SEC_TLS_CERTIFICATE_UNVERIFIED":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: `TLS certificate issue detected on host ${facts.targetDomain}.`,
        simpleExplanation: "There is an issue with your website's SSL/TLS certificate. Browsers will display a full-page security warning.",
        whatIsWrong: `The certificate for ${facts.targetDomain} is ${ruleId === "SEC_CERT_EXPIRED" ? "expired" : ruleId === "SEC_CERT_HOSTNAME_MISMATCH" ? "issued for a different domain" : "invalid or expiring soon"}.`,
        whyItMatters: "Browsers immediately block visitors with an interstitial security warning when TLS validation fails.",
        evidenceExplanation: `TLS certificate details: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "Affects all HTTPS connections to this hostname.",
        actionability: "PROVIDER_ACTIONABLE",
        ownership: ["HOSTING_PROVIDER", "WEB_SERVER", "CDN"],
        recommendedAction: "Renew, re-issue, or replace the TLS certificate covering all required hostnames.",
        exactRecommendedChange: "Install a valid certificate covering the exact domain and `www` subdomain.",
        implementationSteps: [
          "Check your certificate management tool (Certbot, Let's Encrypt, or Hosting Panel).",
          "Ensure the Subject Alternative Name (SAN) list includes both `domain.com` and `www.domain.com`.",
          "Renew and deploy the new certificate."
        ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "Certbot Renewal Command",
            language: "bash",
            code: `certbot certonly --nginx -d ${facts.targetDomain} -d www.${facts.targetDomain}`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "Ensure automated renewal cron jobs or systemd timers are enabled to avoid future expiry."
        ],
        prerequisites: ["Domain DNS is properly configured."],
        verificationSteps: ["Inspect the certificate in browser DevTools Security tab to verify validity dates and SAN list."],
        automatedVerification: {
          supported: true,
          method: "TLS_HANDSHAKE",
          requiredFacts: ["tlsByHost"],
          successCondition: "Certificate is valid, not expired, authorized, and matches the target hostname.",
          failureCondition: "Certificate is expired, hostname mismatch, or untrusted issuer."
        },
        expectedImpact: "Restores seamless browser access without interstitial warning screens.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "MODERATE",
        estimatedEffortClass: "UNDER_1_HOUR",
        references: [
          { title: "Let's Encrypt Getting Started", url: "https://letsencrypt.org/getting-started/", source: "PLATFORM_DOCS" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 2. HSTS RULES
    // -------------------------------------------------------------
    case "SEC_HSTS_MISSING":
    case "SEC_HSTS_SHORT_MAX_AGE":
    case "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING":
    case "SEC_HSTS_PRELOAD_NOT_ENABLED":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "HTTP Strict Transport Security (HSTS) header is missing or sub-optimally configured.",
        simpleExplanation: "Your site uses HTTPS, but does not tell browsers to always enforce HTTPS for future visits. Adding HSTS protects against downgrade attacks.",
        whatIsWrong: ruleId === "SEC_HSTS_MISSING"
          ? "No Strict-Transport-Security response header was observed on HTTPS responses."
          : `HSTS header was observed but ${ruleId === "SEC_HSTS_SHORT_MAX_AGE" ? "max-age is under 180 days" : "is missing includeSubDomains or preload"}.`,
        whyItMatters: "HSTS instructs browsers to automatically convert all insecure http:// requests to https:// before making the network request, mitigating SSL-stripping man-in-the-middle attacks.",
        evidenceExplanation: `HSTS evaluation details: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "Configured as a global response header on your web server or CDN.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["WEB_SERVER", "CDN", "HOSTING_PROVIDER"],
        recommendedAction: "Add or update the Strict-Transport-Security response header with max-age=31536000; includeSubDomains.",
        exactRecommendedChange: "Add header `Strict-Transport-Security: max-age=31536000; includeSubDomains` to all HTTPS responses.",
        implementationSteps: [
          "Staged rollout: Start with `max-age=300` (5 minutes) in testing.",
          "Verify all subdomains support HTTPS.",
          "Increase to `max-age=31536000` (1 year) with `includeSubDomains`.",
          "Optionally add `preload` after confirming long-term HTTPS commitment."
        ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "Nginx HSTS Directive",
            language: "nginx",
            code: `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`,
            context: "CONFIG"
          },
          {
            title: "Apache HSTS (.htaccess)",
            language: "apache",
            code: `<IfModule mod_headers.c>\n  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"\n</IfModule>`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "CAUTION: `includeSubDomains` applies to ALL subdomains (e.g. mail.domain.com, staging.domain.com). Ensure all subdomains support HTTPS before enabling.",
          "CAUTION: Preloading is a high-commitment configuration that registers your domain into browser preloaded HSTS lists. Reversal or removal is slow because browser vendor updates must propagate."
        ],
        prerequisites: ["All subdomains must have valid HTTPS certificates."],
        verificationSteps: ["Inspect response headers using `curl -IL https://yourdomain.com` to verify Strict-Transport-Security."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["securityHeadersByUrl"],
          successCondition: "Strict-Transport-Security header present with max-age >= 15552000.",
          failureCondition: "Strict-Transport-Security header absent or max-age < 15552000."
        },
        expectedImpact: "Enforces browser-level HTTPS downgrade protection.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "MDN Strict-Transport-Security", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security", source: "MDN" },
          { title: "HSTS Preload Submission", url: "https://hstspreload.org/", source: "PLATFORM_DOCS" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 3. CONTENT-SECURITY-POLICY
    // -------------------------------------------------------------
    case "SEC_CSP_MISSING":
    case "SEC_CSP_REPORT_ONLY_WITHOUT_ENFORCED_POLICY":
    case "SEC_CSP_UNSAFE_INLINE":
    case "SEC_CSP_UNSAFE_EVAL":
    case "SEC_CSP_BROAD_WILDCARD_SOURCE":
    case "SEC_CSP_OBJECT_SRC_UNRESTRICTED":
    case "SEC_CSP_BASE_URI_MISSING":
    case "SEC_CSP_MALFORMED":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "Content-Security-Policy (CSP) is absent or contains permissive/insecure directives.",
        simpleExplanation: "Your site does not define a strict list of allowed scripts and resources. A Content-Security-Policy header provides defense-in-depth against unauthorized script execution.",
        whatIsWrong: ruleId === "SEC_CSP_MISSING"
          ? "No enforced Content-Security-Policy header was observed."
          : `CSP policy contains ${ruleId === "SEC_CSP_UNSAFE_INLINE" ? "'unsafe-inline'" : ruleId === "SEC_CSP_UNSAFE_EVAL" ? "'unsafe-eval'" : "broad wildcards or missing object-src/base-uri"}.`,
        whyItMatters: "CSP restricts where scripts, styles, images, and fonts can load from, greatly reducing the risk and impact of Cross-Site Scripting (XSS) and data injection attacks.",
        evidenceExplanation: `CSP evaluation facts: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "Best managed globally as a response header on web server or CDN.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["DEVELOPER", "WEB_SERVER", "CDN"],
        recommendedAction: "Build, test, and deploy a tailored Content-Security-Policy header.",
        exactRecommendedChange: "Deploy a Content-Security-Policy header restricting sources to 'self', required CDNs, and disabling plugin execution.",
        implementationSteps: [
          "Inventory all third-party scripts, analytics, fonts, and embeds used across your site.",
          "Deploy a draft policy using `Content-Security-Policy-Report-Only` with a report-to endpoint to identify legitimate resources.",
          "Refine the policy by whitelisting required origins (e.g. Google Fonts, Stripe).",
          "Switch header to enforced `Content-Security-Policy` once report violations cease."
        ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "Baseline Staged CSP Header",
            language: "http",
            code: `Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted-cdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self';`,
            context: "RECOMMENDED"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "CAUTION: A restrictive CSP can break third-party widgets, analytics, chat tools, or payment gateways if their domains are omitted.",
          "Always test using `Content-Security-Policy-Report-Only` before enforcing in production."
        ],
        prerequisites: ["Comprehensive inventory of active third-party integrations."],
        verificationSteps: ["Inspect response headers and verify no CSP violations appear in the browser console."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["securityHeadersByUrl"],
          successCondition: "Enforced CSP header is present and parsed successfully.",
          failureCondition: "CSP header is missing or malformed."
        },
        expectedImpact: "Establishes browser defense-in-depth against content injection.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "ADVANCED",
        estimatedEffortClass: "PROJECT_LEVEL",
        references: [
          { title: "MDN Content Security Policy", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP", source: "MDN" },
          { title: "OWASP CSP Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html", source: "OWASP" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 4. FRAME PROTECTION & BROWSER HEADERS
    // -------------------------------------------------------------
    case "SEC_FRAME_PROTECTION_MISSING":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "No frame protection header (CSP frame-ancestors or X-Frame-Options) was observed.",
        simpleExplanation: "Other websites can embed your pages inside an invisible iframe, exposing visitors to clickjacking attacks.",
        whatIsWrong: "Neither `Content-Security-Policy: frame-ancestors ...` nor `X-Frame-Options` is configured on response headers.",
        whyItMatters: "Clickjacking allows malicious sites to load your pages in an opaque overlay and trick authenticated users into clicking unintended buttons.",
        evidenceExplanation: `Frame protection header status: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "Applies globally to web responses on this host.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["WEB_SERVER", "CDN", "DEVELOPER"],
        recommendedAction: "Add `Content-Security-Policy: frame-ancestors 'self'` (or `X-Frame-Options: DENY / SAMEORIGIN`).",
        exactRecommendedChange: "Configure `X-Frame-Options: DENY` or CSP `frame-ancestors 'self'` on response headers.",
        implementationSteps: [
          "Determine if your site intentionally needs to be embedded in external iframes.",
          "If not embedded anywhere, set `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`.",
          "If embedded only on your own domain, set `X-Frame-Options: SAMEORIGIN` or CSP `frame-ancestors 'self'`."
        ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "Nginx X-Frame-Options Directive",
            language: "nginx",
            code: `add_header X-Frame-Options "SAMEORIGIN" always;`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "If you intentionally embed your site in partner portals or SaaS dashboards, whitelist specific parent domains using CSP `frame-ancestors https://partner.com`."
        ],
        prerequisites: [],
        verificationSteps: ["Inspect headers and confirm `X-Frame-Options` or CSP `frame-ancestors` is present."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["securityHeadersByUrl"],
          successCondition: "X-Frame-Options or CSP frame-ancestors is present.",
          failureCondition: "Both X-Frame-Options and CSP frame-ancestors are absent."
        },
        expectedImpact: "Prevents unauthorized iframe embedding and clickjacking attacks.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "MDN X-Frame-Options", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options", source: "MDN" }
        ],
        limitations: []
      };

    case "SEC_X_CONTENT_TYPE_OPTIONS_MISSING":
    case "SEC_X_CONTENT_TYPE_OPTIONS_INVALID":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "X-Content-Type-Options: nosniff header is missing or malformed.",
        simpleExplanation: "Browsers may attempt to guess (MIME-sniff) the file type of responses, which can allow malicious file uploads to be executed as scripts.",
        whatIsWrong: `X-Content-Type-Options header is ${ruleId === "SEC_X_CONTENT_TYPE_OPTIONS_MISSING" ? "absent" : "not set to exact 'nosniff'"}.`,
        whyItMatters: "MIME sniffing can trick browsers into treating non-executable files (like images or user uploads) as JavaScript or CSS.",
        evidenceExplanation: `Observed header value: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "Configured globally on web server or CDN headers.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["WEB_SERVER", "CDN"],
        recommendedAction: "Add `X-Content-Type-Options: nosniff` to all HTTP responses.",
        exactRecommendedChange: "Add header `X-Content-Type-Options: nosniff`.",
        implementationSteps: [
          "Add the `X-Content-Type-Options: nosniff` directive in your server/CDN configuration.",
          "Ensure your server serves correct `Content-Type` headers for static files (e.g. `text/css`, `application/javascript`)."
        ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "Nginx nosniff Header",
            language: "nginx",
            code: `add_header X-Content-Type-Options "nosniff" always;`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "Ensure all CSS and JS files are served with accurate MIME types; `nosniff` causes browsers to strictly reject style/script files with incorrect MIME types."
        ],
        prerequisites: [],
        verificationSteps: ["Verify `X-Content-Type-Options: nosniff` in response headers."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["securityHeadersByUrl"],
          successCondition: "X-Content-Type-Options is present with value 'nosniff'.",
          failureCondition: "X-Content-Type-Options is absent or malformed."
        },
        expectedImpact: "Enforces strict MIME type adherence by modern browsers.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "MDN X-Content-Type-Options", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options", source: "MDN" }
        ],
        limitations: []
      };

    case "SEC_REFERRER_POLICY_MISSING":
    case "SEC_REFERRER_POLICY_OVERLY_PERMISSIVE":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "Referrer-Policy header is missing or set to an overly permissive policy.",
        simpleExplanation: "When visitors click external links on your site, full page URLs (including sensitive query parameters) may be leaked to external servers.",
        whatIsWrong: ruleId === "SEC_REFERRER_POLICY_MISSING"
          ? "No Referrer-Policy header was observed."
          : "Referrer-Policy is set to `unsafe-url`, leaking full URLs on cross-origin requests.",
        whyItMatters: "Full URLs often contain sensitive parameters (tokens, email addresses, search terms, user IDs). A strict referrer policy protects user privacy.",
        evidenceExplanation: `Referrer-Policy evidence: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "Configured globally via response header or `<meta>` tag.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["WEB_SERVER", "CDN", "DEVELOPER"],
        recommendedAction: "Set `Referrer-Policy: strict-origin-when-cross-origin`.",
        exactRecommendedChange: "Add `Referrer-Policy: strict-origin-when-cross-origin`.",
        implementationSteps: [
          "Add the `Referrer-Policy: strict-origin-when-cross-origin` header to your web server/CDN.",
          "Or add `<meta name=\"referrer\" content=\"strict-origin-when-cross-origin\">` inside your HTML `<head>`."
        ],
        codeExamples: [
          {
            title: "HTML Meta Referrer Policy",
            language: "html",
            code: `<meta name="referrer" content="strict-origin-when-cross-origin">`,
            context: "RECOMMENDED"
          }
        ],
        configurationExamples: [
          {
            title: "Nginx Referrer-Policy Header",
            language: "nginx",
            code: `add_header Referrer-Policy "strict-origin-when-cross-origin" always;`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [],
        prerequisites: [],
        verificationSteps: ["Inspect response headers or HTML `<head>` for the Referrer-Policy declaration."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["securityHeadersByUrl"],
          successCondition: "Referrer-Policy is set to a secure policy (strict-origin-when-cross-origin, no-referrer, same-origin).",
          failureCondition: "Referrer-Policy is missing or set to unsafe-url."
        },
        expectedImpact: "Protects sensitive URL query parameters from leaking across external origins.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "MDN Referrer-Policy", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy", source: "MDN" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 5. COOKIES & CORS
    // -------------------------------------------------------------
    case "SEC_COOKIE_SECURE_MISSING":
    case "SEC_COOKIE_HTTPONLY_MISSING":
    case "SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE":
    case "SEC_COOKIE_HOST_PREFIX_INVALID":
    case "SEC_COOKIE_SECURE_PREFIX_INVALID":
    case "SEC_COOKIE_SENT_OVER_INSECURE_TRANSPORT":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "Cookie security attribute(s) missing or improperly configured.",
        simpleExplanation: "A cookie generated by your site is missing critical security flags (like Secure, HttpOnly, or SameSite), making it easier for scripts or network snoopers to access it.",
        whatIsWrong: `Cookie flags violation observed: ${JSON.stringify(finding.evidence)}`,
        whyItMatters: "Missing `Secure` permits cookies to travel unencrypted; missing `HttpOnly` on session cookies allows client-side XSS scripts to read auth tokens; improper `SameSite` can facilitate cross-site request forgery.",
        evidenceExplanation: `Cookie security evaluation: ${JSON.stringify(finding.evidence)}`,
        scope: "APPLICATION",
        scopeExplanation: "Configured at the application layer where cookies are issued (`Set-Cookie` header).",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["APPLICATION", "DEVELOPER"],
        recommendedAction: "Update application session cookie configuration to include Secure, HttpOnly, and SameSite=Lax.",
        exactRecommendedChange: "Set `Secure; HttpOnly; SameSite=Lax; Path=/` on all server-side session cookies.",
        implementationSteps: [
          "Locate your application framework session configuration (Express, Next.js, Django, Laravel, Rails).",
          "Ensure `cookie.secure = true` (in production).",
          "Ensure `cookie.httpOnly = true` for authentication and session tokens.",
          "Ensure `cookie.sameSite = 'lax'` (or `'strict'`)."
        ],
        codeExamples: [
          {
            title: "Express.js Session Cookie Security",
            language: "javascript",
            code: `app.use(session({\n  secret: process.env.SESSION_SECRET,\n  cookie: {\n    secure: true,\n    httpOnly: true,\n    sameSite: 'lax',\n    path: '/'\n  }\n}));`,
            context: "RECOMMENDED"
          }
        ],
        configurationExamples: [],
        platformInstructions,
        risksAndCautions: [
          "Do not add `HttpOnly` to cookies that client-side JavaScript legitimately needs to read (e.g. UI theme preference, non-sensitive state)."
        ],
        prerequisites: ["Site must be served over HTTPS for `Secure` cookies to function."],
        verificationSteps: ["Inspect `Set-Cookie` headers in browser DevTools Application > Cookies tab."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["cookies"],
          successCondition: "Session cookie contains Secure, HttpOnly, and valid SameSite attributes.",
          failureCondition: "Session cookie missing Secure or HttpOnly."
        },
        expectedImpact: "Protects sensitive authentication tokens against session hijacking and script theft.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "UNDER_1_HOUR",
        references: [
          { title: "MDN Set-Cookie", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie", source: "MDN" },
          { title: "OWASP Session Management", url: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html", source: "OWASP" }
        ],
        limitations: []
      };

    case "SEC_CORS_WILDCARD_WITH_CREDENTIALS":
    case "SEC_CORS_WILDCARD":
      const isDangerousCors = ruleId === "SEC_CORS_WILDCARD_WITH_CREDENTIALS";
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: isDangerousCors
          ? "Invalid CORS configuration: Access-Control-Allow-Origin: * combined with Access-Control-Allow-Credentials: true."
          : "CORS Wildcard: Access-Control-Allow-Origin: * allows public cross-origin reading.",
        simpleExplanation: isDangerousCors
          ? "Your server combines a wildcard '*' origin with 'allow credentials'. Browsers reject this combination, breaking cross-origin requests."
          : "This endpoint allows any website to read its response. This is normal for public APIs, but should be reviewed for private endpoints.",
        whatIsWrong: isDangerousCors
          ? "The server returns `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`."
          : "The response declares `Access-Control-Allow-Origin: *`.",
        whyItMatters: isDangerousCors
          ? "Browsers strictly disallow credentialed cross-origin reads when origin is wildcard `*`. It represents a broken configuration that causes browser fetch rejections."
          : "Public resources are accessible to any origin; verify that private data is not exposed.",
        evidenceExplanation: `CORS response headers: ${JSON.stringify(finding.evidence)}`,
        scope: "URL",
        scopeExplanation: "Applies to the specific API route or server endpoint.",
        actionability: isDangerousCors ? "DEVELOPER_ACTIONABLE" : "INFORMATIONAL_ONLY",
        ownership: ["DEVELOPER", "APPLICATION", "WEB_SERVER"],
        recommendedAction: isDangerousCors
          ? "Return the specific trusted origin (e.g. `https://app.example.com`) or remove `Access-Control-Allow-Credentials`."
          : "Verify whether this endpoint is intended for public consumption.",
        exactRecommendedChange: isDangerousCors
          ? "Validate incoming `Origin` header against an allowlist and echo the matched origin, or omit credentials."
          : "No action required if this endpoint is a public static asset or public API.",
        implementationSteps: isDangerousCors
          ? [
              "Identify allowed client origins in an application whitelist.",
              "If the request `Origin` matches the whitelist, return `Access-Control-Allow-Origin: <matched_origin>` and `Access-Control-Allow-Credentials: true`.",
              "If not matching, omit CORS headers."
            ]
          : ["Confirm endpoint contains no sensitive authenticated user data."],
        codeExamples: isDangerousCors
          ? [
              {
                title: "Safe Origin Whitelisting in Node.js",
                language: "javascript",
                code: `const allowedOrigins = ['https://app.example.com', 'https://admin.example.com'];\n\napp.use((req, res, next) => {\n  const origin = req.headers.origin;\n  if (allowedOrigins.includes(origin)) {\n    res.setHeader('Access-Control-Allow-Origin', origin);\n    res.setHeader('Access-Control-Allow-Credentials', 'true');\n  }\n  next();\n});`,
                context: "RECOMMENDED"
              }
            ]
          : [],
        configurationExamples: [],
        platformInstructions,
        risksAndCautions: [
          "CAUTION: Never dynamically reflect the incoming `Origin` header blindly without validation, as that bypasses CORS restrictions entirely."
        ],
        prerequisites: [],
        verificationSteps: ["Test cross-origin requests with `curl -H 'Origin: https://test.com' -I https://yourdomain.com/api`."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["securityHeadersByUrl"],
          successCondition: "No contradictory wildcard + credentials combination.",
          failureCondition: "Access-Control-Allow-Origin: * present with Access-Control-Allow-Credentials: true."
        },
        expectedImpact: "Fixes browser CORS rejections and aligns cross-origin access control with intended policy.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: isDangerousCors ? "MODERATE" : "EASY",
        estimatedEffortClass: isDangerousCors ? "UNDER_1_HOUR" : "MINUTES",
        references: [
          { title: "MDN CORS", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS", source: "MDN" },
          { title: "OWASP CORS Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html", source: "OWASP" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 6. SENSITIVE FILES & PROBES
    // -------------------------------------------------------------
    case "SEC_ENV_FILE_EXPOSED":
    case "SEC_GIT_HEAD_EXPOSED":
    case "SEC_GIT_CONFIG_EXPOSED":
    case "SEC_DS_STORE_EXPOSED":
      const isEnv = ruleId === "SEC_ENV_FILE_EXPOSED";
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: `Publicly accessible sensitive file confirmed: ${finding.evidence?.path || "hidden artifact"}.`,
        simpleExplanation: isEnv
          ? "CRITICAL: Your `.env` configuration file is publicly downloadable on the internet. Anyone can read your database passwords and API keys."
          : "Sensitive metadata files (.git or .DS_Store) are publicly accessible on your web server.",
        whatIsWrong: `Confirmed 200 response with matched signature for ${finding.evidence?.path}.`,
        whyItMatters: isEnv
          ? "Exposed `.env` files contain production secrets (database credentials, API keys, encryption secrets, mailer tokens), allowing complete infrastructure compromise."
          : "Exposed `.git` repositories allow attackers to reconstruct full source code history, revealing hidden endpoints and hardcoded credentials.",
        evidenceExplanation: `Probe evidence snippet (secrets redacted): ${JSON.stringify(finding.evidence?.redactedEvidenceSnippet || "CONFIRMED_SIGNATURE_MATCH")}`,
        scope: "SITE_WIDE",
        scopeExplanation: "Applies to the web server document root.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["DEVELOPER", "WEB_SERVER", "HOSTING_PROVIDER"],
        recommendedAction: isEnv
          ? "IMMEDIATELY: 1) Block public access, 2) Delete file from web root, 3) Rotate ALL secrets and database passwords."
          : "Block public access to hidden dotfiles in your web server configuration.",
        exactRecommendedChange: "Block web access to `.*` dotfiles and delete exposed configuration files from the public web root.",
        implementationSteps: isEnv
          ? [
              "IMMEDIATELY remove `.env` from your public web root or document directory.",
              "Add server configuration to deny access to all hidden files (`/\\..*`).",
              "Assume all credentials in `.env` are compromised: Rotate database passwords, third-party API keys, JWT secrets, and payment tokens immediately.",
              "Audit server access logs for requests to `/.env` to identify potential unauthorized access."
            ]
          : [
              "Remove `.git` or `.DS_Store` files from the public web folder.",
              "Add server rules to deny access to `/.git` and `/.DS_Store`."
            ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "Nginx Block All Hidden Files",
            language: "nginx",
            code: `location ~ /\\. {\n    deny all;\n    return 404;\n}`,
            context: "CONFIG"
          },
          {
            title: "Apache Block Hidden Files (.htaccess)",
            language: "apache",
            code: `<FilesMatch "^\\.(env|git|DS_Store)">\n    Require all denied\n</FilesMatch>`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "CRITICAL: Simply deleting the `.env` file is NOT enough. You MUST rotate all secrets because they may have already been scraped."
        ],
        prerequisites: [],
        verificationSteps: ["Attempt to fetch the URL using `curl -I https://yourdomain.com/.env` and confirm a 404 or 403 response."],
        automatedVerification: {
          supported: true,
          method: "SAFE_PROBE",
          requiredFacts: ["safeProbes"],
          successCondition: "Target path returns 404/403 and signature check fails.",
          failureCondition: "Target path returns HTTP 200 with signature match."
        },
        expectedImpact: "Eliminates direct public exposure of sensitive backend secrets and source code metadata.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: isEnv ? "ADVANCED" : "EASY",
        estimatedEffortClass: isEnv ? "FEW_HOURS" : "MINUTES",
        references: [
          { title: "OWASP Configuration Management", url: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/03-Test_File_Extensions_Handling_for_Sensitive_Information", source: "OWASP" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 7. INFORMATION DISCLOSURE
    // -------------------------------------------------------------
    case "SEC_X_POWERED_BY_DISCLOSURE":
    case "SEC_SERVER_VERSION_DISCLOSURE":
    case "SEC_DEBUG_HEADER_EXPOSURE":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: "Detailed backend technology or version numbers disclosed in response headers.",
        simpleExplanation: "Your server is telling the public exact details about what software and version numbers it runs (e.g. Nginx/1.24.0 or PHP/8.1).",
        whatIsWrong: `Response header discloses technology details: ${JSON.stringify(finding.evidence)}`,
        whyItMatters: "Broadcasting exact software versions helps automated scanners search for known unpatched CVE vulnerabilities targeting those specific versions.",
        evidenceExplanation: `Disclosed header values: ${JSON.stringify(finding.evidence)}`,
        scope: "HOST",
        scopeExplanation: "Configured globally in web server or backend application options.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["WEB_SERVER", "APPLICATION", "DEVELOPER"],
        recommendedAction: "Disable or suppress technology disclosure headers in server and framework configurations.",
        exactRecommendedChange: "Disable `X-Powered-By` in application frameworks and enable `server_tokens off` in web servers.",
        implementationSteps: [
          "In Express: `app.disable('x-powered-by');`",
          "In Next.js: `poweredByHeader: false` in `next.config.js`",
          "In PHP: `expose_php = Off` in `php.ini`",
          "In Nginx: `server_tokens off;` in `nginx.conf`"
        ],
        codeExamples: [
          {
            title: "Express.js Suppress X-Powered-By",
            language: "javascript",
            code: `app.disable('x-powered-by');`,
            context: "RECOMMENDED"
          }
        ],
        configurationExamples: [
          {
            title: "Nginx server_tokens Directive",
            language: "nginx",
            code: `server_tokens off;`,
            context: "CONFIG"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "Note: Hiding server headers is a defense-in-depth hygiene practice; it does not replace keeping server software updated."
        ],
        prerequisites: [],
        verificationSteps: ["Inspect response headers and verify `X-Powered-By` is absent and `Server` contains no detailed version numbers."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: ["securityHeadersByUrl"],
          successCondition: "X-Powered-By is absent and Server contains no detailed version numbers.",
          failureCondition: "X-Powered-By present or Server version disclosed."
        },
        expectedImpact: "Reduces footprint information available to automated vulnerability scanners.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "OWASP Fingerprinting Web Server", url: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/02-Fingerprint_Web_Server", source: "OWASP" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 8. FORMS & THIRD PARTY
    // -------------------------------------------------------------
    case "SEC_FORM_HTTPS_TO_HTTP":
    case "SEC_PASSWORD_FORM_OVER_HTTP":
    case "SEC_PASSWORD_FIELD_USING_GET":
    case "SEC_SENSITIVE_GET_FORM":
    case "SEC_EXTERNAL_FORM_SUBMISSION":
      const isPwdHttp = ruleId === "SEC_PASSWORD_FORM_OVER_HTTP";
      const isPwdGet = ruleId === "SEC_PASSWORD_FIELD_USING_GET";
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: `Insecure HTML form submission configuration: ${finding.title}.`,
        simpleExplanation: isPwdHttp || isPwdGet
          ? "CRITICAL: Passwords are being transmitted insecurely (either over unencrypted HTTP or in URL query parameters)."
          : "Form submission settings send data insecurely or across third-party boundaries.",
        whatIsWrong: `Form action/method issue observed: ${JSON.stringify(finding.evidence)}`,
        whyItMatters: isPwdHttp
          ? "Plaintext password submission over HTTP allows eavesdroppers on the local network/Wi-Fi to capture user passwords in cleartext."
          : isPwdGet
          ? "Password or sensitive data sent via GET requests gets logged in browser history, proxy server logs, and Web analytics referrers."
          : "Form data submitted to HTTP endpoints loses transport encryption.",
        evidenceExplanation: `Form evidence: ${JSON.stringify(finding.evidence)}`,
        scope: "PAGE",
        scopeExplanation: "Configured in the HTML form tag on the affected page.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["DEVELOPER", "CONTENT_EDITOR"],
        recommendedAction: "Ensure all login and sensitive forms use `method=\"POST\"` and submit to secure `https://` URLs.",
        exactRecommendedChange: "Set `method=\"POST\"` and `action=\"https://...\"` on all form elements.",
        implementationSteps: [
          "Locate the form in your template or CMS component.",
          "Change `method=\"GET\"` to `method=\"POST\"` for any form collecting passwords or personal data.",
          "Ensure the `action` attribute points to an HTTPS URL."
        ],
        codeExamples: [
          {
            title: "Secure Login Form Markup",
            language: "html",
            code: `<!-- Secure Form Pattern -->\n<form method="POST" action="https://yourdomain.com/login">\n  <input type="email" name="email" required />\n  <input type="password" name="password" required />\n  <button type="submit">Log In</button>\n</form>`,
            context: "RECOMMENDED"
          }
        ],
        configurationExamples: [],
        platformInstructions,
        risksAndCautions: [
          "Ensure your backend API handler is configured to accept POST requests on the target endpoint."
        ],
        prerequisites: [],
        verificationSteps: ["Inspect the form in browser DevTools and verify method=\"POST\" and action=\"https://...\"."],
        automatedVerification: {
          supported: true,
          method: "RE_CRAWL_PAGE",
          requiredFacts: ["forms"],
          successCondition: "Password forms use method=\"POST\" and submit to secure HTTPS endpoints.",
          failureCondition: "Password form uses GET or submits over plaintext HTTP."
        },
        expectedImpact: "Protects sensitive user credentials from plaintext interception and log leakage.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "OWASP Form Security", url: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html", source: "OWASP" }
        ],
        limitations: []
      };

    case "SEC_THIRD_PARTY_HTTP_SCRIPT":
    case "SEC_THIRD_PARTY_HTTP_STYLESHEET":
    case "SEC_THIRD_PARTY_SRI_MISSING":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: `Third-party resource issue: ${finding.title}.`,
        simpleExplanation: ruleId === "SEC_THIRD_PARTY_SRI_MISSING"
          ? "External scripts loaded from public CDNs do not include Subresource Integrity (SRI) hashes."
          : "External third-party scripts/stylesheets are loaded over insecure HTTP.",
        whatIsWrong: `Third party resource issue observed: ${JSON.stringify(finding.evidence)}`,
        whyItMatters: ruleId === "SEC_THIRD_PARTY_SRI_MISSING"
          ? "Subresource Integrity (SRI) ensures that if an external CDN is compromised, browsers will reject altered malicious files."
          : "Insecure third-party scripts allow attackers to inject malicious code into your pages.",
        evidenceExplanation: `Resource evidence: ${JSON.stringify(finding.evidence)}`,
        scope: "RESOURCE",
        scopeExplanation: "Applies to the specific `<script>` or `<link>` tags in templates.",
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["DEVELOPER"],
        recommendedAction: ruleId === "SEC_THIRD_PARTY_SRI_MISSING"
          ? "Add `integrity` and `crossorigin=\"anonymous\"` attributes to static third-party CDN scripts."
          : "Change `http://` to `https://` for external asset URLs.",
        exactRecommendedChange: "Add `integrity=\"sha384-...\" crossorigin=\"anonymous\"` to external static scripts.",
        implementationSteps: [
          "For static CDN libraries (e.g. React, Bootstrap, FontAwesome from cdnjs/jsdelivr), copy the official SRI hash snippet.",
          "Add `integrity` and `crossorigin=\"anonymous\"` attributes to the `<script>` tag."
        ],
        codeExamples: [
          {
            title: "Subresource Integrity Script Example",
            language: "html",
            code: `<script\n  src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"\n  integrity="sha384-H4a7QZ+V8i6kF8vHqNqZ8eKkF5bK6J2y8iY9z1u8b9v1u8b9v1u8b9v1u8b9v1u8"\n  crossorigin="anonymous">\n</script>`,
            context: "RECOMMENDED"
          }
        ],
        configurationExamples: [],
        platformInstructions,
        risksAndCautions: [
          "Do not apply SRI to dynamic third-party scripts that update automatically (e.g. Google Tag Manager, Intercom chat, Stripe JS), as hash changes will cause browsers to block the script."
        ],
        prerequisites: [],
        verificationSteps: ["Inspect HTML `<script>` tags for valid `integrity` attributes."],
        automatedVerification: {
          supported: true,
          method: "RE_CRAWL_PAGE",
          requiredFacts: ["resources"],
          successCondition: "Static CDN scripts contain valid integrity and crossorigin attributes.",
          failureCondition: "Static CDN script loaded without integrity."
        },
        expectedImpact: "Protects against supply-chain tampering if an external CDN is compromised.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "EASY",
        estimatedEffortClass: "MINUTES",
        references: [
          { title: "MDN Subresource Integrity", url: "https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity", source: "MDN" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 9. DOMAIN & EMAIL
    // -------------------------------------------------------------
    case "SEC_CAA_MISSING":
    case "SEC_SPF_MISSING":
    case "SEC_DMARC_MISSING":
    case "SEC_DMARC_POLICY_NONE":
    case "SEC_DMARC_PCT_PARTIAL":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: `DNS domain/email security record configuration: ${finding.title}.`,
        simpleExplanation: "Your domain's DNS records for email authentication (SPF, DMARC) or Certificate Authority Authorization (CAA) need attention.",
        whatIsWrong: `DNS record issue on ${facts.targetDomain}: ${JSON.stringify(finding.evidence)}`,
        whyItMatters: "DMARC and SPF prevent spammers and phishers from sending fake emails pretending to be from your domain. CAA records prevent unauthorized certificate authorities from issuing SSL certificates for your domain.",
        evidenceExplanation: `Observed DNS records: ${JSON.stringify(finding.evidence)}`,
        scope: "DOMAIN",
        scopeExplanation: "Configured at your authoritative DNS provider.",
        actionability: "PROVIDER_ACTIONABLE",
        ownership: ["DNS_PROVIDER", "EMAIL_ADMIN", "SITE_OWNER"],
        recommendedAction: "Add or update the required DNS records (CAA, SPF, DMARC) in your domain's DNS management panel.",
        exactRecommendedChange: "Add standard TXT records for SPF and DMARC, and CAA records for your certificate authority.",
        implementationSteps: [
          "Log in to your DNS provider (Cloudflare, GoDaddy, Namecheap, Route53).",
          "For DMARC: Add a TXT record for `_dmarc.yourdomain.com` with `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` for monitoring.",
          "For SPF: Ensure a single valid `v=spf1 ... ~all` record exists containing all legitimate email senders.",
          "For CAA: Add CAA records specifying authorized CAs (e.g. `0 issue \"letsencrypt.org\"`)."
        ],
        codeExamples: [],
        configurationExamples: [
          {
            title: "DMARC DNS TXT Record Example",
            language: "dns",
            code: `; Name: _dmarc.yourdomain.com\n; Type: TXT\n"v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; pct=100"`,
            context: "RECOMMENDED"
          },
          {
            title: "CAA DNS Record Example",
            language: "dns",
            code: `; Name: yourdomain.com\n; Type: CAA\n0 issue "letsencrypt.org"\n0 issuewild "letsencrypt.org"`,
            context: "RECOMMENDED"
          }
        ],
        platformInstructions,
        risksAndCautions: [
          "CAUTION: Never create multiple SPF records for a single domain (which invalidates SPF).",
          "CAUTION: Start DMARC with `p=none` to monitor reports before moving to `p=quarantine` or `p=reject`, ensuring all valid mail senders are authorized."
        ],
        prerequisites: ["Access to the domain registrar or DNS hosting dashboard."],
        verificationSteps: ["Query DNS using `dig TXT _dmarc.yourdomain.com` and `dig CAA yourdomain.com`."],
        automatedVerification: {
          supported: true,
          method: "DNS_QUERY",
          requiredFacts: ["dnsByDomain"],
          successCondition: "Authoritative DNS query returns valid SPF, DMARC, and CAA records.",
          failureCondition: "Records missing, malformed, or syntax invalid."
        },
        expectedImpact: "Protects brand domain reputation and prevents email spoofing.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "MODERATE",
        estimatedEffortClass: "UNDER_1_HOUR",
        references: [
          { title: "DMARC.org Overview", url: "https://dmarc.org/overview/", source: "PLATFORM_DOCS" },
          { title: "RFC 7208 SPF", url: "https://datatracker.ietf.org/doc/html/rfc7208", source: "IETF_RFC" }
        ],
        limitations: []
      };

    // -------------------------------------------------------------
    // 10. MANUAL COVERAGE RULES (ASSESSMENT GUIDANCE)
    // -------------------------------------------------------------
    case "SEC_MANUAL_SQL_INJECTION":
    case "SEC_MANUAL_XSS":
    case "SEC_MANUAL_AUTH_BYPASS":
    case "SEC_MANUAL_BROKEN_ACCESS_CONTROL":
    case "SEC_MANUAL_IDOR":
    case "SEC_MANUAL_SSRF":
    case "SEC_MANUAL_COMMAND_INJECTION":
    case "SEC_MANUAL_BUSINESS_LOGIC":
    case "SEC_MANUAL_PRIVILEGE_ESCALATION":
    case "SEC_MANUAL_CSRF_ACTIVE_TEST":
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: `Manual Security Assessment Boundary: ${finding.title}.`,
        simpleExplanation: "Dream SEO performs safe, non-intrusive audits and does NOT send active exploit payloads. Assessing this vulnerability class requires authorized penetration testing or static source code analysis.",
        whatIsWrong: "This vulnerability class cannot be verified through safe passive auditing alone.",
        whyItMatters: "Deep application vulnerabilities (such as SQL injection, access control bypasses, and business logic flaws) require specialized testing tools and security reviews.",
        evidenceExplanation: "Status is REQUIRES_MANUAL_VERIFICATION; zero active exploit attempts were conducted.",
        scope: "APPLICATION",
        scopeExplanation: "Applies to application business logic and backend endpoints.",
        actionability: "MANUAL_ASSESSMENT_REQUIRED",
        ownership: ["DEVELOPER", "SITE_OWNER"],
        recommendedAction: "Engage qualified security professionals for authorized penetration testing and static code analysis (SAST).",
        exactRecommendedChange: "Perform parameterized database queries, strict access control checks, and secure code reviews.",
        implementationSteps: [
          "Incorporate static application security testing (SAST) in your CI/CD pipeline.",
          "Use parameterized SQL queries and ORMs exclusively.",
          "Perform automated dependency scanning (e.g. npm audit, Snyk).",
          "Schedule periodic penetration testing for sensitive authenticated workflows."
        ],
        codeExamples: [],
        configurationExamples: [],
        platformInstructions: [],
        risksAndCautions: [
          "Never run intrusive vulnerability scanning against production systems without explicit authorization."
        ],
        prerequisites: [],
        verificationSteps: ["Manual penetration testing and code review."],
        automatedVerification: {
          supported: false,
          method: "MANUAL_ONLY",
          requiredFacts: [],
          successCondition: "Certified by manual penetration test report.",
          failureCondition: "Active vulnerability confirmed during testing."
        },
        expectedImpact: "Clarifies the exact audit boundary between passive SEO/configuration auditing and active penetration testing.",
        affectedUrls,
        affectedOccurrences: 0,
        globalEfficiency: {
          isGlobalFix: false,
          fixOnce: false,
          affectedUrlsCount: 0,
          affectedOccurrencesCount: 0,
          scope: "APPLICATION",
          explanation: "Requires manual code review or authorized security assessment."
        },
        difficulty: "ADVANCED",
        estimatedEffortClass: "PROJECT_LEVEL",
        references: [
          { title: "OWASP Top 10", url: "https://owasp.org/Top10/", source: "OWASP" }
        ],
        limitations: ["Dream SEO does not send active exploit payloads."]
      };

    default:
      // Generic Fallback Blueprint
      return {
        findingId: finding.id,
        ruleId,
        title: finding.title,
        summary: finding.description || "Security configuration issue observed.",
        simpleExplanation: "An observed configuration setting on your website does not follow standard web security practices.",
        whatIsWrong: finding.description,
        whyItMatters: "Resolving security misconfigurations reduces potential attack surface and improves browser defense-in-depth.",
        evidenceExplanation: JSON.stringify(finding.evidence || {}),
        scope: (finding.scope || "PAGE") as SecurityRemediationScope,
        scopeExplanation: `Applies at the ${finding.scope || "PAGE"} level.`,
        actionability: "DEVELOPER_ACTIONABLE",
        ownership: ["DEVELOPER"],
        recommendedAction: "Review and update the affected configuration setting.",
        exactRecommendedChange: "Align configuration with security standards.",
        implementationSteps: ["Inspect the affected resource or header.", "Update settings according to best practices."],
        codeExamples: [],
        configurationExamples: [],
        platformInstructions,
        risksAndCautions: [],
        prerequisites: [],
        verificationSteps: ["Re-test the endpoint after making changes."],
        automatedVerification: {
          supported: true,
          method: "RE_FETCH_HTTPS",
          requiredFacts: [],
          successCondition: "Issue no longer detected.",
          failureCondition: "Issue remains detected."
        },
        expectedImpact: "Hardens the website against potential misconfiguration risks.",
        affectedUrls,
        affectedOccurrences: occurrencesCount,
        globalEfficiency,
        difficulty: "MODERATE",
        estimatedEffortClass: "UNDER_1_HOUR",
        references: [],
        limitations: []
      };
  }
}
