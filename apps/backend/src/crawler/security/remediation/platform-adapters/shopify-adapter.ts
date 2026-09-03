/**
 * Shopify Platform Adapter for Security Fix Intelligence (SECURITY S4).
 * Provides Shopify-specific remediation steps, distinguishing theme-editable from platform-controlled items.
 */

import type { SecurityPlatformInstruction } from "../remediation-types";

export function getShopifyInstruction(ruleId: string): SecurityPlatformInstruction | null {
  switch (ruleId) {
    case "SEC_HSTS_MISSING":
    case "SEC_HSTS_SHORT_MAX_AGE":
    case "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING":
    case "SEC_HSTS_PRELOAD_NOT_ENABLED":
      return {
        platform: "SHOPIFY",
        title: "Shopify Managed SSL & Transport Security",
        isDirectlySupported: false,
        controlLocation: "Shopify Core Platform",
        steps: [
          "Shopify automatically provisions SSL certificates and serves storefronts over HTTPS with standard HSTS headers.",
          "Custom HSTS modifications cannot be adjusted via the Shopify Admin or theme Liquid files.",
          "If custom edge headers are essential, route your custom domain through Cloudflare (using Cloudflare for SaaS or Shopify Plus proxy configurations)."
        ],
        caveats: [
          "Do not modify DNS A/CNAME records away from Shopify unless properly configured with Shopify Plus multi-origin routing."
        ]
      };

    case "SEC_MIXED_ACTIVE_CONTENT":
    case "SEC_MIXED_PASSIVE_CONTENT":
    case "SEC_THIRD_PARTY_HTTP_SCRIPT":
    case "SEC_THIRD_PARTY_HTTP_STYLESHEET":
      return {
        platform: "SHOPIFY",
        title: "Shopify Theme Asset & Script Security",
        isDirectlySupported: true,
        controlLocation: "Online Store > Themes > Edit Code > theme.liquid / snippets",
        steps: [
          "In Shopify Admin, go to Online Store > Themes > Actions > Edit Code.",
          "Open `layout/theme.liquid` and inspect third-party tracking scripts, chat widgets, and font links.",
          "Ensure all `http://` URLs in `<script>` and `<link>` tags are updated to `https://`.",
          "Check installed Shopify Apps that inject script tags and ensure they load securely."
        ]
      };

    case "SEC_CSP_MISSING":
    case "SEC_CSP_UNSAFE_INLINE":
    case "SEC_CSP_OBJECT_SRC_UNRESTRICTED":
      return {
        platform: "SHOPIFY",
        title: "Shopify Content-Security-Policy Guidance",
        isDirectlySupported: false,
        controlLocation: "Shopify Theme Liquid `<meta>` or Edge CDN",
        steps: [
          "Shopify themes can implement CSP meta tags in `theme.liquid` `<head>` for basic defense.",
          "However, full HTTP header CSP on Shopify is typically managed via Cloudflare or Shopify's managed checkout environment.",
          "Take extreme caution with restrictive CSPs on Shopify to avoid breaking checkout, Shopify Analytics, and app extensions."
        ]
      };

    default:
      return null;
  }
}
