/**
 * Platform Adapters for SEO Fix Intelligence.
 * Detects website CMS/framework from evidence and provides platform-tailored remediation workflows.
 */

import type { SupportedPlatform, PlatformSpecificGuidance } from "./types";
export type { SupportedPlatform, PlatformSpecificGuidance };
import type { CrawledPageData } from "../types";

export interface PlatformDetectionResult {
  platform: SupportedPlatform;
  confidence: number;
  signals: string[];
}

/**
 * Detects platform from crawled pages evidence without forcing assumptions.
 */
export function detectPlatformFromPages(pages: CrawledPageData[]): PlatformDetectionResult {
  const signals: string[] = [];
  let webflowScore = 0;
  let wordpressScore = 0;
  let nextjsScore = 0;
  let shopifyScore = 0;

  for (const page of pages.slice(0, 15)) {
    const htmlLower = (page.html || "").toLowerCase();
    const headers = page.headers || {};
    const serverHeader = String(headers["server"] || "").toLowerCase();

    // 1. Webflow signals
    if (htmlLower.includes("data-wf-page") || htmlLower.includes("data-wf-site") || htmlLower.includes("w-dyn-list")) {
      webflowScore += 4;
      if (!signals.includes("webflow_dom_attributes")) signals.push("webflow_dom_attributes");
    }
    if (htmlLower.includes("uploads-ssl.webflow.com") || htmlLower.includes("assets.webflow.com") || htmlLower.includes("webflow.js")) {
      webflowScore += 3;
      if (!signals.includes("webflow_asset_cdn")) signals.push("webflow_asset_cdn");
    }
    if (htmlLower.includes("w-nav") || htmlLower.includes("w-container") || htmlLower.includes("w-col")) {
      webflowScore += 2;
      if (!signals.includes("webflow_class_conventions")) signals.push("webflow_class_conventions");
    }

    // 2. WordPress signals
    if (htmlLower.includes("wp-content") || htmlLower.includes("wp-includes") || htmlLower.includes("wp-json")) {
      wordpressScore += 4;
      if (!signals.includes("wordpress_wp_content")) signals.push("wordpress_wp_content");
    }
    if (htmlLower.includes('name="generator" content="wordpress')) {
      wordpressScore += 5;
      if (!signals.includes("wordpress_generator_meta")) signals.push("wordpress_generator_meta");
    }

    // 3. Next.js signals
    if (htmlLower.includes("__next_data__") || htmlLower.includes("/_next/static/") || htmlLower.includes("id=\"__next\"")) {
      nextjsScore += 5;
      if (!signals.includes("nextjs_framework_artifacts")) signals.push("nextjs_framework_artifacts");
    }

    // 4. Shopify signals
    if (htmlLower.includes("cdn.shopify.com") || htmlLower.includes("shopify-payment-button") || htmlLower.includes("shopify.theme")) {
      shopifyScore += 5;
      if (!signals.includes("shopify_theme_artifacts")) signals.push("shopify_theme_artifacts");
    }
  }

  if (webflowScore >= 4 && webflowScore > wordpressScore && webflowScore > nextjsScore) {
    return {
      platform: "webflow",
      confidence: Math.min(1.0, 0.7 + webflowScore * 0.05),
      signals,
    };
  }
  if (wordpressScore >= 4 && wordpressScore > webflowScore && wordpressScore > nextjsScore) {
    return {
      platform: "wordpress",
      confidence: Math.min(1.0, 0.7 + wordpressScore * 0.05),
      signals,
    };
  }
  if (nextjsScore >= 4 && nextjsScore > webflowScore && nextjsScore > wordpressScore) {
    return {
      platform: "nextjs",
      confidence: Math.min(1.0, 0.7 + nextjsScore * 0.05),
      signals,
    };
  }
  if (shopifyScore >= 4) {
    return {
      platform: "shopify",
      confidence: Math.min(1.0, 0.7 + shopifyScore * 0.05),
      signals,
    };
  }

  return {
    platform: "generic_html",
    confidence: 0.5,
    signals: ["standard_html_structure"],
  };
}

/**
 * Returns platform-tailored instructions for a given rule category and context.
 */
export function getPlatformRemediationGuidance(
  platform: SupportedPlatform,
  ruleCode: string,
  category: string,
  context: { isCmsPage?: boolean; templateName?: string; elementSnippet?: string } = {}
): PlatformSpecificGuidance {
  const isCms = context.isCmsPage ?? false;

  // ==========================================
  // 1. WEBFLOW FIRST-CLASS ADAPTER
  // ==========================================
  if (platform === "webflow") {
    // A. Headings
    if (ruleCode === "CONTENT_MISSING_H1" || ruleCode === "CONTENT_MULTIPLE_H1") {
      return {
        platform: "webflow",
        locationDescription: isCms
          ? `Webflow CMS Collection Template (${context.templateName || "Collection Page"})`
          : "Webflow Designer → Page Canvas",
        locationCertainty: isCms ? "LIKELY_FIX_LOCATION" : "CONFIRMED_FIX_LOCATION",
        steps: [
          isCms
            ? "Open the Webflow Designer and navigate to the CMS Collection Template."
            : "Open the Webflow Designer and navigate to the affected static page.",
          "Select the primary hero heading text element on the canvas.",
          "Open the right sidebar (Element Settings Panel / D shortcut).",
          "Under 'Heading Settings', select 'H1' as the Heading Type (preserve existing CSS classes/styles).",
          "Publish to production / custom domain.",
        ],
        tips: [
          "Do not add an extra hidden H1 block; convert the existing visible hero title to an H1.",
          isCms ? "Fixing this in the Collection Template will automatically resolve all pages in this CMS collection." : "",
        ].filter(Boolean),
      };
    }

    // B. Images & Alt
    if (ruleCode.startsWith("ASSET_MISSING_ALT") || ruleCode.startsWith("IMAGE_")) {
      return {
        platform: "webflow",
        locationDescription: isCms
          ? "Webflow CMS Collection / Template Image Element Settings"
          : "Webflow Designer → Image Settings Panel",
        locationCertainty: isCms ? "LIKELY_FIX_LOCATION" : "CONFIRMED_FIX_LOCATION",
        steps: [
          isCms
            ? "For CMS-bound images: Open CMS Collection schema, verify an 'Alt Text' text field exists and is bound to the image in the Template Image Settings."
            : "Select the image element on the canvas.",
          "Open Element Settings (Settings Panel / D shortcut).",
          "Under 'Alt text', select 'Custom' and provide a descriptive label (or 'Decorative' if purely stylistic).",
          "Publish the site.",
        ],
        tips: [
          "If the image is wrapped in a link without text, the Alt text acts as the link's accessible label.",
          "For decorative icons, mark them as 'Decorative' in Webflow which automatically renders alt=\"\".",
        ],
      };
    }

    // C. Meta & Title
    if (ruleCode.startsWith("CONTENT_MISSING_TITLE") || ruleCode.startsWith("TITLE_") || ruleCode.startsWith("CONTENT_MISSING_META_DESC") || ruleCode.startsWith("META_DESC_")) {
      return {
        platform: "webflow",
        locationDescription: isCms
          ? "Webflow Pages Panel → CMS Collection Template Settings → SEO Settings"
          : "Webflow Pages Panel → Page Settings → SEO Settings",
        locationCertainty: isCms ? "LIKELY_FIX_LOCATION" : "CONFIRMED_FIX_LOCATION",
        steps: [
          "Open the Pages panel on the left sidebar.",
          isCms
            ? "Hover over the target CMS Collection Template and click the Gear icon (Settings)."
            : "Hover over the target static page and click the Gear icon (Page Settings).",
          "Scroll down to 'SEO Settings'.",
          isCms
            ? "Update Title Tag or Meta Description by pulling dynamic fields (e.g. + Add Field: 'Name' / 'Summary') or entering structured copy."
            : "Update Title Tag or Meta Description field with unique, descriptive copy.",
          "Save page settings and publish.",
        ],
        tips: [
          "Keep titles between 30–60 characters to prevent truncation in Google search results.",
          "Meta descriptions should accurately summarize the page in 120–155 characters.",
        ],
      };
    }

    // D. Main Landmark
    if (ruleCode === "A11Y_MISSING_MAIN_LANDMARK") {
      return {
        platform: "webflow",
        locationDescription: isCms
          ? "Webflow CMS Collection Template Structure"
          : "Webflow Page Navigator → Main Section Container",
        locationCertainty: isCms ? "LIKELY_FIX_LOCATION" : "CONFIRMED_FIX_LOCATION",
        steps: [
          "Open Webflow Designer and select the primary wrapper section/container containing page body content.",
          "Open Element Settings (Settings Panel / D shortcut).",
          "Under 'HTML Tag', change the tag from '<div>' or '<section>' to '<main>'.",
          "Ensure headers, navbars, and footers remain outside this <main> container.",
          "Publish site.",
        ],
      };
    }

    // E. Canonical & Redirects
    if (ruleCode.startsWith("CANONICAL_") || ruleCode.startsWith("REDIRECT_") || ruleCode.startsWith("INDEX_")) {
      return {
        platform: "webflow",
        locationDescription: "Webflow Site Settings → Publishing / SEO / Hosting Tabs",
        locationCertainty: "LIKELY_FIX_LOCATION",
        steps: [
          "Open Webflow Project Dashboard → Site Settings.",
          "For Redirects: Navigate to 'Publishing' or 'Hosting' → '301 Redirects' table to manage or eliminate redirect hops.",
          "For Global Canonical: Navigate to 'SEO' tab → 'Global Canonical Tag URL' and enter your primary domain (e.g. https://www.botconsulting.io).",
          "For Page-Level Canonical: Open Page Settings → Inside <head> tag custom code.",
          "Save changes and publish.",
        ],
        tips: [
          "Webflow auto-generates self-referencing canonicals if Global Canonical Tag URL is configured in Site Settings.",
        ],
      };
    }

    // F. Security Headers on Webflow
    if (ruleCode.startsWith("SEC_")) {
      return {
        platform: "webflow",
        locationDescription: "Hosting Provider / Reverse Proxy / Webflow Custom Code Settings",
        locationCertainty: "GENERIC_WEBFLOW_GUIDANCE",
        steps: [
          "Note: Native HTTP response headers cannot be directly modified inside Webflow Designer.",
          "If using a reverse proxy, CDN, or custom hosting proxy in front of Webflow, configure the security header there.",
          "For HTML-level security directives (such as CSP or HTTPS redirects), insert appropriate tags into Site Settings → Custom Code → Head Code.",
        ],
        tips: [
          "Security headers are general server hygiene and have minimal direct organic search ranking impact.",
        ],
      };
    }

    // G. General Webflow default
    return {
      platform: "webflow",
      locationDescription: "Webflow Designer & Site Settings",
      locationCertainty: "GENERIC_WEBFLOW_GUIDANCE",
      steps: [
        "Open the Webflow Designer for this project.",
        "Locate the affected static page or CMS Collection Template.",
        "Apply the recommended changes in the Navigator, Element Settings, or Page SEO settings.",
        "Publish changes to the production custom domain.",
      ],
    };
  }

  // ==========================================
  // 2. WORDPRESS ADAPTER
  // ==========================================
  if (platform === "wordpress") {
    if (ruleCode.startsWith("CONTENT_MISSING_TITLE") || ruleCode.startsWith("TITLE_") || ruleCode.startsWith("CONTENT_MISSING_META_DESC") || ruleCode.startsWith("CANONICAL_")) {
      return {
        platform: "wordpress",
        locationDescription: "WordPress Post/Page Editor → SEO Plugin Panel (Yoast / RankMath / SEOPress)",
        locationCertainty: "LIKELY_FIX_LOCATION",
        steps: [
          "Log into WordPress Admin and edit the affected Post, Page, or Custom Post Type.",
          "Scroll to the SEO Plugin metabox (e.g. Yoast SEO / Rank Math).",
          "Update the SEO Title, Meta Description, or Canonical URL field under Advanced settings.",
          "Update / publish the post.",
        ],
      };
    }
    if (ruleCode.startsWith("ASSET_MISSING_ALT") || ruleCode.startsWith("IMAGE_")) {
      return {
        platform: "wordpress",
        locationDescription: "WordPress Media Library / Block Editor Image Block",
        locationCertainty: "LIKELY_FIX_LOCATION",
        steps: [
          "Edit the page in Gutenberg / Elementor, or open Media Library.",
          "Select the image and locate the 'Alternative Text' field in the Block Inspector (right sidebar).",
          "Enter descriptive Alt text (or leave blank if marked decorative).",
          "Save page.",
        ],
      };
    }
    return {
      platform: "wordpress",
      locationDescription: "WordPress Admin Dashboard / Theme Editor",
      locationCertainty: "GENERIC_GUIDANCE",
      steps: [
        "Log into WordPress Admin.",
        "Locate the relevant template or page in the editor.",
        "Apply the recommended modifications and update.",
      ],
    };
  }

  // ==========================================
  // 3. NEXT.JS ADAPTER
  // ==========================================
  if (platform === "nextjs") {
    if (ruleCode.startsWith("CONTENT_MISSING_TITLE") || ruleCode.startsWith("TITLE_") || ruleCode.startsWith("CONTENT_MISSING_META_DESC") || ruleCode.startsWith("CANONICAL_")) {
      return {
        platform: "nextjs",
        locationDescription: "Next.js App Router (metadata export) or Pages Router (<Head> component)",
        locationCertainty: "LIKELY_FIX_LOCATION",
        steps: [
          "App Router: Open `page.tsx` / `layout.tsx` and export a `metadata` object or `generateMetadata` function.",
          "Set `title`, `description`, and `alternates.canonical` properties.",
          "Pages Router: Import `Head` from `next/head` and add `<title>` and `<meta name=\"description\">` tags.",
          "Commit and rebuild.",
        ],
        tips: [
          "Example: export const metadata: Metadata = { title: '...', description: '...', alternates: { canonical: '...' } };",
        ],
      };
    }
    return {
      platform: "nextjs",
      locationDescription: "Next.js Component / Page Source Code",
      locationCertainty: "GENERIC_GUIDANCE",
      steps: [
        "Open the target React component or layout file in your codebase.",
        "Update JSX elements and attributes according to the recommended fix.",
        "Run `npm run build` to verify before deploying.",
      ],
    };
  }

  // ==========================================
  // 4. SHOPIFY ADAPTER
  // ==========================================
  if (platform === "shopify") {
    return {
      platform: "shopify",
      locationDescription: "Shopify Admin → Online Store → Themes / Products / Pages",
      locationCertainty: "GENERIC_GUIDANCE",
      steps: [
        "Log into Shopify Admin.",
        "For Products/Pages: Scroll to 'Search engine listing' at the bottom of the editor and click 'Edit'.",
        "For Theme/Layout issues: Online Store → Themes → Edit code (`theme.liquid` / templates).",
        "Save changes.",
      ],
    };
  }

  // ==========================================
  // 5. GENERIC HTML FALLBACK
  // ==========================================
  return {
    platform: "generic_html",
    locationDescription: "HTML Source Code / Server Templates",
    locationCertainty: "GENERIC_GUIDANCE",
    steps: [
      "Open the source HTML file or template responsible for this URL.",
      "Locate the relevant DOM element, `<head>` tag, or server configuration.",
      "Apply the recommended HTML markup or HTTP header modification.",
      "Deploy and verify.",
    ],
  };
}
