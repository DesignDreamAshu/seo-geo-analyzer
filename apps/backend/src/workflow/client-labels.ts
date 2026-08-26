/**
 * Phase 28K: Client-Safe Presentation Label and Explanation Map.
 * Provides professional, business-friendly labels and descriptions
 * separating internal diagnostic codes from client-facing executive reports.
 */

export interface RuleClientPresentation {
  clientSafeLabel: string;
  businessImpact: string;
  remediationSummary: string;
}

export const RULE_CLIENT_PRESENTATIONS: Record<string, RuleClientPresentation> = {
  CONTENT_SKIPPED_HEADINGS: {
    clientSafeLabel: "Heading Hierarchy Improvement",
    businessImpact: "Helps AI systems and search engines understand page structure and main service concepts.",
    remediationSummary: "Organize heading tags (H1, H2, H3) sequentially without skipping levels.",
  },
  META_DESCRIPTION_MISSING: {
    clientSafeLabel: "Missing Search Snippet Descriptions",
    businessImpact: "Improves organic click-through rate from search result pages and informs AI summaries.",
    remediationSummary: "Add compelling, unique 150-160 character meta descriptions to target pages.",
  },
  TITLE_TAG_MISSING: {
    clientSafeLabel: "Missing Primary Page Title",
    businessImpact: "Critical signal for primary keyword targeting and search snippet branding.",
    remediationSummary: "Specify an authoritative, keyword-focused title tag on each indexable page.",
  },
  TECH_MISSING_CANONICAL: {
    clientSafeLabel: "Missing Canonical URL Declaration",
    businessImpact: "Prevents duplicate content issues and consolidates search ranking authority.",
    remediationSummary: "Add self-referencing canonical link tags to all primary pages.",
  },
  IMAGES_MISSING_ALT_TEXT: {
    clientSafeLabel: "Images Missing Descriptive Alt Text",
    businessImpact: "Enhances accessibility compliance and visual image search discoverability.",
    remediationSummary: "Add concise, descriptive alt attributes explaining image content.",
  },
  IMAGES_MISSING_EXPLICIT_DIMENSIONS: {
    clientSafeLabel: "Images Missing Explicit Layout Dimensions",
    businessImpact: "Prevents layout shifts (Cumulative Layout Shift) improving user experience and Core Web Vitals.",
    remediationSummary: "Include explicit width and height attributes or CSS aspect-ratio on image elements.",
  },
  TECH_REDIRECT_CHAIN: {
    clientSafeLabel: "Multi-Hop URL Redirect Chains",
    businessImpact: "Wastes crawl budget and adds page load latency for visitors.",
    remediationSummary: "Update links to point directly to final destination URLs, avoiding intermediate hops.",
  },
  TECH_BROKEN_INTERNAL_LINK: {
    clientSafeLabel: "Broken Internal Links (404 Not Found)",
    businessImpact: "Damages user experience and blocks search crawlers from discovering linked content.",
    remediationSummary: "Fix or remove broken internal links pointing to non-existent pages.",
  },
  ACCESSIBILITY_UNLABELLED_FORM_CONTROL: {
    clientSafeLabel: "Form Inputs Missing Accessibility Labels",
    businessImpact: "Ensures legal ADA accessibility compliance and assists screen reader users in converting.",
    remediationSummary: "Associate explicit <label for> tags or aria-label attributes with form inputs.",
  },
  STRUCTURED_DATA_SYNTAX_ERROR: {
    clientSafeLabel: "Schema Markup Validation Warning",
    businessImpact: "Enables Google Rich Results and AI knowledge graph entity attribution.",
    remediationSummary: "Correct JSON-LD syntax errors to ensure search engines parse structured data properly.",
  },
  AI_OPTIMIZATION_GAP: {
    clientSafeLabel: "AI Search Answer Depth Opportunity",
    businessImpact: "Increases brand citation likelihood in generative AI engines (ChatGPT, Perplexity, Gemini).",
    remediationSummary: "Incorporate direct structured answer blocks and verified case proof into key landing pages.",
  },
  COMPETITIVE_BENCHMARK_GAP: {
    clientSafeLabel: "Competitive Semantic Content Gap",
    businessImpact: "Captures discovery search queries currently won by key industry competitors.",
    remediationSummary: "Develop dedicated, original service guidance covering missing evaluation criteria.",
  },
};

export function getClientSafePresentation(ruleIdOrCategory: string, defaultTitle?: string): RuleClientPresentation {
  if (RULE_CLIENT_PRESENTATIONS[ruleIdOrCategory]) {
    return RULE_CLIENT_PRESENTATIONS[ruleIdOrCategory];
  }

  // Generate fallback friendly title
  const formatted = (defaultTitle || ruleIdOrCategory)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    clientSafeLabel: formatted,
    businessImpact: "Contributes to overall search discoverability, user experience, and technical site health.",
    remediationSummary: `Address ${formatted.toLowerCase()} following web standards and best practices.`,
  };
}
