/**
 * Webflow Platform Adapter for Security Fix Intelligence (SECURITY S4).
 * Provides authentic, capability-aware Webflow remediation steps without prescribing impossible server edits.
 */

import type { SecurityPlatformInstruction } from "../remediation-types";

export function getWebflowInstruction(ruleId: string): SecurityPlatformInstruction | null {
  switch (ruleId) {
    case "SEC_HSTS_MISSING":
    case "SEC_HSTS_SHORT_MAX_AGE":
    case "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING":
    case "SEC_HSTS_PRELOAD_NOT_ENABLED":
      return {
        platform: "WEBFLOW",
        title: "Webflow HSTS Configuration",
        isDirectlySupported: false,
        controlLocation: "Webflow Hosting / Cloudflare Reverse Proxy",
        steps: [
          "Webflow natively enables standard HTTPS for all custom domains with default HSTS headers on Webflow hosting.",
          "Custom HSTS parameters (such as `preload` or extended `max-age`) cannot be configured directly inside the Webflow Designer or Site Settings.",
          "If strict HSTS preloading is required, route your domain through a Cloudflare Reverse Proxy (or CDN) and apply an Edge Transform Rule to add the custom HSTS response header."
        ],
        caveats: [
          "Do not attempt to add HSTS via custom code `<meta>` tags; browsers only accept HSTS as an HTTP response header.",
          "Ensure all subdomains support HTTPS before enabling `includeSubDomains`."
        ]
      };

    case "SEC_CSP_MISSING":
    case "SEC_CSP_UNSAFE_INLINE":
    case "SEC_CSP_BROAD_WILDCARD_SOURCE":
    case "SEC_CSP_OBJECT_SRC_UNRESTRICTED":
    case "SEC_CSP_BASE_URI_MISSING":
      return {
        platform: "WEBFLOW",
        title: "Webflow Content-Security-Policy Guidance",
        isDirectlySupported: true,
        controlLocation: "Webflow Site Settings > Custom Code > Head Code (Meta) OR Cloudflare Edge Header",
        steps: [
          "HTML `<meta>` tag delivery (Useful CSP Subset): Navigate to Webflow Dashboard > Project Settings > Custom Code. In 'Head Code', add a `<meta http-equiv=\"Content-Security-Policy\" content=\"...\">` tag to enforce resource loading policies (script-src, style-src, img-src, connect-src).",
          "HTTP Response Header delivery (Full CSP Enforcement - Recommended): Route your Webflow domain through Cloudflare (or a CDN/reverse proxy) and configure an Edge Transform Rule to send CSP as a genuine HTTP response header.",
          "Technical Distinction: Meta-delivered CSP enforces a useful subset of directives but is not equivalent to response-header CSP. Critical directives like `frame-ancestors` (clickjacking defense), `report-uri`, and `report-to` are ignored by browsers when delivered via `<meta>` tags and strictly require HTTP response headers."
        ],
        codeExamples: [
          {
            title: "Webflow Head Code Basic CSP Meta Tag",
            language: "html",
            code: `<meta http-equiv="Content-Security-Policy" content="default-src 'self' https:; script-src 'self' 'unsafe-inline' https://assets.webflow.com https://d3e54v103j8qbb.cloudfront.net; style-src 'self' 'unsafe-inline' https://assets.webflow.com; img-src 'self' data: https:; font-src 'self' data: https://assets.webflow.com https://fonts.gstatic.com; object-src 'none'; base-uri 'self';">`,
            context: "CONFIG"
          },
          {
            title: "Cloudflare Edge HTTP Response Header (Complete)",
            language: "http",
            code: `Content-Security-Policy: default-src 'self' https:; script-src 'self' 'unsafe-inline' https://assets.webflow.com https://d3e54v103j8qbb.cloudfront.net; style-src 'self' 'unsafe-inline' https://assets.webflow.com; img-src 'self' data: https:; font-src 'self' data: https://assets.webflow.com https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self';`,
            context: "RECOMMENDED"
          }
        ],
        caveats: [
          "Webflow interactions and animations require `assets.webflow.com` and `cloudfront.net` in script-src and style-src.",
          "`frame-ancestors` directive cannot be enforced via meta tags; browsers ignore `frame-ancestors` in `<meta>` and strictly require an HTTP response header."
        ]
      };

    case "SEC_MIXED_ACTIVE_CONTENT":
    case "SEC_MIXED_PASSIVE_CONTENT":
    case "SEC_THIRD_PARTY_HTTP_SCRIPT":
    case "SEC_THIRD_PARTY_HTTP_STYLESHEET":
      return {
        platform: "WEBFLOW",
        title: "Webflow Insecure Resource / Mixed Content Resolution",
        isDirectlySupported: true,
        controlLocation: "Webflow Designer > Assets / Custom Code Embeds / Page Settings",
        steps: [
          "Open the Webflow Designer for your project.",
          "Check Page Settings > Custom Code (or Project Settings > Custom Code) for any `<script src=\"http://...\">` or `<link href=\"http://...\">` tags.",
          "Inspect custom HTML Embed elements on the page and update all `http://` asset URLs to `https://`.",
          "If the asset is an image, re-upload it to the Webflow Asset Manager to ensure it is served over Webflow's secure CDN."
        ],
        caveats: [
          "Verify the external third-party host supports HTTPS before changing the URL scheme."
        ]
      };

    case "SEC_ENV_FILE_EXPOSED":
    case "SEC_GIT_HEAD_EXPOSED":
    case "SEC_GIT_CONFIG_EXPOSED":
    case "SEC_DS_STORE_EXPOSED":
      return {
        platform: "WEBFLOW",
        title: "Webflow Static Hosting Security",
        isDirectlySupported: false,
        controlLocation: "Webflow Managed Hosting",
        steps: [
          "Webflow managed hosting does not expose local filesystem `.env` or `.git` directories.",
          "If this site is exported from Webflow and hosted on an external server (e.g. AWS S3, Apache, Nginx), configure web server access rules to forbid dotfile access."
        ]
      };

    case "SEC_FORM_HTTPS_TO_HTTP":
    case "SEC_PASSWORD_FORM_OVER_HTTP":
    case "SEC_EXTERNAL_FORM_SUBMISSION":
      return {
        platform: "WEBFLOW",
        title: "Webflow Form Submission Action Configuration",
        isDirectlySupported: true,
        controlLocation: "Webflow Designer > Form Block Settings",
        steps: [
          "Select the Form Block in the Webflow Designer.",
          "Open the Form Settings panel in the right sidebar.",
          "Ensure the 'Action' field uses a secure `https://` endpoint or leave blank to use Webflow Form Handling."
        ]
      };

    case "SEC_CAA_MISSING":
    case "SEC_SPF_MISSING":
    case "SEC_DMARC_MISSING":
    case "SEC_DMARC_POLICY_NONE":
    case "SEC_DMARC_PCT_PARTIAL":
      return {
        platform: "WEBFLOW",
        title: "DNS & Email Authentication for Webflow Sites",
        isDirectlySupported: true,
        controlLocation: "Domain Registrar / DNS Provider (e.g. Cloudflare, Namecheap, GoDaddy)",
        steps: [
          "Log in to your authoritative DNS Provider dashboard (where your domain's nameservers are hosted).",
          "Add or modify the required TXT/CAA records (SPF, DMARC, CAA) directly in your DNS manager.",
          "Note: DNS records cannot be configured inside Webflow; they must be managed at your domain host."
        ]
      };

    default:
      return null;
  }
}
