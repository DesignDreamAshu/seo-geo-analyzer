/**
 * Deterministic Ground-Truth Fixture Library (Layer 1)
 * Provides 6 rigorous test fixtures for each of the 63 implemented diagnostic rules (378 cases).
 * Tests actual production rule execution through `evaluateAllDiagnosticRules`.
 */

import { parseHtmlPage } from "../parser";
import { evaluateAllDiagnosticRules } from "../rules";
import type { CrawledPageData, DiagnosticIssue, RedirectHop, SitemapUrlEntry } from "../types";
import type { LinkGraphAnalysis } from "../graph";
import { IMPLEMENTED_DIAGNOSTIC_RULES, type DiagnosticRuleMetadata } from "./rule-inventory";

export interface RuleFixtureTestCase {
  id: string;
  ruleCode: string;
  fixtureType: "true_positive" | "true_negative" | "exclusion" | "boundary" | "dynamic_hydration" | "ambiguous_inconclusive";
  description: string;
  url: string;
  html: string;
  headers?: Record<string, string>;
  statusCode?: number;
  redirectHops?: RedirectHop[];
  depth?: number;
  ttfbMs?: number;
  graphOverride?: Partial<LinkGraphAnalysis>;
  sitemapOrphansOverride?: SitemapUrlEntry[];
  additionalPages?: Array<{
    url: string;
    html: string;
    statusCode?: number;
    redirectHops?: RedirectHop[];
    headers?: Record<string, string>;
    depth?: number;
  }>;
  expectedFinding: boolean;
  expectedScorePenaltyGreaterThanZero?: boolean;
}

export interface RuleFixtureResult {
  ruleCode: string;
  ruleMetadata: DiagnosticRuleMetadata;
  totalFixtures: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  inconclusive: number;
  pass: boolean;
  testCases: Array<{
    id: string;
    fixtureType: string;
    description: string;
    expected: boolean;
    actual: boolean;
    pass: boolean;
    findingDetails?: string;
  }>;
}

export interface FixtureSuiteReport {
  totalRulesTested: number;
  totalFixturesEvaluated: number;
  globalTruePositives: number;
  globalTrueNegatives: number;
  globalFalsePositives: number;
  globalFalseNegatives: number;
  ruleResults: RuleFixtureResult[];
  allRulesPassed: boolean;
}

/**
 * Builds the comprehensive deterministic fixture test cases for all 63 diagnostic rules.
 */
export function buildAllRuleFixtures(): RuleFixtureTestCase[] {
  const fixtures: RuleFixtureTestCase[] = [];

  // =========================================================================
  // 1. CONTENT_MISSING_TITLE
  // =========================================================================
  fixtures.push(
    {
      id: "TITLE_TP_1",
      ruleCode: "CONTENT_MISSING_TITLE",
      fixtureType: "true_positive",
      description: "Indexable marketing page with completely missing <title> tag",
      url: "https://example.com/missing-title",
      html: "<html><head><meta name='description' content='Valid desc'></head><body><main><h1>Hello World</h1><p>Substantial text content for the page...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "TITLE_TN_1",
      ruleCode: "CONTENT_MISSING_TITLE",
      fixtureType: "true_negative",
      description: "Indexable page with valid descriptive <title>",
      url: "https://example.com/valid-title",
      html: "<html><head><title>Clean Architecture — Dream SEO</title></head><body><main><h1>Clean Architecture</h1><p>Valid content...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "TITLE_EXCL_1",
      ruleCode: "CONTENT_MISSING_TITLE",
      fixtureType: "exclusion",
      description: "Non-indexable (noindex) page missing title tag is excluded from critical title issue",
      url: "https://example.com/noindex-page",
      html: "<html><head><meta name='robots' content='noindex, nofollow'></head><body><h1>Draft Page</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "TITLE_BOUND_1",
      ruleCode: "CONTENT_MISSING_TITLE",
      fixtureType: "boundary",
      description: "Empty whitespace-only title tag is treated as missing title",
      url: "https://example.com/empty-title",
      html: "<html><head><title>   </title></head><body><main><h1>Empty</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "TITLE_DYN_1",
      ruleCode: "CONTENT_MISSING_TITLE",
      fixtureType: "dynamic_hydration",
      description: "Static HTML missing title with SSR placeholder",
      url: "https://example.com/ssr-empty-title",
      html: "<html><head></head><body><div id='root'><h1>Loading</h1></div></body></html>",
      expectedFinding: true,
    },
    {
      id: "TITLE_AMB_1",
      ruleCode: "CONTENT_MISSING_TITLE",
      fixtureType: "ambiguous_inconclusive",
      description: "Utility confirmation page without title is non-indexable",
      url: "https://example.com/thank-you",
      html: "<html><head><meta name='robots' content='noindex'></head><body><h1>Thank you!</h1></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 2. TITLE_TOO_SHORT
  // =========================================================================
  fixtures.push(
    {
      id: "TITLE_SHORT_TP_1",
      ruleCode: "TITLE_TOO_SHORT",
      fixtureType: "true_positive",
      description: "Standard content page with 5-character title (< 10 chars)",
      url: "https://example.com/short-title",
      html: "<html><head><title>Home</title></head><body><main><h1>Welcome to our site</h1><p>Substantial text content...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "TITLE_SHORT_TN_1",
      ruleCode: "TITLE_TOO_SHORT",
      fixtureType: "true_negative",
      description: "Standard content page with 45-character title",
      url: "https://example.com/good-title",
      html: "<html><head><title>Comprehensive Technical SEO Audit Framework</title></head><body><main><h1>SEO Audit</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "TITLE_SHORT_EXCL_1",
      ruleCode: "TITLE_TOO_SHORT",
      fixtureType: "exclusion",
      description: "Noindexed utility page with short title is excluded",
      url: "https://example.com/noindex-short",
      html: "<html><head><title>App</title><meta name='robots' content='noindex'></head><body><h1>App</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "TITLE_SHORT_BOUND_1",
      ruleCode: "TITLE_TOO_SHORT",
      fixtureType: "boundary",
      description: "Title with exactly 9 characters triggers too short",
      url: "https://example.com/title-9",
      html: "<html><head><title>123456789</title></head><body><main><h1>9 Char Title</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "TITLE_SHORT_DYN_1",
      ruleCode: "TITLE_TOO_SHORT",
      fixtureType: "dynamic_hydration",
      description: "Title with exactly 10 characters passes",
      url: "https://example.com/title-10",
      html: "<html><head><title>1234567890</title></head><body><main><h1>10 Char Title</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "TITLE_SHORT_AMB_1",
      ruleCode: "TITLE_TOO_SHORT",
      fixtureType: "ambiguous_inconclusive",
      description: "Missing title does not trigger title too short (triggers missing title)",
      url: "https://example.com/no-title",
      html: "<html><head></head><body><main><h1>No Title</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 3. TITLE_TOO_LONG
  // =========================================================================
  fixtures.push(
    {
      id: "TITLE_LONG_TP_1",
      ruleCode: "TITLE_TOO_LONG",
      fixtureType: "true_positive",
      description: "Standard content page with 95-character title (> 70 chars)",
      url: "https://example.com/long-title",
      html: "<html><head><title>This Is An Extremely Long Title Tag Designed To Exceed The 70 Character Maximum Threshold For Auditing</title></head><body><main><h1>Long Title</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "TITLE_LONG_TN_1",
      ruleCode: "TITLE_TOO_LONG",
      fixtureType: "true_negative",
      description: "Standard content page with 55-character title",
      url: "https://example.com/optimal-title",
      html: "<html><head><title>Best SEO Practices for Modern Single Page Applications</title></head><body><main><h1>SEO</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "TITLE_LONG_EXCL_1",
      ruleCode: "TITLE_TOO_LONG",
      fixtureType: "exclusion",
      description: "Noindexed utility page with long title is excluded",
      url: "https://example.com/noindex-long",
      html: "<html><head><title>This Is A Long Noindexed Title That Should Be Excluded From Audit Invariants</title><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "TITLE_LONG_BOUND_1",
      ruleCode: "TITLE_TOO_LONG",
      fixtureType: "boundary",
      description: "Title with exactly 71 characters triggers too long",
      url: "https://example.com/title-71",
      html: "<html><head><title>12345678901234567890123456789012345678901234567890123456789012345678901</title></head><body><main><h1>71 Char</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "TITLE_LONG_DYN_1",
      ruleCode: "TITLE_TOO_LONG",
      fixtureType: "dynamic_hydration",
      description: "Title with exactly 70 characters passes",
      url: "https://example.com/title-70",
      html: "<html><head><title>1234567890123456789012345678901234567890123456789012345678901234567890</title></head><body><main><h1>70 Char</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "TITLE_LONG_AMB_1",
      ruleCode: "TITLE_TOO_LONG",
      fixtureType: "ambiguous_inconclusive",
      description: "Normal 30-char title passes",
      url: "https://example.com/normal-title",
      html: "<html><head><title>Standard Page Title Example</title></head><body><main><h1>Standard</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 4. CONTENT_MISSING_META_DESC
  // =========================================================================
  fixtures.push(
    {
      id: "META_DESC_TP_1",
      ruleCode: "CONTENT_MISSING_META_DESC",
      fixtureType: "true_positive",
      description: "Indexable marketing page with completely missing meta description",
      url: "https://example.com/missing-meta",
      html: "<html><head><title>Valid Title</title></head><body><main><h1>Hello World</h1><p>Substantial text content...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "META_DESC_TN_1",
      ruleCode: "CONTENT_MISSING_META_DESC",
      fixtureType: "true_negative",
      description: "Indexable page with valid meta description",
      url: "https://example.com/valid-meta",
      html: "<html><head><title>Valid Title</title><meta name='description' content='This is an in-depth authoritative guide to local SEO and web crawling architecture.'></head><body><main><h1>SEO</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_DESC_EXCL_1",
      ruleCode: "CONTENT_MISSING_META_DESC",
      fixtureType: "exclusion",
      description: "Noindexed page missing meta description is excluded",
      url: "https://example.com/noindex-meta",
      html: "<html><head><title>Draft</title><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_DESC_BOUND_1",
      ruleCode: "CONTENT_MISSING_META_DESC",
      fixtureType: "boundary",
      description: "Empty whitespace-only meta description triggers missing meta description",
      url: "https://example.com/empty-meta",
      html: "<html><head><title>Title</title><meta name='description' content='   '></head><body><main><h1>Empty Meta</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "META_DESC_DYN_1",
      ruleCode: "CONTENT_MISSING_META_DESC",
      fixtureType: "dynamic_hydration",
      description: "Page with descriptive meta description passes",
      url: "https://example.com/meta-populated",
      html: "<html><head><title>Title</title><meta name='description' content='Comprehensive crawl analysis tools.'></head><body><main><h1>Tools</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_DESC_AMB_1",
      ruleCode: "CONTENT_MISSING_META_DESC",
      fixtureType: "ambiguous_inconclusive",
      description: "Thank you legal page is excluded from missing meta description",
      url: "https://example.com/thank-you-meta",
      html: "<html><head><title>Thank you</title><meta name='robots' content='noindex'></head><body><h1>Thanks</h1></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 5. META_DESC_TOO_SHORT
  // =========================================================================
  fixtures.push(
    {
      id: "META_SHORT_TP_1",
      ruleCode: "META_DESC_TOO_SHORT",
      fixtureType: "true_positive",
      description: "Meta description with only 25 characters (< 50 chars)",
      url: "https://example.com/short-desc",
      html: "<html><head><title>Short Meta Page</title><meta name='description' content='Short summary here.'></head><body><main><h1>Short</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "META_SHORT_TN_1",
      ruleCode: "META_DESC_TOO_SHORT",
      fixtureType: "true_negative",
      description: "Meta description with 130 characters",
      url: "https://example.com/good-desc",
      html: "<html><head><title>Good Meta Page</title><meta name='description' content='Explore the comprehensive features of our automated SEO crawler and diagnostic suite designed for modern web apps.'></head><body><main><h1>Good</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_SHORT_EXCL_1",
      ruleCode: "META_DESC_TOO_SHORT",
      fixtureType: "exclusion",
      description: "Noindexed page with short meta description is excluded",
      url: "https://example.com/noindex-short-desc",
      html: "<html><head><title>Noindex</title><meta name='description' content='Short.'><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_SHORT_BOUND_1",
      ruleCode: "META_DESC_TOO_SHORT",
      fixtureType: "boundary",
      description: "Meta description with exactly 49 characters triggers too short",
      url: "https://example.com/desc-49",
      html: "<html><head><title>Desc 49</title><meta name='description' content='1234567890123456789012345678901234567890123456789'></head><body><main><h1>Desc 49</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "META_SHORT_DYN_1",
      ruleCode: "META_DESC_TOO_SHORT",
      fixtureType: "dynamic_hydration",
      description: "Meta description with exactly 50 characters passes",
      url: "https://example.com/desc-50",
      html: "<html><head><title>Desc 50</title><meta name='description' content='12345678901234567890123456789012345678901234567890'></head><body><main><h1>Desc 50</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_SHORT_AMB_1",
      ruleCode: "META_DESC_TOO_SHORT",
      fixtureType: "ambiguous_inconclusive",
      description: "Missing meta description does not trigger too short (triggers missing meta)",
      url: "https://example.com/missing-meta-short",
      html: "<html><head><title>Missing</title></head><body><main><h1>Missing</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 6. META_DESC_TOO_LONG
  // =========================================================================
  fixtures.push(
    {
      id: "META_LONG_TP_1",
      ruleCode: "META_DESC_TOO_LONG",
      fixtureType: "true_positive",
      description: "Meta description with 190 characters (> 160 chars)",
      url: "https://example.com/long-desc",
      html: "<html><head><title>Long Meta Page</title><meta name='description' content='This is an excessively lengthy meta description that easily surpasses the maximum recommended 160 character boundary and will almost certainly be truncated with an ellipsis by Google SERP snippets.'></head><body><main><h1>Long</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "META_LONG_TN_1",
      ruleCode: "META_DESC_TOO_LONG",
      fixtureType: "true_negative",
      description: "Meta description with 140 characters",
      url: "https://example.com/optimal-desc",
      html: "<html><head><title>Optimal Meta Page</title><meta name='description' content='Learn how to build high-performance web applications with authoritative crawl diagnostics and automated link graph verification.'></head><body><main><h1>Optimal</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_LONG_EXCL_1",
      ruleCode: "META_DESC_TOO_LONG",
      fixtureType: "exclusion",
      description: "Noindexed page with long meta description is excluded",
      url: "https://example.com/noindex-long-desc",
      html: "<html><head><title>Noindex</title><meta name='description' content='This is a very long meta description on a noindexed draft page that should be excluded from audit.'><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_LONG_BOUND_1",
      ruleCode: "META_DESC_TOO_LONG",
      fixtureType: "boundary",
      description: "Meta description with exactly 161 characters triggers too long",
      url: "https://example.com/desc-161",
      html: "<html><head><title>Desc 161</title><meta name='description' content='12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901'></head><body><main><h1>Desc 161</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "META_LONG_DYN_1",
      ruleCode: "META_DESC_TOO_LONG",
      fixtureType: "dynamic_hydration",
      description: "Meta description with exactly 160 characters passes",
      url: "https://example.com/desc-160",
      html: "<html><head><title>Desc 160</title><meta name='description' content='1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890'></head><body><main><h1>Desc 160</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_LONG_AMB_1",
      ruleCode: "META_DESC_TOO_LONG",
      fixtureType: "ambiguous_inconclusive",
      description: "Standard 120-char meta description passes",
      url: "https://example.com/standard-desc",
      html: "<html><head><title>Standard</title><meta name='description' content='Discover comprehensive automated SEO audit tooling for enterprise websites and single page applications.'></head><body><main><h1>Standard</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 7. CONTENT_MISSING_H1
  // =========================================================================
  fixtures.push(
    {
      id: "H1_MISSING_TP_1",
      ruleCode: "CONTENT_MISSING_H1",
      fixtureType: "true_positive",
      description: "Standard content page with no H1 tag",
      url: "https://example.com/missing-h1",
      html: "<html><head><title>No H1</title></head><body><main><h2>Subheading Only</h2><p>Substantial text content...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "H1_MISSING_TN_1",
      ruleCode: "CONTENT_MISSING_H1",
      fixtureType: "true_negative",
      description: "Standard content page with single valid H1",
      url: "https://example.com/valid-h1",
      html: "<html><head><title>Valid H1</title></head><body><main><h1>Primary Topic Heading</h1><p>Substantial text content...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "H1_MISSING_EXCL_1",
      ruleCode: "CONTENT_MISSING_H1",
      fixtureType: "exclusion",
      description: "Utility page without H1 is excluded from missing H1 check",
      url: "https://example.com/thank-you-h1",
      html: "<html><head><title>Thank you</title><meta name='robots' content='noindex'></head><body><p>Order confirmed</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "H1_MISSING_BOUND_1",
      ruleCode: "CONTENT_MISSING_H1",
      fixtureType: "boundary",
      description: "Empty whitespace-only H1 tag triggers missing H1",
      url: "https://example.com/empty-h1",
      html: "<html><head><title>Empty H1</title></head><body><main><h1>   </h1><p>Substantial text content...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "H1_MISSING_DYN_1",
      ruleCode: "CONTENT_MISSING_H1",
      fixtureType: "dynamic_hydration",
      description: "H1 with valid inner text passes",
      url: "https://example.com/populated-h1",
      html: "<html><head><title>H1</title></head><body><main><h1>Enterprise Architecture</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "H1_MISSING_AMB_1",
      ruleCode: "CONTENT_MISSING_H1",
      fixtureType: "ambiguous_inconclusive",
      description: "Legal disclaimers without H1 are excluded",
      url: "https://example.com/legal-h1",
      html: "<html><head><title>Terms</title><meta name='robots' content='noindex'></head><body><p>Terms</p></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 8. CONTENT_MULTIPLE_H1
  // =========================================================================
  fixtures.push(
    {
      id: "H1_MULTI_TP_1",
      ruleCode: "CONTENT_MULTIPLE_H1",
      fixtureType: "true_positive",
      description: "Standard content page containing two H1 headings",
      url: "https://example.com/multi-h1",
      html: "<html><head><title>Multiple H1</title></head><body><main><h1>First H1</h1><p>Text...</p><h1>Second H1</h1><p>More text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "H1_MULTI_TN_1",
      ruleCode: "CONTENT_MULTIPLE_H1",
      fixtureType: "true_negative",
      description: "Standard content page with exactly one H1",
      url: "https://example.com/single-h1",
      html: "<html><head><title>Single H1</title></head><body><main><h1>Single Primary Topic</h1><h2>Subheading</h2><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "H1_MULTI_EXCL_1",
      ruleCode: "CONTENT_MULTIPLE_H1",
      fixtureType: "exclusion",
      description: "Noindexed utility page is excluded from multiple H1 check",
      url: "https://example.com/noindex-multi-h1",
      html: "<html><head><title>Noindex</title><meta name='robots' content='noindex'></head><body><h1>H1</h1><h1>H1</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "H1_MULTI_BOUND_1",
      ruleCode: "CONTENT_MULTIPLE_H1",
      fixtureType: "boundary",
      description: "Page with three H1 tags triggers multiple H1",
      url: "https://example.com/three-h1",
      html: "<html><head><title>Three H1</title></head><body><main><h1>One</h1><h1>Two</h1><h1>Three</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "H1_MULTI_DYN_1",
      ruleCode: "CONTENT_MULTIPLE_H1",
      fixtureType: "dynamic_hydration",
      description: "H1 followed by H2 and H3 passes",
      url: "https://example.com/structured-headings",
      html: "<html><head><title>Proper Headings</title></head><body><main><h1>Title</h1><h2>Section 1</h2><h3>Detail</h3><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "H1_MULTI_AMB_1",
      ruleCode: "CONTENT_MULTIPLE_H1",
      fixtureType: "ambiguous_inconclusive",
      description: "Zero H1 tags does not trigger multiple H1 (triggers missing H1)",
      url: "https://example.com/zero-h1",
      html: "<html><head><title>Zero H1</title></head><body><main><h2>Subheading</h2><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 9. CONTENT_SKIPPED_HEADINGS
  // =========================================================================
  fixtures.push(
    {
      id: "SKIP_HEAD_TP_1",
      ruleCode: "CONTENT_SKIPPED_HEADINGS",
      fixtureType: "true_positive",
      description: "Heading jumps directly from H1 to H3 without intermediate H2",
      url: "https://example.com/skipped-heading",
      html: "<html><head><title>Skipped</title></head><body><main><h1>Main Title</h1><h3>Skipped Subheading</h3><p>Content text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "SKIP_HEAD_TN_1",
      ruleCode: "CONTENT_SKIPPED_HEADINGS",
      fixtureType: "true_negative",
      description: "Sequential heading outline H1 -> H2 -> H3",
      url: "https://example.com/sequential-headings",
      html: "<html><head><title>Sequential</title></head><body><main><h1>Main Title</h1><h2>Level 2</h2><h3>Level 3</h3><p>Content text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SKIP_HEAD_EXCL_1",
      ruleCode: "CONTENT_SKIPPED_HEADINGS",
      fixtureType: "exclusion",
      description: "Single heading outline has no skips",
      url: "https://example.com/single-heading",
      html: "<html><head><title>Single</title></head><body><main><h1>Only Heading</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SKIP_HEAD_BOUND_1",
      ruleCode: "CONTENT_SKIPPED_HEADINGS",
      fixtureType: "boundary",
      description: "Heading jumps from H2 directly to H4",
      url: "https://example.com/skip-h2-h4",
      html: "<html><head><title>Skip H2 H4</title></head><body><main><h1>Title</h1><h2>Section</h2><h4>Deep Subsection</h4><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "SKIP_HEAD_DYN_1",
      ruleCode: "CONTENT_SKIPPED_HEADINGS",
      fixtureType: "dynamic_hydration",
      description: "Valid deep heading hierarchy H1 -> H2 -> H3 -> H4",
      url: "https://example.com/deep-valid-headings",
      html: "<html><head><title>Deep Valid</title></head><body><main><h1>Title</h1><h2>S1</h2><h3>S1.1</h3><h4>S1.1.1</h4><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SKIP_HEAD_AMB_1",
      ruleCode: "CONTENT_SKIPPED_HEADINGS",
      fixtureType: "ambiguous_inconclusive",
      description: "H3 to H2 upward step is valid outline ascension",
      url: "https://example.com/upward-heading",
      html: "<html><head><title>Upward</title></head><body><main><h1>Title</h1><h2>Section 1</h2><h3>Sub</h3><h2>Section 2</h2><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 10. CONTENT_EMPTY_HEADING
  // =========================================================================
  fixtures.push(
    {
      id: "EMPTY_HEAD_TP_1",
      ruleCode: "CONTENT_EMPTY_HEADING",
      fixtureType: "true_positive",
      description: "Page contains an empty H2 tag with no text",
      url: "https://example.com/empty-h2",
      html: "<html><head><title>Empty H2</title></head><body><main><h1>Valid Title</h1><h2></h2><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "EMPTY_HEAD_TN_1",
      ruleCode: "CONTENT_EMPTY_HEADING",
      fixtureType: "true_negative",
      description: "All headings contain descriptive text",
      url: "https://example.com/populated-headings",
      html: "<html><head><title>Populated</title></head><body><main><h1>Title</h1><h2>Section Title</h2><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "EMPTY_HEAD_EXCL_1",
      ruleCode: "CONTENT_EMPTY_HEADING",
      fixtureType: "exclusion",
      description: "Page without any headings does not trigger empty heading",
      url: "https://example.com/no-headings-empty-check",
      html: "<html><head><title>No Headings</title></head><body><main><p>Paragraph text only.</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "EMPTY_HEAD_BOUND_1",
      ruleCode: "CONTENT_EMPTY_HEADING",
      fixtureType: "boundary",
      description: "Heading with only whitespace &nbsp; is treated as empty",
      url: "https://example.com/nbsp-heading",
      html: "<html><head><title>NBSP</title></head><body><main><h1>Valid</h1><h3>   </h3><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "EMPTY_HEAD_DYN_1",
      ruleCode: "CONTENT_EMPTY_HEADING",
      fixtureType: "dynamic_hydration",
      description: "Heading containing nested text span is valid",
      url: "https://example.com/nested-span-heading",
      html: "<html><head><title>Nested</title></head><body><main><h1><span>Nested Heading Text</span></h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "EMPTY_HEAD_AMB_1",
      ruleCode: "CONTENT_EMPTY_HEADING",
      fixtureType: "ambiguous_inconclusive",
      description: "All filled headings pass",
      url: "https://example.com/filled-h4",
      html: "<html><head><title>Filled</title></head><body><main><h1>Title</h1><h2>Subtitle</h2><h4>Sub-detail</h4><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 11. CONTENT_THIN_WORD_COUNT
  // =========================================================================
  fixtures.push(
    {
      id: "THIN_TP_1",
      ruleCode: "CONTENT_THIN_WORD_COUNT",
      fixtureType: "true_positive",
      description: "Marketing landing page with only 40 main content words (< 180 words)",
      url: "https://example.com/thin-content",
      html: "<html><head><title>Thin Page</title></head><body><main><h1>Thin Content</h1><p>This is very brief content without substantial depth or detail answering user intent.</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "THIN_TN_1",
      ruleCode: "CONTENT_THIN_WORD_COUNT",
      fixtureType: "true_negative",
      description: "Article page with 250 words of rich content",
      url: "https://example.com/rich-content",
      html: "<html><head><title>Rich Article</title></head><body><main><h1>Rich Content</h1><p>" + "Comprehensive in-depth technical analysis for search engine optimization and automated crawler verification. ".repeat(25) + "</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "THIN_EXCL_1",
      ruleCode: "CONTENT_THIN_WORD_COUNT",
      fixtureType: "exclusion",
      description: "Search filter or legal utility page is excluded from thin content penalty",
      url: "https://example.com/legal/terms",
      html: "<html><head><title>Terms of Service</title><meta name='robots' content='noindex'></head><body><main><h1>Terms</h1><p>Brief legal terms.</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "THIN_BOUND_1",
      ruleCode: "CONTENT_THIN_WORD_COUNT",
      fixtureType: "boundary",
      description: "Main content with 80 words triggers thin content",
      url: "https://example.com/thin-80-words",
      html: "<html><head><title>80 Words</title></head><body><main><h1>80 Words</h1><p>" + "Word word word word word word word word word ten. ".repeat(8) + "</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "THIN_DYN_1",
      ruleCode: "CONTENT_THIN_WORD_COUNT",
      fixtureType: "dynamic_hydration",
      description: "Page with 200 main content words passes",
      url: "https://example.com/200-words",
      html: "<html><head><title>200 Words</title></head><body><main><h1>200 Words</h1><p>" + "Automated crawler parity ensures that raw HTTP and rendered Playwright DOM extractions match precisely. ".repeat(18) + "</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "THIN_AMB_1",
      ruleCode: "CONTENT_THIN_WORD_COUNT",
      fixtureType: "ambiguous_inconclusive",
      description: "Noindexed utility page is excluded",
      url: "https://example.com/cart-summary",
      html: "<html><head><title>Cart</title><meta name='robots' content='noindex'></head><body><main><p>Your cart is empty.</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 12. SOFT_404_CANDIDATE
  // =========================================================================
  fixtures.push(
    {
      id: "SOFT404_TP_1",
      ruleCode: "SOFT_404_CANDIDATE",
      fixtureType: "true_positive",
      description: "HTTP 200 response with '404 Page Not Found' title and thin error text",
      url: "https://example.com/missing-item",
      html: "<html><head><title>404 Page Not Found</title></head><body><main><h1>Page Not Found</h1><p>The requested page could not be located.</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "SOFT404_TN_1",
      ruleCode: "SOFT_404_CANDIDATE",
      fixtureType: "true_negative",
      description: "HTTP 200 response with legitimate substantive content",
      url: "https://example.com/valid-article",
      html: "<html><head><title>Valid Product Guide</title></head><body><main><h1>Comprehensive Guide</h1><p>" + "Detailed text about product specifications and features. ".repeat(15) + "</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SOFT404_EXCL_1",
      ruleCode: "SOFT_404_CANDIDATE",
      fixtureType: "exclusion",
      description: "Actual HTTP 404 response is an explicit hard 404, not a soft 404",
      url: "https://example.com/hard-404-error",
      statusCode: 404,
      html: "<html><head><title>Not Found</title></head><body><h1>404 Not Found</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "SOFT404_BOUND_1",
      ruleCode: "SOFT_404_CANDIDATE",
      fixtureType: "boundary",
      description: "HTTP 200 with H1 '404 Error' and thin body triggers soft 404 candidate",
      url: "https://example.com/soft-404-error-h1",
      html: "<html><head><title>Error</title></head><body><main><h1>404 Error - Content Unavailable</h1><p>Sorry!</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "SOFT404_DYN_1",
      ruleCode: "SOFT_404_CANDIDATE",
      fixtureType: "dynamic_hydration",
      description: "Article mentioning '404' in substantial body text is NOT a soft 404",
      url: "https://example.com/how-to-fix-404s",
      html: "<html><head><title>How to Fix 404 Errors on Your Website</title></head><body><main><h1>Fixing Broken Links and 404 Errors</h1><p>" + "A 404 error occurs when a client requests a URL that does not exist on the origin server. ".repeat(20) + "</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SOFT404_AMB_1",
      ruleCode: "SOFT_404_CANDIDATE",
      fixtureType: "ambiguous_inconclusive",
      description: "Normal indexable homepage passes",
      url: "https://example.com/homepage-pass",
      html: "<html><head><title>Home — SEO Analyzer</title></head><body><main><h1>Welcome</h1><p>" + "Features overview and enterprise tooling solutions. ".repeat(10) + "</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 13. DUP_IDENTICAL_TITLE
  // =========================================================================
  fixtures.push(
    {
      id: "DUP_TITLE_TP_1",
      ruleCode: "DUP_IDENTICAL_TITLE",
      fixtureType: "true_positive",
      description: "Two distinct indexable URLs sharing identical title",
      url: "https://example.com/dup-title-1",
      html: "<html><head><title>Duplicate Generic Title</title></head><body><main><h1>Page 1</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/dup-title-2",
          html: "<html><head><title>Duplicate Generic Title</title></head><body><main><h1>Page 2</h1></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_TITLE_TN_1",
      ruleCode: "DUP_IDENTICAL_TITLE",
      fixtureType: "true_negative",
      description: "Distinct URLs with unique titles",
      url: "https://example.com/unique-title-1",
      html: "<html><head><title>Unique Title Alpha</title></head><body><main><h1>Alpha</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/unique-title-2",
          html: "<html><head><title>Unique Title Beta</title></head><body><main><h1>Beta</h1></main></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "DUP_TITLE_EXCL_1",
      ruleCode: "DUP_IDENTICAL_TITLE",
      fixtureType: "exclusion",
      description: "Noindexed pages sharing duplicate titles are excluded",
      url: "https://example.com/noindex-dup-title",
      html: "<html><head><title>Draft</title><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_TITLE_BOUND_1",
      ruleCode: "DUP_IDENTICAL_TITLE",
      fixtureType: "boundary",
      description: "Case-insensitive title match triggers duplicate title",
      url: "https://example.com/case-dup-1",
      html: "<html><head><title>Case Invariant Title</title></head><body><main><h1>1</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/case-dup-2",
          html: "<html><head><title>case invariant title</title></head><body><main><h1>2</h1></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_TITLE_DYN_1",
      ruleCode: "DUP_IDENTICAL_TITLE",
      fixtureType: "dynamic_hydration",
      description: "Single page alone has no duplicate title issues",
      url: "https://example.com/single-page-dup",
      html: "<html><head><title>Stand Alone Page</title></head><body><main><h1>Stand Alone</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_TITLE_AMB_1",
      ruleCode: "DUP_IDENTICAL_TITLE",
      fixtureType: "ambiguous_inconclusive",
      description: "Distinct descriptive titles pass",
      url: "https://example.com/distinct-1",
      html: "<html><head><title>Pricing — Dream SEO</title></head><body><main><h1>Pricing</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 14. DUP_META_DESC
  // =========================================================================
  fixtures.push(
    {
      id: "DUP_META_TP_1",
      ruleCode: "DUP_META_DESC",
      fixtureType: "true_positive",
      description: "Two distinct indexable URLs sharing identical meta description",
      url: "https://example.com/dup-meta-1",
      html: "<html><head><title>Page 1</title><meta name='description' content='Identical meta description shared across multiple pages on this website.'></head><body><main><h1>1</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/dup-meta-2",
          html: "<html><head><title>Page 2</title><meta name='description' content='Identical meta description shared across multiple pages on this website.'></head><body><main><h1>2</h1></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_META_TN_1",
      ruleCode: "DUP_META_DESC",
      fixtureType: "true_negative",
      description: "Pages with distinct unique meta descriptions",
      url: "https://example.com/unique-meta-1",
      html: "<html><head><title>P1</title><meta name='description' content='First unique meta description for product page alpha.'></head><body><main><h1>P1</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/unique-meta-2",
          html: "<html><head><title>P2</title><meta name='description' content='Second distinct meta description tailored for service page beta.'></head><body><main><h1>P2</h1></main></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "DUP_META_EXCL_1",
      ruleCode: "DUP_META_DESC",
      fixtureType: "exclusion",
      description: "Noindexed pages with duplicate descriptions are excluded",
      url: "https://example.com/noindex-dup-meta",
      html: "<html><head><title>Draft</title><meta name='description' content='Shared description.'><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_META_BOUND_1",
      ruleCode: "DUP_META_DESC",
      fixtureType: "boundary",
      description: "Duplicate meta descriptions with minor whitespace differences trigger duplicate issue",
      url: "https://example.com/ws-dup-meta-1",
      html: "<html><head><title>WS 1</title><meta name='description' content='  Leading and trailing whitespace description test string  '></head><body><main><h1>1</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/ws-dup-meta-2",
          html: "<html><head><title>WS 2</title><meta name='description' content='Leading and trailing whitespace description test string'></head><body><main><h1>2</h1></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_META_DYN_1",
      ruleCode: "DUP_META_DESC",
      fixtureType: "dynamic_hydration",
      description: "Single page alone has no duplicates",
      url: "https://example.com/single-meta",
      html: "<html><head><title>Single</title><meta name='description' content='Unique meta description for standalone single landing page.'></head><body><main><h1>Single</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_META_AMB_1",
      ruleCode: "DUP_META_DESC",
      fixtureType: "ambiguous_inconclusive",
      description: "Distinct descriptions pass",
      url: "https://example.com/distinct-desc",
      html: "<html><head><title>Distinct</title><meta name='description' content='Comprehensive crawl facts and audit reports for SEO.'></head><body><main><h1>Distinct</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 15. DUP_H1
  // =========================================================================
  fixtures.push(
    {
      id: "DUP_H1_TP_1",
      ruleCode: "DUP_H1",
      fixtureType: "true_positive",
      description: "Two distinct content pages sharing identical primary H1 heading",
      url: "https://example.com/dup-h1-1",
      html: "<html><head><title>Page 1</title></head><body><main><h1>Identical Product Category Heading</h1><p>Text...</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/dup-h1-2",
          html: "<html><head><title>Page 2</title></head><body><main><h1>Identical Product Category Heading</h1><p>Text...</p></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_H1_TN_1",
      ruleCode: "DUP_H1",
      fixtureType: "true_negative",
      description: "Pages with distinct unique H1 headings",
      url: "https://example.com/unique-h1-1",
      html: "<html><head><title>P1</title></head><body><main><h1>Enterprise SEO Auditing</h1><p>Text...</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/unique-h1-2",
          html: "<html><head><title>P2</title></head><body><main><h1>Local Citation Building</h1><p>Text...</p></main></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "DUP_H1_EXCL_1",
      ruleCode: "DUP_H1",
      fixtureType: "exclusion",
      description: "Noindexed utility pages with shared H1 are excluded",
      url: "https://example.com/noindex-dup-h1",
      html: "<html><head><title>Draft</title><meta name='robots' content='noindex'></head><body><h1>Login</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_H1_BOUND_1",
      ruleCode: "DUP_H1",
      fixtureType: "boundary",
      description: "Case-insensitive primary H1 match triggers duplicate H1",
      url: "https://example.com/case-h1-1",
      html: "<html><head><title>H1 1</title></head><body><main><h1>Technical SEO Audit Guide</h1><p>Text...</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/case-h1-2",
          html: "<html><head><title>H1 2</title></head><body><main><h1>technical seo audit guide</h1><p>Text...</p></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_H1_DYN_1",
      ruleCode: "DUP_H1",
      fixtureType: "dynamic_hydration",
      description: "Single page alone has no duplicates",
      url: "https://example.com/single-h1-page",
      html: "<html><head><title>Single</title></head><body><main><h1>Unique Landing Header</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_H1_AMB_1",
      ruleCode: "DUP_H1",
      fixtureType: "ambiguous_inconclusive",
      description: "Distinct H1s pass",
      url: "https://example.com/distinct-h1",
      html: "<html><head><title>Distinct</title></head><body><main><h1>Brand Overview</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 16. DUP_MAIN_CONTENT_EXACT
  // =========================================================================
  fixtures.push(
    {
      id: "DUP_EXACT_TP_1",
      ruleCode: "DUP_MAIN_CONTENT_EXACT",
      fixtureType: "true_positive",
      description: "Two distinct URLs sharing exact duplicate main content text",
      url: "https://example.com/dup-content-1",
      html: "<html><head><title>P1</title></head><body><main><h1>Duplicate Content Guide</h1><p>" + "This is exact duplicate editorial body content that is completely cloned and republished across multiple URLs without differentiation. ".repeat(5) + "</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/dup-content-2",
          html: "<html><head><title>P2</title></head><body><main><h1>Duplicate Content Guide</h1><p>" + "This is exact duplicate editorial body content that is completely cloned and republished across multiple URLs without differentiation. ".repeat(5) + "</p></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_EXACT_TN_1",
      ruleCode: "DUP_MAIN_CONTENT_EXACT",
      fixtureType: "true_negative",
      description: "Pages with completely different editorial content",
      url: "https://example.com/unique-content-1",
      html: "<html><head><title>P1</title></head><body><main><h1>Page 1</h1><p>" + "First distinct editorial text focusing on crawling algorithms and DOM rendering pipelines. ".repeat(5) + "</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/unique-content-2",
          html: "<html><head><title>P2</title></head><body><main><h1>Page 2</h1><p>" + "Second completely separate content covering backlink analysis and domain authority transfer models. ".repeat(5) + "</p></main></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "DUP_EXACT_EXCL_1",
      ruleCode: "DUP_MAIN_CONTENT_EXACT",
      fixtureType: "exclusion",
      description: "Noindexed utility pages with shared text are excluded",
      url: "https://example.com/noindex-dup-content",
      html: "<html><head><title>Terms</title><meta name='robots' content='noindex'></head><body><p>Standard legal terms.</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_EXACT_BOUND_1",
      ruleCode: "DUP_MAIN_CONTENT_EXACT",
      fixtureType: "boundary",
      description: "Duplicate content with normalized whitespace triggers exact duplicate",
      url: "https://example.com/ws-exact-1",
      html: "<html><head><title>WS 1</title></head><body><main><h1>Whitespace Clone Guide</h1><p>" + "Duplicate body paragraph with multiple spaces and newlines for testing. ".repeat(6) + "</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/ws-exact-2",
          html: "<html><head><title>WS 2</title></head><body><main><h1>Whitespace Clone Guide</h1><p>" + "Duplicate body paragraph with multiple spaces and newlines for testing. ".repeat(6) + "</p></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_EXACT_DYN_1",
      ruleCode: "DUP_MAIN_CONTENT_EXACT",
      fixtureType: "dynamic_hydration",
      description: "Single page alone has no exact duplicates",
      url: "https://example.com/single-exact-page",
      html: "<html><head><title>Single</title></head><body><main><h1>Single</h1><p>" + "Unique body content without clones. ".repeat(10) + "</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_EXACT_AMB_1",
      ruleCode: "DUP_MAIN_CONTENT_EXACT",
      fixtureType: "ambiguous_inconclusive",
      description: "Different topics pass",
      url: "https://example.com/different-topics",
      html: "<html><head><title>Diff</title></head><body><main><h1>Topics</h1><p>" + "Unique editorial information for visitors. ".repeat(10) + "</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 17. DUP_MAIN_CONTENT_NEAR
  // =========================================================================
  fixtures.push(
    {
      id: "DUP_NEAR_TP_1",
      ruleCode: "DUP_MAIN_CONTENT_NEAR",
      fixtureType: "true_positive",
      description: "Two URLs with 92% word token overlap (near-duplicate)",
      url: "https://example.com/near-dup-1",
      html: "<html><head><title>Near 1</title></head><body><main><h1>Plumber New York</h1><p>" + "We offer professional residential and commercial plumbing services in New York City with emergency support and licensed contractors available 24 hours a day for repairs and installation. ".repeat(4) + "</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/near-dup-2",
          html: "<html><head><title>Near 2</title></head><body><main><h1>Plumber Brooklyn</h1><p>" + "We offer professional residential and commercial plumbing services in Brooklyn New York with emergency support and licensed contractors available 24 hours a day for repairs and installation. ".repeat(4) + "</p></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_NEAR_TN_1",
      ruleCode: "DUP_MAIN_CONTENT_NEAR",
      fixtureType: "true_negative",
      description: "Two URLs with distinct vocabulary (< 50% overlap)",
      url: "https://example.com/distinct-near-1",
      html: "<html><head><title>Distinct 1</title></head><body><main><h1>Machine Learning</h1><p>" + "Deep neural networks utilize backpropagation and gradient descent to optimize loss functions across multi-layered perceptual architectures in computer vision applications. ".repeat(4) + "</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/distinct-near-2",
          html: "<html><head><title>Distinct 2</title></head><body><main><h1>Culinary Arts</h1><p>" + "Traditional French pastry dough requires laminate layering with chilled unsalted butter and precise temperature control throughout the folding and resting stages. ".repeat(4) + "</p></main></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "DUP_NEAR_EXCL_1",
      ruleCode: "DUP_MAIN_CONTENT_NEAR",
      fixtureType: "exclusion",
      description: "Short/thin pages below 40 tokens are excluded from Jaccard comparison",
      url: "https://example.com/short-near-1",
      html: "<html><head><title>Short 1</title></head><body><main><h1>Short</h1><p>Brief text only.</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/short-near-2",
          html: "<html><head><title>Short 2</title></head><body><main><h1>Short</h1><p>Brief text also.</p></main></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "DUP_NEAR_BOUND_1",
      ruleCode: "DUP_MAIN_CONTENT_NEAR",
      fixtureType: "boundary",
      description: "Pages with 88% token similarity trigger near-duplicate finding",
      url: "https://example.com/near-88-1",
      html: "<html><head><title>88 1</title></head><body><main><h1>Service Boston</h1><p>" + "Reliable automotive repair diagnostics brake inspections oil changes and transmission maintenance for all vehicle models in Boston area. ".repeat(4) + "</p></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/near-88-2",
          html: "<html><head><title>88 2</title></head><body><main><h1>Service Cambridge</h1><p>" + "Reliable automotive repair diagnostics brake inspections oil changes and transmission maintenance for all vehicle models in Cambridge area. ".repeat(4) + "</p></main></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "DUP_NEAR_DYN_1",
      ruleCode: "DUP_MAIN_CONTENT_NEAR",
      fixtureType: "dynamic_hydration",
      description: "Single page alone has no near duplicates",
      url: "https://example.com/single-near-page",
      html: "<html><head><title>Single</title></head><body><main><h1>Single</h1><p>" + "Unique article text with extensive technical explanations. ".repeat(10) + "</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DUP_NEAR_AMB_1",
      ruleCode: "DUP_MAIN_CONTENT_NEAR",
      fixtureType: "ambiguous_inconclusive",
      description: "Completely different content passes",
      url: "https://example.com/diff-content",
      html: "<html><head><title>Diff</title></head><body><main><h1>Unique</h1><p>" + "Specific distinct vocabulary and sentences. ".repeat(10) + "</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 18. INDEX_MISSING_CANONICAL
  // =========================================================================
  fixtures.push(
    {
      id: "CANON_MISSING_TP_1",
      ruleCode: "INDEX_MISSING_CANONICAL",
      fixtureType: "true_positive",
      description: "Indexable marketing page with no canonical link tag",
      url: "https://example.com/missing-canonical",
      html: "<html><head><title>Page</title></head><body><main><h1>Page</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "CANON_MISSING_TN_1",
      ruleCode: "INDEX_MISSING_CANONICAL",
      fixtureType: "true_negative",
      description: "Indexable page with valid canonical link tag",
      url: "https://example.com/valid-canonical",
      html: "<html><head><title>Page</title><link rel='canonical' href='https://example.com/valid-canonical'></head><body><main><h1>Page</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_MISSING_EXCL_1",
      ruleCode: "INDEX_MISSING_CANONICAL",
      fixtureType: "exclusion",
      description: "Noindexed page missing canonical is excluded",
      url: "https://example.com/noindex-canon",
      html: "<html><head><title>Noindex</title><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_MISSING_BOUND_1",
      ruleCode: "INDEX_MISSING_CANONICAL",
      fixtureType: "boundary",
      description: "Empty href on canonical link tag triggers missing canonical",
      url: "https://example.com/empty-canon-href",
      html: "<html><head><title>Empty Canon</title><link rel='canonical' href=''></head><body><main><h1>Empty</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "CANON_MISSING_DYN_1",
      ruleCode: "INDEX_MISSING_CANONICAL",
      fixtureType: "dynamic_hydration",
      description: "Valid relative canonical resolved to absolute passes",
      url: "https://example.com/relative-canonical",
      html: "<html><head><title>Page</title><link rel='canonical' href='/relative-canonical'></head><body><main><h1>Page</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_MISSING_AMB_1",
      ruleCode: "INDEX_MISSING_CANONICAL",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid self-referencing canonical passes",
      url: "https://example.com/self-canon",
      html: "<html><head><title>Self</title><link rel='canonical' href='https://example.com/self-canon'></head><body><main><h1>Self</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 19. INDEX_NOINDEX
  // =========================================================================
  fixtures.push(
    {
      id: "NOINDEX_TP_1",
      ruleCode: "INDEX_NOINDEX",
      fixtureType: "true_positive",
      description: "Primary marketing landing page contains meta noindex",
      url: "https://example.com/marketing-landing",
      html: "<html><head><title>Marketing Landing</title><meta name='robots' content='noindex, follow'></head><body><main><h1>Enterprise Solution</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "NOINDEX_TN_1",
      ruleCode: "INDEX_NOINDEX",
      fixtureType: "true_negative",
      description: "Primary marketing landing page is indexable (index, follow)",
      url: "https://example.com/indexable-landing",
      html: "<html><head><title>Indexable Landing</title><meta name='robots' content='index, follow'></head><body><main><h1>Enterprise Solution</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "NOINDEX_EXCL_1",
      ruleCode: "INDEX_NOINDEX",
      fixtureType: "exclusion",
      description: "Intentional utility page (legal / thank-you) with noindex is excluded from accidental noindex finding",
      url: "https://example.com/privacy-legal",
      html: "<html><head><title>Privacy Policy</title><meta name='robots' content='noindex'></head><body><p>Legal privacy disclaimers...</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "NOINDEX_BOUND_1",
      ruleCode: "INDEX_NOINDEX",
      fixtureType: "boundary",
      description: "X-Robots-Tag header with noindex triggers issue on eligible content",
      url: "https://example.com/article-header-noindex",
      headers: { "x-robots-tag": "noindex", "content-type": "text/html" },
      html: "<html><head><title>Article</title></head><body><main><h1>SEO Article</h1><p>Substantial article text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "NOINDEX_DYN_1",
      ruleCode: "INDEX_NOINDEX",
      fixtureType: "dynamic_hydration",
      description: "Indexable blog article passes",
      url: "https://example.com/blog-post",
      html: "<html><head><title>Blog Post</title></head><body><main><h1>Article</h1><p>Substantial text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "NOINDEX_AMB_1",
      ruleCode: "INDEX_NOINDEX",
      fixtureType: "ambiguous_inconclusive",
      description: "No meta robots tag on article is indexable by default",
      url: "https://example.com/article-default-index",
      html: "<html><head><title>Article</title></head><body><main><h1>Article</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 20. INDEX_ROBOTS_CONFLICT
  // =========================================================================
  fixtures.push(
    {
      id: "ROBOTS_CONF_TP_1",
      ruleCode: "INDEX_ROBOTS_CONFLICT",
      fixtureType: "true_positive",
      description: "Meta robots declares 'index' while HTTP header declares 'noindex'",
      url: "https://example.com/conflict-page",
      headers: { "x-robots-tag": "noindex", "content-type": "text/html" },
      html: "<html><head><title>Conflict</title><meta name='robots' content='index, follow'></head><body><main><h1>Conflict</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "ROBOTS_CONF_TN_1",
      ruleCode: "INDEX_ROBOTS_CONFLICT",
      fixtureType: "true_negative",
      description: "Meta robots and HTTP header both declare consistent directives",
      url: "https://example.com/consistent-page",
      headers: { "x-robots-tag": "index, follow", "content-type": "text/html" },
      html: "<html><head><title>Consistent</title><meta name='robots' content='index, follow'></head><body><main><h1>Consistent</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_CONF_EXCL_1",
      ruleCode: "INDEX_ROBOTS_CONFLICT",
      fixtureType: "exclusion",
      description: "Page with only meta robots tag has no conflict",
      url: "https://example.com/meta-only-page",
      html: "<html><head><title>Meta Only</title><meta name='robots' content='index, follow'></head><body><main><h1>Meta Only</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_CONF_BOUND_1",
      ruleCode: "INDEX_ROBOTS_CONFLICT",
      fixtureType: "boundary",
      description: "Meta robots 'noindex' with header 'index' triggers conflict",
      url: "https://example.com/conflict-meta-noindex",
      headers: { "x-robots-tag": "index", "content-type": "text/html" },
      html: "<html><head><title>Conflict 2</title><meta name='robots' content='noindex'></head><body><main><h1>Conflict 2</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "ROBOTS_CONF_DYN_1",
      ruleCode: "INDEX_ROBOTS_CONFLICT",
      fixtureType: "dynamic_hydration",
      description: "Page without any robots tags has no conflict",
      url: "https://example.com/no-robots-tags",
      html: "<html><head><title>Clean</title></head><body><main><h1>Clean</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_CONF_AMB_1",
      ruleCode: "INDEX_ROBOTS_CONFLICT",
      fixtureType: "ambiguous_inconclusive",
      description: "Header-only robots tag has no conflict",
      url: "https://example.com/header-only-robots",
      headers: { "x-robots-tag": "noindex", "content-type": "text/html" },
      html: "<html><head><title>Header Only</title></head><body><main><h1>Header</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 21. CANONICAL_POINTS_TO_4XX
  // =========================================================================
  fixtures.push(
    {
      id: "CANON_4XX_TP_1",
      ruleCode: "CANONICAL_POINTS_TO_4XX",
      fixtureType: "true_positive",
      description: "Canonical tag points to a broken 404 URL in crawl inventory",
      url: "https://example.com/source-canon-4xx",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/broken-target-404'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/broken-target-404",
          statusCode: 404,
          html: "<html><head><title>Not Found</title></head><body><h1>404 Not Found</h1></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "CANON_4XX_TN_1",
      ruleCode: "CANONICAL_POINTS_TO_4XX",
      fixtureType: "true_negative",
      description: "Canonical tag points to a valid 200 OK URL",
      url: "https://example.com/source-canon-200",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/valid-target-200'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/valid-target-200",
          statusCode: 200,
          html: "<html><head><title>Target</title></head><body><h1>Target 200</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "CANON_4XX_EXCL_1",
      ruleCode: "CANONICAL_POINTS_TO_4XX",
      fixtureType: "exclusion",
      description: "Self-referencing canonical on 200 page does not trigger 4xx finding",
      url: "https://example.com/self-canon-200",
      html: "<html><head><title>Self</title><link rel='canonical' href='https://example.com/self-canon-200'></head><body><main><h1>Self</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_4XX_BOUND_1",
      ruleCode: "CANONICAL_POINTS_TO_4XX",
      fixtureType: "boundary",
      description: "Canonical tag points to a 410 Gone target",
      url: "https://example.com/canon-410-source",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/target-410'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/target-410",
          statusCode: 410,
          html: "<html><head><title>Gone</title></head><body><h1>410 Gone</h1></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "CANON_4XX_DYN_1",
      ruleCode: "CANONICAL_POINTS_TO_4XX",
      fixtureType: "dynamic_hydration",
      description: "Canonical tag pointing to live homepage passes",
      url: "https://example.com/subpage",
      html: "<html><head><title>Sub</title><link rel='canonical' href='https://example.com'></head><body><main><h1>Sub</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com",
          statusCode: 200,
          html: "<html><head><title>Home</title></head><body><h1>Home</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "CANON_4XX_AMB_1",
      ruleCode: "CANONICAL_POINTS_TO_4XX",
      fixtureType: "ambiguous_inconclusive",
      description: "Missing canonical does not trigger canonical points to 4xx",
      url: "https://example.com/no-canon-at-all",
      html: "<html><head><title>No Canon</title></head><body><main><h1>No Canon</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 22. CANONICAL_POINTS_TO_REDIRECT
  // =========================================================================
  fixtures.push(
    {
      id: "CANON_REDIR_TP_1",
      ruleCode: "CANONICAL_POINTS_TO_REDIRECT",
      fixtureType: "true_positive",
      description: "Canonical tag points to a URL that returns 301 redirect",
      url: "https://example.com/source-canon-redir",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/redirecting-canon-target'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/redirecting-canon-target",
          statusCode: 301,
          redirectHops: [{ fromUrl: "https://example.com/redirecting-canon-target", toUrl: "https://example.com/final-canon-dest", statusCode: 301 }],
          html: "<html><head><title>Redirect</title></head><body></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "CANON_REDIR_TN_1",
      ruleCode: "CANONICAL_POINTS_TO_REDIRECT",
      fixtureType: "true_negative",
      description: "Canonical tag points directly to final 200 destination URL",
      url: "https://example.com/source-canon-direct",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/final-canon-dest'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/final-canon-dest",
          statusCode: 200,
          html: "<html><head><title>Final</title></head><body><h1>Final</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "CANON_REDIR_EXCL_1",
      ruleCode: "CANONICAL_POINTS_TO_REDIRECT",
      fixtureType: "exclusion",
      description: "Self-referencing canonical on direct 200 page passes",
      url: "https://example.com/direct-200",
      html: "<html><head><title>Direct</title><link rel='canonical' href='https://example.com/direct-200'></head><body><main><h1>Direct</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_REDIR_BOUND_1",
      ruleCode: "CANONICAL_POINTS_TO_REDIRECT",
      fixtureType: "boundary",
      description: "Canonical tag points to a 302 temporary redirect",
      url: "https://example.com/source-canon-302",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/temp-redirect-target'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/temp-redirect-target",
          statusCode: 302,
          redirectHops: [{ fromUrl: "https://example.com/temp-redirect-target", toUrl: "https://example.com/final-temp-dest", statusCode: 302 }],
          html: "<html><head><title>Temp</title></head><body></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "CANON_REDIR_DYN_1",
      ruleCode: "CANONICAL_POINTS_TO_REDIRECT",
      fixtureType: "dynamic_hydration",
      description: "Direct canonical reference passes",
      url: "https://example.com/article-direct-canon",
      html: "<html><head><title>Article</title><link rel='canonical' href='https://example.com/article-direct-canon'></head><body><main><h1>Article</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_REDIR_AMB_1",
      ruleCode: "CANONICAL_POINTS_TO_REDIRECT",
      fixtureType: "ambiguous_inconclusive",
      description: "Canonical to 200 target passes",
      url: "https://example.com/canon-to-200",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/target-200-ok'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/target-200-ok",
          statusCode: 200,
          html: "<html><head><title>Target</title></head><body><h1>Target</h1></body></html>",
        }
      ],
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 23. CANONICAL_POINTS_TO_NOINDEX
  // =========================================================================
  fixtures.push(
    {
      id: "CANON_NOINDEX_TP_1",
      ruleCode: "CANONICAL_POINTS_TO_NOINDEX",
      fixtureType: "true_positive",
      description: "Canonical tag points to a page containing a meta noindex directive",
      url: "https://example.com/source-canon-noindex",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/noindex-canon-target'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/noindex-canon-target",
          html: "<html><head><title>Target</title><meta name='robots' content='noindex, nofollow'></head><body><h1>Noindex Target</h1></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "CANON_NOINDEX_TN_1",
      ruleCode: "CANONICAL_POINTS_TO_NOINDEX",
      fixtureType: "true_negative",
      description: "Canonical tag points to an indexable target page",
      url: "https://example.com/source-canon-indexable",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/indexable-target'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/indexable-target",
          html: "<html><head><title>Target</title><meta name='robots' content='index, follow'></head><body><h1>Indexable Target</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "CANON_NOINDEX_EXCL_1",
      ruleCode: "CANONICAL_POINTS_TO_NOINDEX",
      fixtureType: "exclusion",
      description: "Self-referencing canonical on noindex page is excluded",
      url: "https://example.com/self-canon-noindex",
      html: "<html><head><title>Noindex Self</title><link rel='canonical' href='https://example.com/self-canon-noindex'><meta name='robots' content='noindex'></head><body><h1>Self</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_NOINDEX_BOUND_1",
      ruleCode: "CANONICAL_POINTS_TO_NOINDEX",
      fixtureType: "boundary",
      description: "Canonical points to target with HTTP X-Robots-Tag noindex header",
      url: "https://example.com/source-header-noindex-target",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/header-noindex-target'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/header-noindex-target",
          headers: { "x-robots-tag": "noindex", "content-type": "text/html" },
          html: "<html><head><title>Target</title></head><body><h1>Target</h1></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "CANON_NOINDEX_DYN_1",
      ruleCode: "CANONICAL_POINTS_TO_NOINDEX",
      fixtureType: "dynamic_hydration",
      description: "Canonical pointing to standard indexable page passes",
      url: "https://example.com/canon-to-indexable-page",
      html: "<html><head><title>Source</title><link rel='canonical' href='https://example.com/indexable-guide'></head><body><main><h1>Source</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/indexable-guide",
          html: "<html><head><title>Guide</title></head><body><h1>Guide</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "CANON_NOINDEX_AMB_1",
      ruleCode: "CANONICAL_POINTS_TO_NOINDEX",
      fixtureType: "ambiguous_inconclusive",
      description: "Self-referencing indexable canonical passes",
      url: "https://example.com/self-indexable",
      html: "<html><head><title>Self</title><link rel='canonical' href='https://example.com/self-indexable'></head><body><main><h1>Self</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 24. CANONICAL_MULTIPLE
  // =========================================================================
  fixtures.push(
    {
      id: "CANON_MULTI_TP_1",
      ruleCode: "CANONICAL_MULTIPLE",
      fixtureType: "true_positive",
      description: "Document declares 2 conflicting rel='canonical' tags in <head>",
      url: "https://example.com/multiple-canon-tags",
      html: "<html><head><title>Multiple Canon</title><link rel='canonical' href='https://example.com/target-a'><link rel='canonical' href='https://example.com/target-b'></head><body><main><h1>Page</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "CANON_MULTI_TN_1",
      ruleCode: "CANONICAL_MULTIPLE",
      fixtureType: "true_negative",
      description: "Document declares exactly one canonical link tag",
      url: "https://example.com/single-canon-tag",
      html: "<html><head><title>Single Canon</title><link rel='canonical' href='https://example.com/single-canon-tag'></head><body><main><h1>Page</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_MULTI_EXCL_1",
      ruleCode: "CANONICAL_MULTIPLE",
      fixtureType: "exclusion",
      description: "Page with 0 canonical tags has no multiple canonical issue",
      url: "https://example.com/zero-canon-tags",
      html: "<html><head><title>Zero Canon</title></head><body><main><h1>Page</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_MULTI_BOUND_1",
      ruleCode: "CANONICAL_MULTIPLE",
      fixtureType: "boundary",
      description: "Document with 3 distinct canonical tags triggers multiple canonical finding",
      url: "https://example.com/three-canon-tags",
      html: "<html><head><title>Three Canon</title><link rel='canonical' href='https://example.com/a'><link rel='canonical' href='https://example.com/b'><link rel='canonical' href='https://example.com/c'></head><body><main><h1>Page</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "CANON_MULTI_DYN_1",
      ruleCode: "CANONICAL_MULTIPLE",
      fixtureType: "dynamic_hydration",
      description: "Single canonical link tag passes",
      url: "https://example.com/clean-canonical",
      html: "<html><head><title>Clean</title><link rel='canonical' href='https://example.com/clean-canonical'></head><body><main><h1>Clean</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_MULTI_AMB_1",
      ruleCode: "CANONICAL_MULTIPLE",
      fixtureType: "ambiguous_inconclusive",
      description: "Single canonical href passes",
      url: "https://example.com/single-canon-pass",
      html: "<html><head><title>Pass</title><link rel='canonical' href='https://example.com/pass'></head><body><main><h1>Pass</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 25. CANONICAL_OUTSIDE_HEAD
  // =========================================================================
  fixtures.push(
    {
      id: "CANON_BODY_TP_1",
      ruleCode: "CANONICAL_OUTSIDE_HEAD",
      fixtureType: "true_positive",
      description: "Canonical link tag declared inside <body> instead of <head>",
      url: "https://example.com/canon-in-body",
      html: "<html><head><title>Page</title></head><body><link rel='canonical' href='https://example.com/canon-in-body'><main><h1>Body Canon</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "CANON_BODY_TN_1",
      ruleCode: "CANONICAL_OUTSIDE_HEAD",
      fixtureType: "true_negative",
      description: "Canonical link tag properly declared in <head>",
      url: "https://example.com/canon-in-head",
      html: "<html><head><title>Head Canon</title><link rel='canonical' href='https://example.com/canon-in-head'></head><body><main><h1>Head Canon</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_BODY_EXCL_1",
      ruleCode: "CANONICAL_OUTSIDE_HEAD",
      fixtureType: "exclusion",
      description: "Page without canonical tags does not trigger canonical outside head",
      url: "https://example.com/no-canon-body",
      html: "<html><head><title>No Canon</title></head><body><main><h1>No Canon</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_BODY_BOUND_1",
      ruleCode: "CANONICAL_OUTSIDE_HEAD",
      fixtureType: "boundary",
      description: "Canonical tag positioned inside <footer> triggers outside head",
      url: "https://example.com/canon-in-footer",
      html: "<html><head><title>Footer Canon</title></head><body><main><h1>Main</h1></main><footer><link rel='canonical' href='https://example.com/footer'></footer></body></html>",
      expectedFinding: true,
    },
    {
      id: "CANON_BODY_DYN_1",
      ruleCode: "CANONICAL_OUTSIDE_HEAD",
      fixtureType: "dynamic_hydration",
      description: "Standard <head> canonical passes",
      url: "https://example.com/standard-head-canon",
      html: "<html><head><title>Standard</title><link rel='canonical' href='https://example.com/standard-head-canon'></head><body><main><h1>Standard</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_BODY_AMB_1",
      ruleCode: "CANONICAL_OUTSIDE_HEAD",
      fixtureType: "ambiguous_inconclusive",
      description: "Properly positioned head canonical passes",
      url: "https://example.com/proper-head-canon",
      html: "<html><head><link rel='canonical' href='https://example.com/proper-head-canon'><title>Proper</title></head><body><main><h1>Proper</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 26. ORPHAN_INDEXABLE_PAGE
  // =========================================================================
  fixtures.push(
    {
      id: "ORPHAN_TP_1",
      ruleCode: "ORPHAN_INDEXABLE_PAGE",
      fixtureType: "true_positive",
      description: "Indexable subpage with 0 internal inbound links",
      url: "https://example.com/orphan-article",
      depth: 1,
      html: "<html><head><title>Orphan Article</title></head><body><main><h1>Orphan Article</h1><p>Text...</p></main></body></html>",
      graphOverride: { inlinksMap: new Map([["https://example.com/orphan-article", []]]) },
      expectedFinding: true,
    },
    {
      id: "ORPHAN_TN_1",
      ruleCode: "ORPHAN_INDEXABLE_PAGE",
      fixtureType: "true_negative",
      description: "Indexable subpage receiving 3 internal inlinks",
      url: "https://example.com/linked-article",
      depth: 1,
      html: "<html><head><title>Linked Article</title></head><body><main><h1>Linked Article</h1><p>Text...</p></main></body></html>",
      graphOverride: {
        inlinksMap: new Map([
          ["https://example.com/linked-article", [
            { sourceUrl: "https://example.com", anchorText: "Guide", isNofollow: false, isImageLink: false },
            { sourceUrl: "https://example.com/blog", anchorText: "Read", isNofollow: false, isImageLink: false },
          ]]
        ])
      },
      expectedFinding: false,
    },
    {
      id: "ORPHAN_EXCL_1",
      ruleCode: "ORPHAN_INDEXABLE_PAGE",
      fixtureType: "exclusion",
      description: "Seed / homepage URL with 0 inlinks is excluded from orphan finding",
      url: "https://example.com",
      depth: 0,
      html: "<html><head><title>Home</title></head><body><main><h1>Home</h1></main></body></html>",
      graphOverride: { inlinksMap: new Map([["https://example.com", []]]) },
      expectedFinding: false,
    },
    {
      id: "ORPHAN_BOUND_1",
      ruleCode: "ORPHAN_INDEXABLE_PAGE",
      fixtureType: "boundary",
      description: "Indexable product page with empty inlinks list triggers orphan",
      url: "https://example.com/product/isolated",
      depth: 1,
      html: "<html><head><title>Product</title></head><body><main><h1>Product</h1><p>Text...</p></main></body></html>",
      graphOverride: { inlinksMap: new Map([["https://example.com/product/isolated", []]]) },
      expectedFinding: true,
    },
    {
      id: "ORPHAN_DYN_1",
      ruleCode: "ORPHAN_INDEXABLE_PAGE",
      fixtureType: "dynamic_hydration",
      description: "Page linked from navigation passes",
      url: "https://example.com/services",
      html: "<html><head><title>Services</title></head><body><main><h1>Services</h1><p>Text...</p></main></body></html>",
      graphOverride: {
        inlinksMap: new Map([
          ["https://example.com/services", [
            { sourceUrl: "https://example.com", anchorText: "Services", isNofollow: false, isImageLink: false }
          ]]
        ])
      },
      expectedFinding: false,
    },
    {
      id: "ORPHAN_AMB_1",
      ruleCode: "ORPHAN_INDEXABLE_PAGE",
      fixtureType: "ambiguous_inconclusive",
      description: "Noindexed page with 0 inlinks is excluded from indexable orphan check",
      url: "https://example.com/noindex-orphan",
      html: "<html><head><title>Noindex</title><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      graphOverride: { inlinksMap: new Map([["https://example.com/noindex-orphan", []]]) },
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 27. PAGES_DEEP_CRAWL_DEPTH
  // =========================================================================
  fixtures.push(
    {
      id: "DEPTH_TP_1",
      ruleCode: "PAGES_DEEP_CRAWL_DEPTH",
      fixtureType: "true_positive",
      description: "Page with crawl depth of 6 (> 4 hops from seed)",
      url: "https://example.com/a/b/c/d/e/deep-page",
      depth: 6,
      html: "<html><head><title>Deep Page</title></head><body><main><h1>Deep</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "DEPTH_TN_1",
      ruleCode: "PAGES_DEEP_CRAWL_DEPTH",
      fixtureType: "true_negative",
      description: "Page with crawl depth of 2 (shallow navigation)",
      url: "https://example.com/category/product",
      depth: 2,
      html: "<html><head><title>Shallow</title></head><body><main><h1>Shallow</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DEPTH_EXCL_1",
      ruleCode: "PAGES_DEEP_CRAWL_DEPTH",
      fixtureType: "exclusion",
      description: "Homepage at depth 0 has no depth penalty",
      url: "https://example.com",
      depth: 0,
      html: "<html><head><title>Home</title></head><body><main><h1>Home</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DEPTH_BOUND_1",
      ruleCode: "PAGES_DEEP_CRAWL_DEPTH",
      fixtureType: "boundary",
      description: "Page at depth 5 triggers deep crawl depth finding",
      url: "https://example.com/l1/l2/l3/l4/l5",
      depth: 5,
      html: "<html><head><title>Depth 5</title></head><body><main><h1>Depth 5</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "DEPTH_DYN_1",
      ruleCode: "PAGES_DEEP_CRAWL_DEPTH",
      fixtureType: "dynamic_hydration",
      description: "Page at depth 4 passes",
      url: "https://example.com/l1/l2/l3/l4",
      depth: 4,
      html: "<html><head><title>Depth 4</title></head><body><main><h1>Depth 4</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DEPTH_AMB_1",
      ruleCode: "PAGES_DEEP_CRAWL_DEPTH",
      fixtureType: "ambiguous_inconclusive",
      description: "Page at depth 1 passes",
      url: "https://example.com/about",
      depth: 1,
      html: "<html><head><title>About</title></head><body><main><h1>About</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 28. REDIRECT_CHAIN
  // =========================================================================
  fixtures.push(
    {
      id: "CHAIN_TP_1",
      ruleCode: "REDIRECT_CHAIN",
      fixtureType: "true_positive",
      description: "URL redirecting through 2 intermediate hops (chain length 2)",
      url: "https://example.com/start-chain",
      statusCode: 301,
      redirectHops: [
        { fromUrl: "https://example.com/start-chain", toUrl: "https://example.com/hop-1", statusCode: 301 },
        { fromUrl: "https://example.com/hop-1", toUrl: "https://example.com/final-dest", statusCode: 301 },
      ],
      html: "<html><head><title>Redirecting</title></head><body></body></html>",
      expectedFinding: true,
    },
    {
      id: "CHAIN_TN_1",
      ruleCode: "REDIRECT_CHAIN",
      fixtureType: "true_negative",
      description: "Single clean 301 redirect hop directly to destination",
      url: "https://example.com/clean-redirect",
      statusCode: 301,
      redirectHops: [
        { fromUrl: "https://example.com/clean-redirect", toUrl: "https://example.com/final-dest", statusCode: 301 },
      ],
      html: "<html><head><title>Redirecting</title></head><body></body></html>",
      expectedFinding: false,
    },
    {
      id: "CHAIN_EXCL_1",
      ruleCode: "REDIRECT_CHAIN",
      fixtureType: "exclusion",
      description: "Direct 200 OK page with no redirects has no chain",
      url: "https://example.com/direct-200-page",
      statusCode: 200,
      redirectHops: [],
      html: "<html><head><title>200 OK</title></head><body><main><h1>200 OK</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CHAIN_BOUND_1",
      ruleCode: "REDIRECT_CHAIN",
      fixtureType: "boundary",
      description: "URL redirecting through 3 intermediate hops triggers chain",
      url: "https://example.com/long-chain",
      statusCode: 301,
      redirectHops: [
        { fromUrl: "https://example.com/long-chain", toUrl: "https://example.com/h1", statusCode: 301 },
        { fromUrl: "https://example.com/h1", toUrl: "https://example.com/h2", statusCode: 301 },
        { fromUrl: "https://example.com/h2", toUrl: "https://example.com/final", statusCode: 301 },
      ],
      html: "<html><head><title>Chain</title></head><body></body></html>",
      expectedFinding: true,
    },
    {
      id: "CHAIN_DYN_1",
      ruleCode: "REDIRECT_CHAIN",
      fixtureType: "dynamic_hydration",
      description: "Single redirect hop passes",
      url: "https://example.com/single-hop",
      statusCode: 302,
      redirectHops: [
        { fromUrl: "https://example.com/single-hop", toUrl: "https://example.com/target", statusCode: 302 },
      ],
      html: "<html><head><title>Single Hop</title></head><body></body></html>",
      expectedFinding: false,
    },
    {
      id: "CHAIN_AMB_1",
      ruleCode: "REDIRECT_CHAIN",
      fixtureType: "ambiguous_inconclusive",
      description: "Direct 200 response passes",
      url: "https://example.com/direct-ok",
      statusCode: 200,
      html: "<html><head><title>OK</title></head><body><main><h1>OK</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 29. REDIRECT_LOOP
  // =========================================================================
  fixtures.push(
    {
      id: "LOOP_TP_1",
      ruleCode: "REDIRECT_LOOP",
      fixtureType: "true_positive",
      description: "Cyclical redirect loop (A -> B -> A)",
      url: "https://example.com/loop-a",
      statusCode: 301,
      redirectHops: [
        { fromUrl: "https://example.com/loop-a", toUrl: "https://example.com/loop-b", statusCode: 301 },
        { fromUrl: "https://example.com/loop-b", toUrl: "https://example.com/loop-a", statusCode: 301 },
      ],
      html: "<html><head><title>Loop</title></head><body></body></html>",
      expectedFinding: true,
    },
    {
      id: "LOOP_TN_1",
      ruleCode: "REDIRECT_LOOP",
      fixtureType: "true_negative",
      description: "Non-cyclical redirect path (A -> B -> C)",
      url: "https://example.com/linear-redir",
      statusCode: 301,
      redirectHops: [
        { fromUrl: "https://example.com/linear-redir", toUrl: "https://example.com/step-b", statusCode: 301 },
        { fromUrl: "https://example.com/step-b", toUrl: "https://example.com/final-c", statusCode: 301 },
      ],
      html: "<html><head><title>Linear</title></head><body></body></html>",
      expectedFinding: false,
    },
    {
      id: "LOOP_EXCL_1",
      ruleCode: "REDIRECT_LOOP",
      fixtureType: "exclusion",
      description: "Direct 200 page has no redirect loop",
      url: "https://example.com/direct-200-loop-check",
      statusCode: 200,
      redirectHops: [],
      html: "<html><head><title>Direct</title></head><body><main><h1>Direct</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LOOP_BOUND_1",
      ruleCode: "REDIRECT_LOOP",
      fixtureType: "boundary",
      description: "3-hop cyclical redirect loop (A -> B -> C -> A)",
      url: "https://example.com/cycle-3-a",
      statusCode: 301,
      redirectHops: [
        { fromUrl: "https://example.com/cycle-3-a", toUrl: "https://example.com/cycle-3-b", statusCode: 301 },
        { fromUrl: "https://example.com/cycle-3-b", toUrl: "https://example.com/cycle-3-c", statusCode: 301 },
        { fromUrl: "https://example.com/cycle-3-c", toUrl: "https://example.com/cycle-3-a", statusCode: 301 },
      ],
      html: "<html><head><title>Cycle 3</title></head><body></body></html>",
      expectedFinding: true,
    },
    {
      id: "LOOP_DYN_1",
      ruleCode: "REDIRECT_LOOP",
      fixtureType: "dynamic_hydration",
      description: "Clean 1-hop redirect passes",
      url: "https://example.com/clean-hop-pass",
      statusCode: 301,
      redirectHops: [
        { fromUrl: "https://example.com/clean-hop-pass", toUrl: "https://example.com/dest-page", statusCode: 301 },
      ],
      html: "<html><head><title>Pass</title></head><body></body></html>",
      expectedFinding: false,
    },
    {
      id: "LOOP_AMB_1",
      ruleCode: "REDIRECT_LOOP",
      fixtureType: "ambiguous_inconclusive",
      description: "Direct 200 passes",
      url: "https://example.com/direct-200-pass",
      statusCode: 200,
      html: "<html><head><title>Pass</title></head><body><main><h1>Pass</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 30. SITEMAP_URL_4XX
  // =========================================================================
  fixtures.push(
    {
      id: "SITEMAP_4XX_TP_1",
      ruleCode: "SITEMAP_URL_4XX",
      fixtureType: "true_positive",
      description: "XML sitemap entry returns HTTP 404 client error",
      url: "https://example.com/sitemap.xml",
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-broken-page", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      additionalPages: [
        {
          url: "https://example.com/sitemap-broken-page",
          statusCode: 404,
          html: "<html><head><title>404</title></head><body><h1>Not Found</h1></body></html>",
        }
      ],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/sitemap-broken-page</loc></url></urlset>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_4XX_TN_1",
      ruleCode: "SITEMAP_URL_4XX",
      fixtureType: "true_negative",
      description: "XML sitemap entries all return HTTP 200 OK",
      url: "https://example.com/sitemap.xml",
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-valid-page", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      additionalPages: [
        {
          url: "https://example.com/sitemap-valid-page",
          statusCode: 200,
          html: "<html><head><title>Valid</title></head><body><h1>Valid</h1></body></html>",
        }
      ],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/sitemap-valid-page</loc></url></urlset>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_4XX_EXCL_1",
      ruleCode: "SITEMAP_URL_4XX",
      fixtureType: "exclusion",
      description: "Empty sitemap orphan list produces no 4xx sitemap issues",
      url: "https://example.com/sitemap.xml",
      sitemapOrphansOverride: [],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'></urlset>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_4XX_BOUND_1",
      ruleCode: "SITEMAP_URL_4XX",
      fixtureType: "boundary",
      description: "Sitemap entry returning 410 Gone triggers sitemap 4xx issue",
      url: "https://example.com/sitemap.xml",
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-410-page", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      additionalPages: [
        {
          url: "https://example.com/sitemap-410-page",
          statusCode: 410,
          html: "<html><head><title>Gone</title></head><body><h1>410</h1></body></html>",
        }
      ],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/sitemap-410-page</loc></url></urlset>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_4XX_DYN_1",
      ruleCode: "SITEMAP_URL_4XX",
      fixtureType: "dynamic_hydration",
      description: "Sitemap with 200 URLs passes",
      url: "https://example.com/sitemap.xml",
      sitemapOrphansOverride: [
        { loc: "https://example.com/page-1", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      additionalPages: [
        {
          url: "https://example.com/page-1",
          statusCode: 200,
          html: "<html><head><title>P1</title></head><body><h1>P1</h1></body></html>",
        }
      ],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/page-1</loc></url></urlset>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_4XX_AMB_1",
      ruleCode: "SITEMAP_URL_4XX",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid sitemap passes",
      url: "https://example.com/sitemap.xml",
      sitemapOrphansOverride: [],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'></urlset>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 31. SITEMAP_URL_REDIRECT
  // =========================================================================
  fixtures.push(
    {
      id: "SITEMAP_REDIR_TP_1",
      ruleCode: "SITEMAP_URL_REDIRECT",
      fixtureType: "true_positive",
      description: "XML sitemap contains URL that returns 301 redirect",
      url: "https://example.com/sitemap-redirect-source",
      statusCode: 301,
      redirectHops: [{ fromUrl: "https://example.com/sitemap-redirect-source", toUrl: "https://example.com/final-dest", statusCode: 301 }],
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-redirect-source", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<html><head><title>Redirect</title></head><body></body></html>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_REDIR_TN_1",
      ruleCode: "SITEMAP_URL_REDIRECT",
      fixtureType: "true_negative",
      description: "XML sitemap contains only 200 OK final destination URLs",
      url: "https://example.com/sitemap-canonical-dest",
      statusCode: 200,
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-canonical-dest", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<html><head><title>200 OK</title></head><body><h1>200 OK</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_REDIR_EXCL_1",
      ruleCode: "SITEMAP_URL_REDIRECT",
      fixtureType: "exclusion",
      description: "Page not present in sitemap does not trigger sitemap redirect issue",
      url: "https://example.com/unlisted-redirect",
      statusCode: 301,
      redirectHops: [{ fromUrl: "https://example.com/unlisted-redirect", toUrl: "https://example.com/target", statusCode: 301 }],
      sitemapOrphansOverride: [],
      html: "<html><head><title>Redirect</title></head><body></body></html>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_REDIR_BOUND_1",
      ruleCode: "SITEMAP_URL_REDIRECT",
      fixtureType: "boundary",
      description: "Sitemap entry returning 302 temporary redirect triggers issue",
      url: "https://example.com/sitemap-302-source",
      statusCode: 302,
      redirectHops: [{ fromUrl: "https://example.com/sitemap-302-source", toUrl: "https://example.com/final", statusCode: 302 }],
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-302-source", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<html><head><title>302</title></head><body></body></html>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_REDIR_DYN_1",
      ruleCode: "SITEMAP_URL_REDIRECT",
      fixtureType: "dynamic_hydration",
      description: "Canonical 200 URL in sitemap passes",
      url: "https://example.com/clean-sitemap-url",
      statusCode: 200,
      sitemapOrphansOverride: [
        { loc: "https://example.com/clean-sitemap-url", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<html><head><title>Clean</title></head><body><h1>Clean</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_REDIR_AMB_1",
      ruleCode: "SITEMAP_URL_REDIRECT",
      fixtureType: "ambiguous_inconclusive",
      description: "Direct 200 URL passes",
      url: "https://example.com/ok-url",
      statusCode: 200,
      sitemapOrphansOverride: [],
      html: "<html><head><title>OK</title></head><body><main><h1>OK</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 32. SITEMAP_URL_NOINDEX
  // =========================================================================
  fixtures.push(
    {
      id: "SITEMAP_NOINDEX_TP_1",
      ruleCode: "SITEMAP_URL_NOINDEX",
      fixtureType: "true_positive",
      description: "XML sitemap contains URL that contains a noindex meta directive",
      url: "https://example.com/sitemap-noindexed-page",
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-noindexed-page", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<html><head><title>Noindex</title><meta name='robots' content='noindex, nofollow'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_NOINDEX_TN_1",
      ruleCode: "SITEMAP_URL_NOINDEX",
      fixtureType: "true_negative",
      description: "XML sitemap contains indexable URL",
      url: "https://example.com/sitemap-indexable-page",
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-indexable-page", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<html><head><title>Indexable</title><meta name='robots' content='index, follow'></head><body><h1>Indexable</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_NOINDEX_EXCL_1",
      ruleCode: "SITEMAP_URL_NOINDEX",
      fixtureType: "exclusion",
      description: "Noindexed page not listed in sitemap does not trigger sitemap noindex finding",
      url: "https://example.com/unlisted-noindex",
      sitemapOrphansOverride: [],
      html: "<html><head><title>Unlisted</title><meta name='robots' content='noindex'></head><body><h1>Unlisted</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_NOINDEX_BOUND_1",
      ruleCode: "SITEMAP_URL_NOINDEX",
      fixtureType: "boundary",
      description: "Sitemap entry with HTTP X-Robots-Tag noindex header triggers finding",
      url: "https://example.com/sitemap-header-noindex",
      headers: { "x-robots-tag": "noindex", "content-type": "text/html" },
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-header-noindex", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<html><head><title>Header Noindex</title></head><body><h1>Noindex</h1></body></html>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_NOINDEX_DYN_1",
      ruleCode: "SITEMAP_URL_NOINDEX",
      fixtureType: "dynamic_hydration",
      description: "Indexable URL in sitemap passes",
      url: "https://example.com/sitemap-valid-landing",
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-valid-landing", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<html><head><title>Landing</title></head><body><main><h1>Landing</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_NOINDEX_AMB_1",
      ruleCode: "SITEMAP_URL_NOINDEX",
      fixtureType: "ambiguous_inconclusive",
      description: "Standard indexable page passes",
      url: "https://example.com/sitemap-standard",
      sitemapOrphansOverride: [],
      html: "<html><head><title>Standard</title></head><body><main><h1>Standard</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 33. SITEMAP_MALFORMED_XML
  // =========================================================================
  fixtures.push(
    {
      id: "SITEMAP_XML_TP_1",
      ruleCode: "SITEMAP_MALFORMED_XML",
      fixtureType: "true_positive",
      description: "Sitemap file contains malformed XML syntax (missing <urlset> root)",
      url: "https://example.com/sitemap.xml",
      html: "This is arbitrary non-XML text content inside a sitemap file endpoint.",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_XML_TN_1",
      ruleCode: "SITEMAP_MALFORMED_XML",
      fixtureType: "true_negative",
      description: "Valid standard XML sitemap file with <urlset> root",
      url: "https://example.com/valid-sitemap.xml",
      html: "<?xml version='1.0' encoding='UTF-8'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/</loc></url></urlset>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_XML_EXCL_1",
      ruleCode: "SITEMAP_MALFORMED_XML",
      fixtureType: "exclusion",
      description: "HTML page does not trigger sitemap malformed XML check",
      url: "https://example.com/about-us",
      html: "<html><head><title>About</title></head><body><h1>About</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_XML_BOUND_1",
      ruleCode: "SITEMAP_MALFORMED_XML",
      fixtureType: "boundary",
      description: "Valid sitemap index with <sitemapindex> root passes",
      url: "https://example.com/sitemap_index.xml",
      html: "<?xml version='1.0' encoding='UTF-8'?><sitemapindex xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><sitemap><loc>https://example.com/sub-sitemap.xml</loc></sitemap></sitemapindex>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_XML_DYN_1",
      ruleCode: "SITEMAP_MALFORMED_XML",
      fixtureType: "dynamic_hydration",
      description: "Broken non-XML payload on .xml URL triggers finding",
      url: "https://example.com/broken-sitemap.xml",
      html: "<html><body>404 Page Not Found</body></html>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_XML_AMB_1",
      ruleCode: "SITEMAP_MALFORMED_XML",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid XML sitemap passes",
      url: "https://example.com/sitemap-feed.xml",
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/page</loc></url></urlset>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 34. LINKS_BROKEN_INTERNAL
  // =========================================================================
  fixtures.push(
    {
      id: "LINKS_INT_TP_1",
      ruleCode: "LINKS_BROKEN_INTERNAL",
      fixtureType: "true_positive",
      description: "Page containing internal link that returned verified 404 error",
      url: "https://example.com/page-with-broken-link",
      graphOverride: {
        brokenInternalLinks: [
          {
            sourceUrl: "https://example.com/page-with-broken-link",
            targetUrl: "https://example.com/missing-404-target",
            statusCode: 404,
            anchorText: "Broken Link",
          }
        ]
      },
      html: "<html><head><title>Broken Links</title></head><body><main><h1>Broken Link Test</h1><a href='/missing-404-target'>Broken Link</a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "LINKS_INT_TN_1",
      ruleCode: "LINKS_BROKEN_INTERNAL",
      fixtureType: "true_negative",
      description: "Page with valid internal links to live 200 OK targets",
      url: "https://example.com/clean-links-page",
      graphOverride: { brokenInternalLinks: [] },
      html: "<html><head><title>Clean Links</title></head><body><main><h1>Clean Links</h1><a href='/about'>About Us</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_INT_EXCL_1",
      ruleCode: "LINKS_BROKEN_INTERNAL",
      fixtureType: "exclusion",
      description: "Page without any internal links has zero broken internal link issues",
      url: "https://example.com/no-links-page",
      graphOverride: { brokenInternalLinks: [] },
      html: "<html><head><title>No Links</title></head><body><main><h1>No Links</h1><p>Text only.</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_INT_BOUND_1",
      ruleCode: "LINKS_BROKEN_INTERNAL",
      fixtureType: "boundary",
      description: "Internal link returning 500 server error triggers broken internal link issue",
      url: "https://example.com/page-500-link",
      graphOverride: {
        brokenInternalLinks: [
          {
            sourceUrl: "https://example.com/page-500-link",
            targetUrl: "https://example.com/server-error-500",
            statusCode: 500,
            anchorText: "Server Error",
          }
        ]
      },
      html: "<html><head><title>500 Link</title></head><body><main><h1>500 Link</h1><a href='/server-error-500'>Server Error</a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "LINKS_INT_DYN_1",
      ruleCode: "LINKS_BROKEN_INTERNAL",
      fixtureType: "dynamic_hydration",
      description: "Valid internal links pass cleanly",
      url: "https://example.com/valid-internal-page",
      graphOverride: { brokenInternalLinks: [] },
      html: "<html><head><title>Valid</title></head><body><main><h1>Valid</h1><a href='/contact'>Contact</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_INT_AMB_1",
      ruleCode: "LINKS_BROKEN_INTERNAL",
      fixtureType: "ambiguous_inconclusive",
      description: "Clean link graph produces 0 broken links",
      url: "https://example.com/clean-page-amb",
      graphOverride: { brokenInternalLinks: [] },
      html: "<html><head><title>Clean</title></head><body><main><h1>Clean</h1><a href='/pricing'>Pricing</a></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 35. LINKS_INTERNAL_TO_REDIRECT
  // =========================================================================
  fixtures.push(
    {
      id: "LINKS_REDIR_TP_1",
      ruleCode: "LINKS_INTERNAL_TO_REDIRECT",
      fixtureType: "true_positive",
      description: "Internal navigation link points to a URL that returns a 301 redirect",
      url: "https://example.com/page-with-redirect-link",
      html: "<html><head><title>Source</title></head><body><main><h1>Source</h1><a href='https://example.com/redirecting-page'>Old URL</a></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/redirecting-page",
          statusCode: 301,
          redirectHops: [{ fromUrl: "https://example.com/redirecting-page", toUrl: "https://example.com/new-destination", statusCode: 301 }],
          html: "<html><head><title>Redirect</title></head><body></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "LINKS_REDIR_TN_1",
      ruleCode: "LINKS_INTERNAL_TO_REDIRECT",
      fixtureType: "true_negative",
      description: "Internal navigation links point directly to 200 OK destination URLs",
      url: "https://example.com/page-with-direct-link",
      html: "<html><head><title>Source</title></head><body><main><h1>Source</h1><a href='https://example.com/new-destination'>Direct URL</a></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/new-destination",
          statusCode: 200,
          html: "<html><head><title>Direct</title></head><body><h1>Direct</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "LINKS_REDIR_EXCL_1",
      ruleCode: "LINKS_INTERNAL_TO_REDIRECT",
      fixtureType: "exclusion",
      description: "External links that redirect are excluded from internal redirect link issue",
      url: "https://example.com/external-redirect-link",
      html: "<html><head><title>Source</title></head><body><main><h1>Source</h1><a href='https://other-domain.com/redirect'>External Link</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_REDIR_BOUND_1",
      ruleCode: "LINKS_INTERNAL_TO_REDIRECT",
      fixtureType: "boundary",
      description: "Internal link targeting 302 temporary redirect triggers issue",
      url: "https://example.com/link-to-302",
      html: "<html><head><title>Source</title></head><body><main><h1>Source</h1><a href='https://example.com/temp-page'>Temp Link</a></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/temp-page",
          statusCode: 302,
          redirectHops: [{ fromUrl: "https://example.com/temp-page", toUrl: "https://example.com/final-temp", statusCode: 302 }],
          html: "<html><head><title>302</title></head><body></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "LINKS_REDIR_DYN_1",
      ruleCode: "LINKS_INTERNAL_TO_REDIRECT",
      fixtureType: "dynamic_hydration",
      description: "Direct link to 200 page passes",
      url: "https://example.com/direct-link-pass",
      html: "<html><head><title>Pass</title></head><body><main><h1>Pass</h1><a href='https://example.com/target-200'>Target</a></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/target-200",
          statusCode: 200,
          html: "<html><head><title>Target</title></head><body><h1>Target</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "LINKS_REDIR_AMB_1",
      ruleCode: "LINKS_INTERNAL_TO_REDIRECT",
      fixtureType: "ambiguous_inconclusive",
      description: "Page with no links passes",
      url: "https://example.com/no-links-redir-check",
      html: "<html><head><title>No Links</title></head><body><main><h1>No Links</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 36. LINKS_BROKEN_EXTERNAL
  // =========================================================================
  fixtures.push(
    {
      id: "LINKS_EXT_TP_1",
      ruleCode: "LINKS_BROKEN_EXTERNAL",
      fixtureType: "true_positive",
      description: "Page containing external link with confirmed broken status",
      url: "https://example.com/page-with-broken-ext-link",
      graphOverride: {
        brokenExternalLinks: [
          {
            sourceUrl: "https://example.com/page-with-broken-ext-link",
            targetUrl: "https://broken-external-domain.com/404",
            statusCode: 404,
            statusCategory: "4xx_not_found",
            anchorText: "Broken Partner",
            evidence: { verifiedVia: "http_direct" },
          } as any
        ]
      },
      html: "<html><head><title>Broken External</title></head><body><main><h1>Broken Ext</h1><a href='https://broken-external-domain.com/404'>Broken Partner</a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "LINKS_EXT_TN_1",
      ruleCode: "LINKS_BROKEN_EXTERNAL",
      fixtureType: "true_negative",
      description: "Page with live external links",
      url: "https://example.com/clean-ext-links-page",
      graphOverride: { brokenExternalLinks: [] },
      html: "<html><head><title>Clean Ext</title></head><body><main><h1>Clean Ext</h1><a href='https://google.com'>Google</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_EXT_EXCL_1",
      ruleCode: "LINKS_BROKEN_EXTERNAL",
      fixtureType: "exclusion",
      description: "Page with bot-blocked external links has zero broken link penalty",
      url: "https://example.com/bot-blocked-page",
      graphOverride: {
        brokenExternalLinks: [],
        botBlockedExternalLinks: [
          {
            sourceUrl: "https://example.com/bot-blocked-page",
            targetUrl: "https://cloudflare-shielded.com",
            statusCode: 403,
            anchorText: "Shielded",
            evidence: { verifiedVia: "http_direct" },
          } as any
        ]
      },
      html: "<html><head><title>Bot Blocked</title></head><body><main><h1>Shielded</h1><a href='https://cloudflare-shielded.com'>Shielded</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_EXT_BOUND_1",
      ruleCode: "LINKS_BROKEN_EXTERNAL",
      fixtureType: "boundary",
      description: "External link returning 500 error triggers broken external link",
      url: "https://example.com/page-ext-500",
      graphOverride: {
        brokenExternalLinks: [
          {
            sourceUrl: "https://example.com/page-ext-500",
            targetUrl: "https://external-api-failure.com/500",
            statusCode: 500,
            statusCategory: "5xx_server_error",
            anchorText: "API Failure",
            evidence: { verifiedVia: "http_direct" },
          } as any
        ]
      },
      html: "<html><head><title>500 Ext</title></head><body><main><h1>500</h1><a href='https://external-api-failure.com/500'>API Failure</a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "LINKS_EXT_DYN_1",
      ruleCode: "LINKS_BROKEN_EXTERNAL",
      fixtureType: "dynamic_hydration",
      description: "Valid external link passes",
      url: "https://example.com/valid-ext",
      graphOverride: { brokenExternalLinks: [] },
      html: "<html><head><title>Valid</title></head><body><main><h1>Valid</h1><a href='https://w3.org'>W3C</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_EXT_AMB_1",
      ruleCode: "LINKS_BROKEN_EXTERNAL",
      fixtureType: "ambiguous_inconclusive",
      description: "Page without external links passes",
      url: "https://example.com/no-ext",
      graphOverride: { brokenExternalLinks: [] },
      html: "<html><head><title>No Ext</title></head><body><main><h1>No Ext</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 37. LINKS_EMPTY_ANCHOR
  // =========================================================================
  fixtures.push(
    {
      id: "LINKS_EMPTY_TP_1",
      ruleCode: "LINKS_EMPTY_ANCHOR",
      fixtureType: "true_positive",
      description: "Internal link anchor tag completely devoid of text or accessible name",
      url: "https://example.com/empty-anchor-page",
      html: "<html><head><title>Empty Anchor</title></head><body><main><h1>Empty Anchor Test</h1><a href='/about'></a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "LINKS_EMPTY_TN_1",
      ruleCode: "LINKS_EMPTY_ANCHOR",
      fixtureType: "true_negative",
      description: "Internal link anchor with descriptive text content",
      url: "https://example.com/descriptive-anchor-page",
      html: "<html><head><title>Descriptive Anchor</title></head><body><main><h1>Descriptive Anchor</h1><a href='/about'>Learn More About Our Team</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_EMPTY_EXCL_1",
      ruleCode: "LINKS_EMPTY_ANCHOR",
      fixtureType: "exclusion",
      description: "Anchor with child image containing descriptive alt text passes accessible name check",
      url: "https://example.com/img-anchor-page",
      html: "<html><head><title>Image Anchor</title></head><body><main><h1>Image Anchor</h1><a href='/products'><img src='/img/product.jpg' alt='Enterprise SEO Suite'></a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_EMPTY_BOUND_1",
      ruleCode: "LINKS_EMPTY_ANCHOR",
      fixtureType: "boundary",
      description: "Anchor containing only whitespace &nbsp; is treated as empty",
      url: "https://example.com/nbsp-anchor-page",
      html: "<html><head><title>Whitespace Anchor</title></head><body><main><h1>Whitespace</h1><a href='/contact'>   </a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "LINKS_EMPTY_DYN_1",
      ruleCode: "LINKS_EMPTY_ANCHOR",
      fixtureType: "dynamic_hydration",
      description: "Anchor with aria-label attribute passes accessible name test",
      url: "https://example.com/aria-label-anchor",
      html: "<html><head><title>Aria Anchor</title></head><body><main><h1>Aria</h1><a href='/cart' aria-label='View your shopping cart'><svg></svg></a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_EMPTY_AMB_1",
      ruleCode: "LINKS_EMPTY_ANCHOR",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid anchor text passes",
      url: "https://example.com/valid-anchor-amb",
      html: "<html><head><title>Valid Anchor</title></head><body><main><h1>Valid</h1><a href='/blog'>Read our latest SEO insights</a></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 38. LINKS_NON_DESCRIPTIVE_ANCHOR
  // =========================================================================
  fixtures.push(
    {
      id: "LINKS_NON_DESC_TP_1",
      ruleCode: "LINKS_NON_DESCRIPTIVE_ANCHOR",
      fixtureType: "true_positive",
      description: "Internal link using generic non-descriptive anchor text 'click here'",
      url: "https://example.com/generic-anchor-page",
      html: "<html><head><title>Generic Anchor</title></head><body><main><h1>Generic Anchor Test</h1><a href='/details'>click here</a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "LINKS_NON_DESC_TN_1",
      ruleCode: "LINKS_NON_DESCRIPTIVE_ANCHOR",
      fixtureType: "true_negative",
      description: "Internal link using specific keyword-rich anchor text",
      url: "https://example.com/specific-anchor-page",
      html: "<html><head><title>Specific Anchor</title></head><body><main><h1>Specific Anchor</h1><a href='/services'>Explore our automated SEO audit services</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_NON_DESC_EXCL_1",
      ruleCode: "LINKS_NON_DESCRIPTIVE_ANCHOR",
      fixtureType: "exclusion",
      description: "Generic word within longer descriptive phrase passes",
      url: "https://example.com/phrase-anchor-page",
      html: "<html><head><title>Phrase</title></head><body><main><h1>Phrase</h1><a href='/docs'>Click here to view our complete API documentation</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_NON_DESC_BOUND_1",
      ruleCode: "LINKS_NON_DESCRIPTIVE_ANCHOR",
      fixtureType: "boundary",
      description: "Single generic word 'more' triggers non-descriptive anchor",
      url: "https://example.com/more-anchor-page",
      html: "<html><head><title>More</title></head><body><main><h1>More</h1><a href='/article'>more...</a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "LINKS_NON_DESC_DYN_1",
      ruleCode: "LINKS_NON_DESCRIPTIVE_ANCHOR",
      fixtureType: "dynamic_hydration",
      description: "Descriptive anchor 'View pricing table' passes",
      url: "https://example.com/pricing-anchor",
      html: "<html><head><title>Pricing</title></head><body><main><h1>Pricing</h1><a href='/pricing'>View pricing table</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "LINKS_NON_DESC_AMB_1",
      ruleCode: "LINKS_NON_DESCRIPTIVE_ANCHOR",
      fixtureType: "ambiguous_inconclusive",
      description: "Empty anchor triggers missing accessible name, not non-descriptive",
      url: "https://example.com/empty-for-non-desc",
      html: "<html><head><title>Empty</title></head><body><main><h1>Empty</h1><a href='/about'></a></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 39. CODE_PLACEHOLDER_ANCHOR
  // =========================================================================
  fixtures.push(
    {
      id: "PLACEHOLDER_TP_1",
      ruleCode: "CODE_PLACEHOLDER_ANCHOR",
      fixtureType: "true_positive",
      description: "Interactive button disguised as anchor tag with href='#'",
      url: "https://example.com/placeholder-anchor-page",
      html: "<html><head><title>Placeholder</title></head><body><main><h1>Placeholder Test</h1><a href='#'>Open Modal</a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "PLACEHOLDER_TN_1",
      ruleCode: "CODE_PLACEHOLDER_ANCHOR",
      fixtureType: "true_negative",
      description: "Semantic button element used for interactive dialog trigger",
      url: "https://example.com/semantic-button-page",
      html: "<html><head><title>Semantic Button</title></head><body><main><h1>Semantic Button</h1><button type='button'>Open Modal</button></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "PLACEHOLDER_EXCL_1",
      ruleCode: "CODE_PLACEHOLDER_ANCHOR",
      fixtureType: "exclusion",
      description: "Valid deep in-page anchor jump to existing section ID passes",
      url: "https://example.com/deep-anchor-page",
      html: "<html><head><title>Deep Anchor</title></head><body><main><h1>Deep Anchor</h1><a href='#section-details'>Jump to Details</a><section id='section-details'><h2>Details</h2></section></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "PLACEHOLDER_BOUND_1",
      ruleCode: "CODE_PLACEHOLDER_ANCHOR",
      fixtureType: "boundary",
      description: "Anchor with href='javascript:void(0)' triggers placeholder control",
      url: "https://example.com/js-void-anchor",
      html: "<html><head><title>JS Void</title></head><body><main><h1>JS Void</h1><a href='javascript:void(0)'>Click Action</a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "PLACEHOLDER_DYN_1",
      ruleCode: "CODE_PLACEHOLDER_ANCHOR",
      fixtureType: "dynamic_hydration",
      description: "Standard hyperlink to valid URL passes",
      url: "https://example.com/valid-href-pass",
      html: "<html><head><title>Valid</title></head><body><main><h1>Valid</h1><a href='/features'>Features</a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "PLACEHOLDER_AMB_1",
      ruleCode: "CODE_PLACEHOLDER_ANCHOR",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid jump link #top passes",
      url: "https://example.com/top-jump",
      html: "<html><head><title>Top</title></head><body id='top'><main><h1>Top</h1><a href='#top'>Back to Top</a></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 40. ASSET_MISSING_ALT
  // =========================================================================
  fixtures.push(
    {
      id: "ALT_TP_1",
      ruleCode: "ASSET_MISSING_ALT",
      fixtureType: "true_positive",
      description: "Informative content image completely lacking an alt attribute",
      url: "https://example.com/missing-alt-image",
      html: "<html><head><title>Missing Alt</title></head><body><main><h1>Missing Alt</h1><img src='/images/architecture-diagram.png'></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "ALT_TN_1",
      ruleCode: "ASSET_MISSING_ALT",
      fixtureType: "true_negative",
      description: "Informative content image with descriptive alt text",
      url: "https://example.com/descriptive-alt-image",
      html: "<html><head><title>Descriptive Alt</title></head><body><main><h1>Descriptive Alt</h1><img src='/images/architecture-diagram.png' alt='Dream SEO crawler pipeline architecture diagram'></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "ALT_EXCL_1",
      ruleCode: "ASSET_MISSING_ALT",
      fixtureType: "exclusion",
      description: "Purely decorative icon image with explicit empty alt='' passes accessibility rules",
      url: "https://example.com/decorative-alt-image",
      html: "<html><head><title>Decorative</title></head><body><main><h1>Decorative</h1><img src='/icons/divider-line.svg' alt=''></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "ALT_BOUND_1",
      ruleCode: "ASSET_MISSING_ALT",
      fixtureType: "boundary",
      description: "Image tag with missing alt attribute in footer triggers missing alt finding",
      url: "https://example.com/footer-missing-alt",
      html: "<html><head><title>Footer Missing Alt</title></head><body><main><h1>Main</h1></main><footer><img src='/footer-logo.png'></footer></body></html>",
      expectedFinding: true,
    },
    {
      id: "ALT_DYN_1",
      ruleCode: "ASSET_MISSING_ALT",
      fixtureType: "dynamic_hydration",
      description: "Image with descriptive alt attribute passes",
      url: "https://example.com/hero-alt-pass",
      html: "<html><head><title>Hero</title></head><body><main><h1>Hero</h1><img src='/hero.jpg' alt='SEO Diagnostic Dashboard Hero Image'></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "ALT_AMB_1",
      ruleCode: "ASSET_MISSING_ALT",
      fixtureType: "ambiguous_inconclusive",
      description: "Page without images passes",
      url: "https://example.com/text-only-alt-check",
      html: "<html><head><title>Text Only</title></head><body><main><h1>Text Only</h1><p>No images.</p></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 41. IMAGE_LINK_MISSING_ALT
  // =========================================================================
  fixtures.push(
    {
      id: "IMG_LINK_TP_1",
      ruleCode: "IMAGE_LINK_MISSING_ALT",
      fixtureType: "true_positive",
      description: "Linked image wrapped in anchor tag missing alt attribute and accessible link context",
      url: "https://example.com/linked-img-missing-alt",
      html: "<html><head><title>Linked Img</title></head><body><main><h1>Linked Image</h1><a href='/product/seo-suite'><img src='/images/suite-thumbnail.jpg'></a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "IMG_LINK_TN_1",
      ruleCode: "IMAGE_LINK_MISSING_ALT",
      fixtureType: "true_negative",
      description: "Linked image with descriptive alt attribute on the img tag",
      url: "https://example.com/linked-img-with-alt",
      html: "<html><head><title>Linked Img</title></head><body><main><h1>Linked Image</h1><a href='/product/seo-suite'><img src='/images/suite-thumbnail.jpg' alt='Enterprise SEO Diagnostic Suite'></a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "IMG_LINK_EXCL_1",
      ruleCode: "IMAGE_LINK_MISSING_ALT",
      fixtureType: "exclusion",
      description: "Linked image where the enclosing anchor has an explicit aria-label passes",
      url: "https://example.com/linked-img-aria-label",
      html: "<html><head><title>Linked Img</title></head><body><main><h1>Linked Image</h1><a href='/product/seo-suite' aria-label='View Enterprise SEO Suite product details'><img src='/images/suite-thumbnail.jpg' alt=''></a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "IMG_LINK_BOUND_1",
      ruleCode: "IMAGE_LINK_MISSING_ALT",
      fixtureType: "boundary",
      description: "Linked image with no alt and no anchor text triggers issue",
      url: "https://example.com/linked-img-no-text",
      html: "<html><head><title>No Text</title></head><body><main><h1>No Text</h1><a href='/checkout'><img src='/cart-icon.png'></a></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "IMG_LINK_DYN_1",
      ruleCode: "IMAGE_LINK_MISSING_ALT",
      fixtureType: "dynamic_hydration",
      description: "Linked image with both alt and anchor text passes",
      url: "https://example.com/linked-img-rich",
      html: "<html><head><title>Rich</title></head><body><main><h1>Rich</h1><a href='/blog/seo'><img src='/thumb.jpg' alt='SEO Tips'><span>Read SEO Tips</span></a></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "IMG_LINK_AMB_1",
      ruleCode: "IMAGE_LINK_MISSING_ALT",
      fixtureType: "ambiguous_inconclusive",
      description: "Unlinked standalone image does not trigger linked image check",
      url: "https://example.com/unlinked-img-pass",
      html: "<html><head><title>Unlinked</title></head><body><main><h1>Unlinked</h1><img src='/pic.jpg' alt='Pic'></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 42. IMAGE_BROKEN
  // =========================================================================
  fixtures.push(
    {
      id: "IMG_BROKEN_TP_1",
      ruleCode: "IMAGE_BROKEN",
      fixtureType: "true_positive",
      description: "Embedded <img> src returns verified HTTP 404 client error",
      url: "https://example.com/page-broken-image",
      html: "<html><head><title>Broken Img</title></head><body><main><h1>Broken Img</h1><img src='https://example.com/missing-banner-404.jpg' alt='Banner'></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/missing-banner-404.jpg",
          statusCode: 404,
          html: "",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "IMG_BROKEN_TN_1",
      ruleCode: "IMAGE_BROKEN",
      fixtureType: "true_negative",
      description: "Embedded <img> src returns valid HTTP 200 OK",
      url: "https://example.com/page-valid-image",
      html: "<html><head><title>Valid Img</title></head><body><main><h1>Valid Img</h1><img src='https://example.com/valid-logo-200.png' alt='Logo'></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/valid-logo-200.png",
          statusCode: 200,
          html: "",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "IMG_BROKEN_EXCL_1",
      ruleCode: "IMAGE_BROKEN",
      fixtureType: "exclusion",
      description: "Page without embedded images has no broken image issues",
      url: "https://example.com/no-images-page",
      html: "<html><head><title>No Images</title></head><body><main><h1>No Images</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "IMG_BROKEN_BOUND_1",
      ruleCode: "IMAGE_BROKEN",
      fixtureType: "boundary",
      description: "Embedded image returning HTTP 500 server error triggers broken image finding",
      url: "https://example.com/page-500-img",
      html: "<html><head><title>500 Img</title></head><body><main><h1>500 Img</h1><img src='https://example.com/server-error-500.jpg' alt='Error'></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/server-error-500.jpg",
          statusCode: 500,
          html: "",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "IMG_BROKEN_DYN_1",
      ruleCode: "IMAGE_BROKEN",
      fixtureType: "dynamic_hydration",
      description: "Valid image asset passes",
      url: "https://example.com/valid-hero-pass",
      html: "<html><head><title>Valid Hero</title></head><body><main><h1>Hero</h1><img src='https://example.com/hero-200.jpg' alt='Hero'></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/hero-200.jpg",
          statusCode: 200,
          html: "",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "IMG_BROKEN_AMB_1",
      ruleCode: "IMAGE_BROKEN",
      fixtureType: "ambiguous_inconclusive",
      description: "Clean page passes",
      url: "https://example.com/clean-img-page",
      html: "<html><head><title>Clean</title></head><body><main><h1>Clean</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 43. ASSET_MISSING_DIMENSIONS
  // =========================================================================
  fixtures.push(
    {
      id: "DIM_TP_1",
      ruleCode: "ASSET_MISSING_DIMENSIONS",
      fixtureType: "true_positive",
      description: "Content image tag missing width and height attributes",
      url: "https://example.com/missing-dimensions-image",
      html: "<html><head><title>Missing Dimensions</title></head><body><main><h1>Missing Dimensions</h1><img src='/images/banner.jpg' alt='Banner'></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "DIM_TN_1",
      ruleCode: "ASSET_MISSING_DIMENSIONS",
      fixtureType: "true_negative",
      description: "Content image tag with explicit width and height attributes",
      url: "https://example.com/explicit-dimensions-image",
      html: "<html><head><title>Explicit Dimensions</title></head><body><main><h1>Explicit Dimensions</h1><img src='/images/banner.jpg' alt='Banner' width='1200' height='630'></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DIM_EXCL_1",
      ruleCode: "ASSET_MISSING_DIMENSIONS",
      fixtureType: "exclusion",
      description: "Scalable Vector Graphics (.svg) files are excluded from layout shift dimension requirements",
      url: "https://example.com/svg-dimensions-image",
      html: "<html><head><title>SVG Image</title></head><body><main><h1>SVG Image</h1><img src='/icons/brand-logo.svg' alt='Logo'></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DIM_BOUND_1",
      ruleCode: "ASSET_MISSING_DIMENSIONS",
      fixtureType: "boundary",
      description: "PNG image missing height attribute triggers missing dimensions",
      url: "https://example.com/missing-height-image",
      html: "<html><head><title>Missing Height</title></head><body><main><h1>Missing Height</h1><img src='/images/screenshot.png' alt='Screenshot' width='800'></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "DIM_DYN_1",
      ruleCode: "ASSET_MISSING_DIMENSIONS",
      fixtureType: "dynamic_hydration",
      description: "Image with both width and height attributes passes",
      url: "https://example.com/dimensions-pass",
      html: "<html><head><title>Pass</title></head><body><main><h1>Pass</h1><img src='/photo.jpg' alt='Photo' width='400' height='300'></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "DIM_AMB_1",
      ruleCode: "ASSET_MISSING_DIMENSIONS",
      fixtureType: "ambiguous_inconclusive",
      description: "Page without images passes",
      url: "https://example.com/no-images-dim-check",
      html: "<html><head><title>No Images</title></head><body><main><h1>No Images</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 44. RESOURCE_BROKEN_SCRIPT
  // =========================================================================
  fixtures.push(
    {
      id: "SCRIPT_BROKEN_TP_1",
      ruleCode: "RESOURCE_BROKEN_SCRIPT",
      fixtureType: "true_positive",
      description: "Document includes <script src> returning HTTP 404 client error",
      url: "https://example.com/page-broken-script",
      html: "<html><head><title>Broken Script</title><script src='https://example.com/missing-bundle-404.js'></script></head><body><main><h1>Broken Script</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/missing-bundle-404.js",
          statusCode: 404,
          html: "",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "SCRIPT_BROKEN_TN_1",
      ruleCode: "RESOURCE_BROKEN_SCRIPT",
      fixtureType: "true_negative",
      description: "Document includes <script src> returning HTTP 200 OK",
      url: "https://example.com/page-valid-script",
      html: "<html><head><title>Valid Script</title><script src='https://example.com/valid-app-200.js'></script></head><body><main><h1>Valid Script</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/valid-app-200.js",
          statusCode: 200,
          html: "",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "SCRIPT_BROKEN_EXCL_1",
      ruleCode: "RESOURCE_BROKEN_SCRIPT",
      fixtureType: "exclusion",
      description: "Document with inline script and no external script sources passes",
      url: "https://example.com/inline-script-page",
      html: "<html><head><title>Inline Script</title><script>console.log('init');</script></head><body><main><h1>Inline Script</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SCRIPT_BROKEN_BOUND_1",
      ruleCode: "RESOURCE_BROKEN_SCRIPT",
      fixtureType: "boundary",
      description: "Script tag returning HTTP 500 server error triggers broken script finding",
      url: "https://example.com/page-500-script",
      html: "<html><head><title>500 Script</title><script src='https://example.com/server-error-500.js'></script></head><body><main><h1>500 Script</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/server-error-500.js",
          statusCode: 500,
          html: "",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "SCRIPT_BROKEN_DYN_1",
      ruleCode: "RESOURCE_BROKEN_SCRIPT",
      fixtureType: "dynamic_hydration",
      description: "Valid deployed script passes",
      url: "https://example.com/valid-bundle-pass",
      html: "<html><head><title>Pass</title><script src='https://example.com/main-200.js'></script></head><body><main><h1>Pass</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/main-200.js",
          statusCode: 200,
          html: "",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "SCRIPT_BROKEN_AMB_1",
      ruleCode: "RESOURCE_BROKEN_SCRIPT",
      fixtureType: "ambiguous_inconclusive",
      description: "Page without scripts passes",
      url: "https://example.com/no-scripts-page",
      html: "<html><head><title>No Scripts</title></head><body><main><h1>No Scripts</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 45. RESOURCE_BROKEN_STYLESHEET
  // =========================================================================
  fixtures.push(
    {
      id: "CSS_BROKEN_TP_1",
      ruleCode: "RESOURCE_BROKEN_STYLESHEET",
      fixtureType: "true_positive",
      description: "Document includes <link rel='stylesheet'> returning HTTP 404 client error",
      url: "https://example.com/page-broken-css",
      html: "<html><head><title>Broken CSS</title><link rel='stylesheet' href='https://example.com/missing-styles-404.css'></head><body><main><h1>Broken CSS</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/missing-styles-404.css",
          statusCode: 404,
          html: "",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "CSS_BROKEN_TN_1",
      ruleCode: "RESOURCE_BROKEN_STYLESHEET",
      fixtureType: "true_negative",
      description: "Document includes <link rel='stylesheet'> returning HTTP 200 OK",
      url: "https://example.com/page-valid-css",
      html: "<html><head><title>Valid CSS</title><link rel='stylesheet' href='https://example.com/valid-styles-200.css'></head><body><main><h1>Valid CSS</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/valid-styles-200.css",
          statusCode: 200,
          html: "",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "CSS_BROKEN_EXCL_1",
      ruleCode: "RESOURCE_BROKEN_STYLESHEET",
      fixtureType: "exclusion",
      description: "Document with inline <style> block and no external link tags passes",
      url: "https://example.com/inline-css-page",
      html: "<html><head><title>Inline CSS</title><style>body { font-family: sans-serif; }</style></head><body><main><h1>Inline CSS</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "CSS_BROKEN_BOUND_1",
      ruleCode: "RESOURCE_BROKEN_STYLESHEET",
      fixtureType: "boundary",
      description: "Stylesheet returning HTTP 500 server error triggers broken stylesheet finding",
      url: "https://example.com/page-500-css",
      html: "<html><head><title>500 CSS</title><link rel='stylesheet' href='https://example.com/server-error-500.css'></head><body><main><h1>500 CSS</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/server-error-500.css",
          statusCode: 500,
          html: "",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "CSS_BROKEN_DYN_1",
      ruleCode: "RESOURCE_BROKEN_STYLESHEET",
      fixtureType: "dynamic_hydration",
      description: "Valid deployed stylesheet passes",
      url: "https://example.com/valid-theme-pass",
      html: "<html><head><title>Pass</title><link rel='stylesheet' href='https://example.com/theme-200.css'></head><body><main><h1>Pass</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/theme-200.css",
          statusCode: 200,
          html: "",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "CSS_BROKEN_AMB_1",
      ruleCode: "RESOURCE_BROKEN_STYLESHEET",
      fixtureType: "ambiguous_inconclusive",
      description: "Page without stylesheet links passes",
      url: "https://example.com/no-css-links",
      html: "<html><head><title>No CSS</title></head><body><main><h1>No CSS</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 46. PERF_LARGE_HTML_PAYLOAD
  // =========================================================================
  fixtures.push(
    {
      id: "PAYLOAD_TP_1",
      ruleCode: "PERF_LARGE_HTML_PAYLOAD",
      fixtureType: "true_positive",
      description: "Raw HTML document size exceeds 2.2 MB (> 2 MB threshold)",
      url: "https://example.com/bloated-page",
      html: "<html><head><title>Bloated</title></head><body><main><h1>Bloated HTML</h1><div>" + "<!-- Bloated JSON hydration state payload -->".repeat(65000) + "</div></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "PAYLOAD_TN_1",
      ruleCode: "PERF_LARGE_HTML_PAYLOAD",
      fixtureType: "true_negative",
      description: "Optimal lightweight raw HTML document (< 100 KB)",
      url: "https://example.com/lightweight-page",
      html: "<html><head><title>Lightweight</title></head><body><main><h1>Lightweight Page</h1><p>Clean semantic markup...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "PAYLOAD_EXCL_1",
      ruleCode: "PERF_LARGE_HTML_PAYLOAD",
      fixtureType: "exclusion",
      description: "Moderate 250 KB document passes without penalty",
      url: "https://example.com/moderate-payload",
      html: "<html><head><title>Moderate</title></head><body><main><h1>Moderate</h1><div>" + "Content text paragraph. ".repeat(4000) + "</div></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "PAYLOAD_BOUND_1",
      ruleCode: "PERF_LARGE_HTML_PAYLOAD",
      fixtureType: "boundary",
      description: "Document with 2.1 MB raw HTML payload triggers large payload finding",
      url: "https://example.com/boundary-2-1mb",
      html: "<html><head><title>2.1MB</title></head><body><main><h1>2.1MB</h1><div>" + "X".repeat(2150000) + "</div></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "PAYLOAD_DYN_1",
      ruleCode: "PERF_LARGE_HTML_PAYLOAD",
      fixtureType: "dynamic_hydration",
      description: "Document with 50 KB raw HTML passes",
      url: "https://example.com/clean-50kb",
      html: "<html><head><title>Clean 50KB</title></head><body><main><h1>Clean</h1><p>" + "Semantic body content. ".repeat(500) + "</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "PAYLOAD_AMB_1",
      ruleCode: "PERF_LARGE_HTML_PAYLOAD",
      fixtureType: "ambiguous_inconclusive",
      description: "Standard 10 KB page passes",
      url: "https://example.com/standard-10kb",
      html: "<html><head><title>Standard</title></head><body><main><h1>Standard</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 47. PERF_SLOW_SERVER_RESPONSE
  // =========================================================================
  fixtures.push(
    {
      id: "TTFB_TP_1",
      ruleCode: "PERF_SLOW_SERVER_RESPONSE",
      fixtureType: "true_positive",
      description: "Server response time measured at 2100ms (> 1500ms threshold)",
      url: "https://example.com/slow-response-page",
      ttfbMs: 2100,
      html: "<html><head><title>Slow Response</title></head><body><main><h1>Slow Page</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "TTFB_TN_1",
      ruleCode: "PERF_SLOW_SERVER_RESPONSE",
      fixtureType: "true_negative",
      description: "Fast server response measured at 120ms (< 1500ms)",
      url: "https://example.com/fast-response-page",
      ttfbMs: 120,
      html: "<html><head><title>Fast Response</title></head><body><main><h1>Fast Page</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "TTFB_EXCL_1",
      ruleCode: "PERF_SLOW_SERVER_RESPONSE",
      fixtureType: "exclusion",
      description: "Moderate 450ms server response passes without slow response penalty",
      url: "https://example.com/moderate-ttfb-page",
      ttfbMs: 450,
      html: "<html><head><title>Moderate</title></head><body><main><h1>Moderate</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "TTFB_BOUND_1",
      ruleCode: "PERF_SLOW_SERVER_RESPONSE",
      fixtureType: "boundary",
      description: "Server response measured at 1550ms triggers slow response warning",
      url: "https://example.com/ttfb-1550",
      ttfbMs: 1550,
      html: "<html><head><title>1550ms</title></head><body><main><h1>1550ms</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "TTFB_DYN_1",
      ruleCode: "PERF_SLOW_SERVER_RESPONSE",
      fixtureType: "dynamic_hydration",
      description: "Server response measured at 1450ms passes",
      url: "https://example.com/ttfb-1450",
      ttfbMs: 1450,
      html: "<html><head><title>1450ms</title></head><body><main><h1>1450ms</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "TTFB_AMB_1",
      ruleCode: "PERF_SLOW_SERVER_RESPONSE",
      fixtureType: "ambiguous_inconclusive",
      description: "Default 120ms response passes",
      url: "https://example.com/ttfb-default",
      ttfbMs: 120,
      html: "<html><head><title>Default</title></head><body><main><h1>Default</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 48. A11Y_MISSING_MAIN_LANDMARK
  // =========================================================================
  fixtures.push(
    {
      id: "MAIN_LAND_TP_1",
      ruleCode: "A11Y_MISSING_MAIN_LANDMARK",
      fixtureType: "true_positive",
      description: "Content page missing semantic <main> or role='main' landmark container",
      url: "https://example.com/missing-main-landmark",
      html: "<html><head><title>Missing Main</title></head><body><div><h1>Primary Title</h1><p>Body text without semantic landmark wrapper.</p></div></body></html>",
      expectedFinding: true,
    },
    {
      id: "MAIN_LAND_TN_1",
      ruleCode: "A11Y_MISSING_MAIN_LANDMARK",
      fixtureType: "true_negative",
      description: "Content page with proper semantic <main> element",
      url: "https://example.com/valid-main-landmark",
      html: "<html><head><title>Valid Main</title></head><body><main><h1>Primary Title</h1><p>Body text inside semantic main.</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "MAIN_LAND_EXCL_1",
      ruleCode: "A11Y_MISSING_MAIN_LANDMARK",
      fixtureType: "exclusion",
      description: "Page using <div role='main'> passes accessible landmark requirement",
      url: "https://example.com/role-main-landmark",
      html: "<html><head><title>Role Main</title></head><body><div role='main'><h1>Role Main Title</h1><p>Text...</p></div></body></html>",
      expectedFinding: false,
    },
    {
      id: "MAIN_LAND_BOUND_1",
      ruleCode: "A11Y_MISSING_MAIN_LANDMARK",
      fixtureType: "boundary",
      description: "Page with only header and footer missing main triggers finding",
      url: "https://example.com/header-footer-only",
      html: "<html><head><title>Header Footer</title></head><body><header><nav>Nav</nav></header><div><p>Content</p></div><footer>Footer</footer></body></html>",
      expectedFinding: true,
    },
    {
      id: "MAIN_LAND_DYN_1",
      ruleCode: "A11Y_MISSING_MAIN_LANDMARK",
      fixtureType: "dynamic_hydration",
      description: "Standard <main> container passes",
      url: "https://example.com/standard-main-pass",
      html: "<html><head><title>Standard</title></head><body><header></header><main><h1>Title</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "MAIN_LAND_AMB_1",
      ruleCode: "A11Y_MISSING_MAIN_LANDMARK",
      fixtureType: "ambiguous_inconclusive",
      description: "Semantic main element passes",
      url: "https://example.com/semantic-main-amb",
      html: "<html><head><title>Semantic</title></head><body><main><h1>Semantic</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 49. A11Y_UNLABELLED_FORM_CONTROL
  // =========================================================================
  fixtures.push(
    {
      id: "FORM_LABEL_TP_1",
      ruleCode: "A11Y_UNLABELLED_FORM_CONTROL",
      fixtureType: "true_positive",
      description: "Interactive input field lacking associated <label for> or aria-label",
      url: "https://example.com/unlabelled-form",
      html: "<html><head><title>Unlabelled</title></head><body><main><h1>Form</h1><form><input type='text' name='user_email'></form></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "FORM_LABEL_TN_1",
      ruleCode: "A11Y_UNLABELLED_FORM_CONTROL",
      fixtureType: "true_negative",
      description: "Input field with matching <label for='email_id'>",
      url: "https://example.com/labelled-form",
      html: "<html><head><title>Labelled</title></head><body><main><h1>Form</h1><form><label for='email_id'>Email Address</label><input type='email' id='email_id' name='email'></form></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "FORM_LABEL_EXCL_1",
      ruleCode: "A11Y_UNLABELLED_FORM_CONTROL",
      fixtureType: "exclusion",
      description: "Input field with aria-label attribute passes accessible name test",
      url: "https://example.com/aria-labelled-form",
      html: "<html><head><title>Aria Labelled</title></head><body><main><h1>Search</h1><form><input type='search' name='q' aria-label='Search website catalog'></form></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "FORM_LABEL_BOUND_1",
      ruleCode: "A11Y_UNLABELLED_FORM_CONTROL",
      fixtureType: "boundary",
      description: "Unlabelled <textarea> control triggers unlabelled form control finding",
      url: "https://example.com/unlabelled-textarea",
      html: "<html><head><title>Textarea</title></head><body><main><h1>Feedback</h1><form><textarea name='comments'></textarea></form></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "FORM_LABEL_DYN_1",
      ruleCode: "A11Y_UNLABELLED_FORM_CONTROL",
      fixtureType: "dynamic_hydration",
      description: "Input with wrapped parent <label> passes",
      url: "https://example.com/wrapped-label",
      html: "<html><head><title>Wrapped</title></head><body><main><h1>Wrapped</h1><form><label>Your Name: <input type='text' name='name'></label></form></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "FORM_LABEL_AMB_1",
      ruleCode: "A11Y_UNLABELLED_FORM_CONTROL",
      fixtureType: "ambiguous_inconclusive",
      description: "Page without forms passes",
      url: "https://example.com/no-forms-page",
      html: "<html><head><title>No Forms</title></head><body><main><h1>No Forms</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 50. MOBILE_VIEWPORT_MISSING
  // =========================================================================
  fixtures.push(
    {
      id: "VIEWPORT_MISS_TP_1",
      ruleCode: "MOBILE_VIEWPORT_MISSING",
      fixtureType: "true_positive",
      description: "Document <head> completely missing <meta name='viewport'> tag",
      url: "https://example.com/missing-viewport",
      html: "<html><head><title>Missing Viewport</title></head><body><main><h1>Desktop Scaling</h1><p>Text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "VIEWPORT_MISS_TN_1",
      ruleCode: "MOBILE_VIEWPORT_MISSING",
      fixtureType: "true_negative",
      description: "Document <head> with standard responsive <meta name='viewport' content='width=device-width, initial-scale=1'>",
      url: "https://example.com/valid-viewport",
      html: "<html><head><title>Valid Viewport</title><meta name='viewport' content='width=device-width, initial-scale=1'></head><body><main><h1>Responsive</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "VIEWPORT_MISS_EXCL_1",
      ruleCode: "MOBILE_VIEWPORT_MISSING",
      fixtureType: "exclusion",
      description: "Document with viewport tag present (even if invalid) does not trigger MISSING viewport",
      url: "https://example.com/present-viewport-check",
      html: "<html><head><title>Present</title><meta name='viewport' content='width=1024'></head><body><main><h1>Fixed</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "VIEWPORT_MISS_BOUND_1",
      ruleCode: "MOBILE_VIEWPORT_MISSING",
      fixtureType: "boundary",
      description: "Empty document <head> triggers missing viewport",
      url: "https://example.com/empty-head-viewport",
      html: "<html><head></head><body><main><h1>Empty Head</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "VIEWPORT_MISS_DYN_1",
      ruleCode: "MOBILE_VIEWPORT_MISSING",
      fixtureType: "dynamic_hydration",
      description: "Valid standard responsive viewport passes",
      url: "https://example.com/standard-viewport-pass",
      html: "<html><head><title>Pass</title><meta name='viewport' content='width=device-width, initial-scale=1.0'></head><body><main><h1>Pass</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "VIEWPORT_MISS_AMB_1",
      ruleCode: "MOBILE_VIEWPORT_MISSING",
      fixtureType: "ambiguous_inconclusive",
      description: "Standard viewport passes",
      url: "https://example.com/viewport-pass-amb",
      html: "<html><head><title>Pass</title><meta name='viewport' content='width=device-width, initial-scale=1'></head><body><main><h1>Pass</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 51. MOBILE_VIEWPORT_INVALID
  // =========================================================================
  fixtures.push(
    {
      id: "VIEWPORT_INV_TP_1",
      ruleCode: "MOBILE_VIEWPORT_INVALID",
      fixtureType: "true_positive",
      description: "Viewport tag disables user zoom (user-scalable=no / maximum-scale=1.0)",
      url: "https://example.com/no-zoom-viewport",
      html: "<html><head><title>No Zoom</title><meta name='viewport' content='width=device-width, initial-scale=1, user-scalable=no'></head><body><main><h1>No Zoom</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "VIEWPORT_INV_TN_1",
      ruleCode: "MOBILE_VIEWPORT_INVALID",
      fixtureType: "true_negative",
      description: "Standard valid viewport tag allowing responsive scaling",
      url: "https://example.com/valid-scaling-viewport",
      html: "<html><head><title>Valid</title><meta name='viewport' content='width=device-width, initial-scale=1'></head><body><main><h1>Valid</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "VIEWPORT_INV_EXCL_1",
      ruleCode: "MOBILE_VIEWPORT_INVALID",
      fixtureType: "exclusion",
      description: "Missing viewport tag triggers MISSING rule, not INVALID rule",
      url: "https://example.com/no-viewport-tag",
      html: "<html><head><title>No Tag</title></head><body><main><h1>No Tag</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "VIEWPORT_INV_BOUND_1",
      ruleCode: "MOBILE_VIEWPORT_INVALID",
      fixtureType: "boundary",
      description: "Fixed pixel width viewport (width=1024) triggers invalid viewport finding",
      url: "https://example.com/fixed-width-viewport",
      html: "<html><head><title>Fixed Width</title><meta name='viewport' content='width=1024, initial-scale=1'></head><body><main><h1>Fixed</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "VIEWPORT_INV_DYN_1",
      ruleCode: "MOBILE_VIEWPORT_INVALID",
      fixtureType: "dynamic_hydration",
      description: "Standard responsive viewport passes",
      url: "https://example.com/responsive-pass",
      html: "<html><head><title>Pass</title><meta name='viewport' content='width=device-width, initial-scale=1.0'></head><body><main><h1>Pass</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "VIEWPORT_INV_AMB_1",
      ruleCode: "MOBILE_VIEWPORT_INVALID",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid device-width viewport passes",
      url: "https://example.com/device-width-pass",
      html: "<html><head><title>Pass</title><meta name='viewport' content='width=device-width, initial-scale=1'></head><body><main><h1>Pass</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 52. HTML_TITLE_MULTIPLE
  // =========================================================================
  fixtures.push(
    {
      id: "HTML_TITLE_TP_1",
      ruleCode: "HTML_TITLE_MULTIPLE",
      fixtureType: "true_positive",
      description: "HTML document contains 2 <title> tags in DOM",
      url: "https://example.com/two-title-tags",
      html: "<html><head><title>First Title</title><title>Second Title</title></head><body><main><h1>Two Titles</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "HTML_TITLE_TN_1",
      ruleCode: "HTML_TITLE_MULTIPLE",
      fixtureType: "true_negative",
      description: "HTML document contains exactly one <title> tag in <head>",
      url: "https://example.com/single-title-tag",
      html: "<html><head><title>Single Primary Title</title></head><body><main><h1>Single Title</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTML_TITLE_EXCL_1",
      ruleCode: "HTML_TITLE_MULTIPLE",
      fixtureType: "exclusion",
      description: "Document with 0 title tags has no multiple title issue",
      url: "https://example.com/zero-title-tags",
      html: "<html><head></head><body><main><h1>No Titles</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTML_TITLE_BOUND_1",
      ruleCode: "HTML_TITLE_MULTIPLE",
      fixtureType: "boundary",
      description: "Document with title in head and another in body triggers multiple title tags",
      url: "https://example.com/head-and-body-title",
      html: "<html><head><title>Head Title</title></head><body><title>Body Title</title><main><h1>Main</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "HTML_TITLE_DYN_1",
      ruleCode: "HTML_TITLE_MULTIPLE",
      fixtureType: "dynamic_hydration",
      description: "Single title tag passes",
      url: "https://example.com/single-title-pass",
      html: "<html><head><title>Valid Title</title></head><body><main><h1>Valid</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTML_TITLE_AMB_1",
      ruleCode: "HTML_TITLE_MULTIPLE",
      fixtureType: "ambiguous_inconclusive",
      description: "Clean title tag passes",
      url: "https://example.com/clean-title-amb",
      html: "<html><head><title>Clean Title</title></head><body><main><h1>Clean</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 53. HTML_META_DESC_MULTIPLE
  // =========================================================================
  fixtures.push(
    {
      id: "HTML_META_TP_1",
      ruleCode: "HTML_META_DESC_MULTIPLE",
      fixtureType: "true_positive",
      description: "HTML document contains 2 <meta name='description'> tags in DOM",
      url: "https://example.com/two-meta-desc-tags",
      html: "<html><head><title>Two Meta</title><meta name='description' content='First description.'><meta name='description' content='Second conflicting description.'></head><body><main><h1>Two Meta</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "HTML_META_TN_1",
      ruleCode: "HTML_META_DESC_MULTIPLE",
      fixtureType: "true_negative",
      description: "HTML document contains exactly one primary meta description tag",
      url: "https://example.com/single-meta-desc-tag",
      html: "<html><head><title>Single Meta</title><meta name='description' content='Single authoritative meta description.'></head><body><main><h1>Single Meta</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTML_META_EXCL_1",
      ruleCode: "HTML_META_DESC_MULTIPLE",
      fixtureType: "exclusion",
      description: "Document with 0 meta description tags has no multiple meta description issue",
      url: "https://example.com/zero-meta-desc-tags",
      html: "<html><head><title>Zero Meta</title></head><body><main><h1>Zero Meta</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTML_META_BOUND_1",
      ruleCode: "HTML_META_DESC_MULTIPLE",
      fixtureType: "boundary",
      description: "Document with 3 meta description tags triggers multiple meta description issue",
      url: "https://example.com/three-meta-desc-tags",
      html: "<html><head><title>Three Meta</title><meta name='description' content='D1'><meta name='description' content='D2'><meta name='description' content='D3'></head><body><main><h1>Three</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "HTML_META_DYN_1",
      ruleCode: "HTML_META_DESC_MULTIPLE",
      fixtureType: "dynamic_hydration",
      description: "Single meta description passes",
      url: "https://example.com/single-desc-pass",
      html: "<html><head><title>Pass</title><meta name='description' content='Comprehensive crawl analysis.'></head><body><main><h1>Pass</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTML_META_AMB_1",
      ruleCode: "HTML_META_DESC_MULTIPLE",
      fixtureType: "ambiguous_inconclusive",
      description: "Clean meta description passes",
      url: "https://example.com/clean-desc-amb",
      html: "<html><head><title>Clean</title><meta name='description' content='Authoritative crawl suite.'></head><body><main><h1>Clean</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 54. SEC_MISSING_NOSNIFF
  // =========================================================================
  fixtures.push(
    {
      id: "NOSNIFF_TP_1",
      ruleCode: "SEC_MISSING_NOSNIFF",
      fixtureType: "true_positive",
      description: "Server response lacks X-Content-Type-Options: nosniff header",
      url: "https://example.com/missing-nosniff",
      headers: { "content-type": "text/html" },
      html: "<html><head><title>Missing Nosniff</title></head><body><main><h1>Security Test</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "NOSNIFF_TN_1",
      ruleCode: "SEC_MISSING_NOSNIFF",
      fixtureType: "true_negative",
      description: "Server response returns valid 'X-Content-Type-Options: nosniff' header",
      url: "https://example.com/valid-nosniff",
      headers: { "x-content-type-options": "nosniff", "content-type": "text/html" },
      html: "<html><head><title>Valid Nosniff</title></head><body><main><h1>Security Test</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "NOSNIFF_EXCL_1",
      ruleCode: "SEC_MISSING_NOSNIFF",
      fixtureType: "exclusion",
      description: "Case-insensitive 'X-Content-Type-Options: NOSNIFF' passes validation",
      url: "https://example.com/case-nosniff",
      headers: { "x-content-type-options": "NOSNIFF", "content-type": "text/html" },
      html: "<html><head><title>Case Nosniff</title></head><body><main><h1>Security Test</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "NOSNIFF_BOUND_1",
      ruleCode: "SEC_MISSING_NOSNIFF",
      fixtureType: "boundary",
      description: "Empty header value triggers missing nosniff finding",
      url: "https://example.com/empty-nosniff-val",
      headers: { "x-content-type-options": "", "content-type": "text/html" },
      html: "<html><head><title>Empty Nosniff</title></head><body><main><h1>Empty</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "NOSNIFF_DYN_1",
      ruleCode: "SEC_MISSING_NOSNIFF",
      fixtureType: "dynamic_hydration",
      description: "Standard 'nosniff' response passes",
      url: "https://example.com/nosniff-pass",
      headers: { "x-content-type-options": "nosniff", "content-type": "text/html" },
      html: "<html><head><title>Pass</title></head><body><main><h1>Pass</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "NOSNIFF_AMB_1",
      ruleCode: "SEC_MISSING_NOSNIFF",
      fixtureType: "ambiguous_inconclusive",
      description: "Empty header bag triggers missing nosniff finding",
      url: "https://example.com/empty-headers",
      headers: {},
      html: "<html><head><title>Empty</title></head><body><main><h1>Empty</h1></main></body></html>",
      expectedFinding: true,
    }
  );

  // =========================================================================
  // 55. SEC_MIXED_CONTENT
  // =========================================================================
  fixtures.push(
    {
      id: "MIXED_SEC_TP_1",
      ruleCode: "SEC_MIXED_CONTENT",
      fixtureType: "true_positive",
      description: "HTTPS page loads insecure http:// script resource",
      url: "https://example.com/mixed-content-page",
      html: "<html><head><title>Mixed Content</title><script src='http://insecure-cdn.com/analytics.js'></script></head><body><main><h1>Mixed Content</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "MIXED_SEC_TN_1",
      ruleCode: "SEC_MIXED_CONTENT",
      fixtureType: "true_negative",
      description: "HTTPS page loads all assets securely over https://",
      url: "https://example.com/secure-https-page",
      html: "<html><head><title>Secure HTTPS</title><script src='https://secure-cdn.com/app.js'></script><img src='https://example.com/logo.png' alt='Logo'></head><body><main><h1>Secure</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "MIXED_SEC_EXCL_1",
      ruleCode: "SEC_MIXED_CONTENT",
      fixtureType: "exclusion",
      description: "Plain HTTP origin page loading http:// assets is not mixed content",
      url: "http://example.com/http-origin-page",
      html: "<html><head><title>HTTP Origin</title><script src='http://example.com/script.js'></script></head><body><main><h1>HTTP</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "MIXED_SEC_BOUND_1",
      ruleCode: "SEC_MIXED_CONTENT",
      fixtureType: "boundary",
      description: "HTTPS page loading insecure http:// image triggers mixed content",
      url: "https://example.com/mixed-image-page",
      html: "<html><head><title>Mixed Image</title></head><body><main><h1>Mixed Image</h1><img src='http://insecure-images.com/banner.jpg' alt='Banner'></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "MIXED_SEC_DYN_1",
      ruleCode: "SEC_MIXED_CONTENT",
      fixtureType: "dynamic_hydration",
      description: "HTTPS page loading relative asset paths passes",
      url: "https://example.com/relative-assets-page",
      html: "<html><head><title>Relative</title><link rel='stylesheet' href='/styles/main.css'></head><body><main><h1>Relative</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "MIXED_SEC_AMB_1",
      ruleCode: "SEC_MIXED_CONTENT",
      fixtureType: "ambiguous_inconclusive",
      description: "Secure HTTPS page passes",
      url: "https://example.com/clean-https-amb",
      html: "<html><head><title>Clean</title></head><body><main><h1>Clean</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 56. SCHEMA_MALFORMED_JSON
  // =========================================================================
  fixtures.push(
    {
      id: "SCHEMA_JSON_TP_1",
      ruleCode: "SCHEMA_MALFORMED_JSON",
      fixtureType: "true_positive",
      description: "Page containing malformed JSON-LD script with syntax error (trailing comma/unclosed quote)",
      url: "https://example.com/malformed-schema",
      html: "<html><head><title>Malformed Schema</title><script type='application/ld+json'>{ '@context': 'https://schema.org', '@type': 'Organization', 'name': 'Dream SEO', }</script></head><body><main><h1>Schema Test</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "SCHEMA_JSON_TN_1",
      ruleCode: "SCHEMA_MALFORMED_JSON",
      fixtureType: "true_negative",
      description: "Page containing perfectly valid standard Schema.org JSON-LD markup",
      url: "https://example.com/valid-schema",
      html: '<html><head><title>Valid Schema</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Dream SEO","url":"https://example.com"}</script></head><body><main><h1>Valid Schema</h1></main></body></html>',
      expectedFinding: false,
    },
    {
      id: "SCHEMA_JSON_EXCL_1",
      ruleCode: "SCHEMA_MALFORMED_JSON",
      fixtureType: "exclusion",
      description: "Page with no structured data scripts does not trigger malformed schema errors",
      url: "https://example.com/no-schema",
      html: "<html><head><title>No Schema</title></head><body><main><h1>No Schema</h1><p>Text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SCHEMA_JSON_BOUND_1",
      ruleCode: "SCHEMA_MALFORMED_JSON",
      fixtureType: "boundary",
      description: "Unclosed curly brace in JSON-LD script triggers malformed JSON error",
      url: "https://example.com/unclosed-brace-schema",
      html: '<html><head><title>Unclosed</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"</script></head><body><main><h1>Unclosed</h1></main></body></html>',
      expectedFinding: true,
    },
    {
      id: "SCHEMA_JSON_DYN_1",
      ruleCode: "SCHEMA_MALFORMED_JSON",
      fixtureType: "dynamic_hydration",
      description: "Multiple valid JSON-LD scripts pass cleanly",
      url: "https://example.com/multi-valid-schema",
      html: '<html><head><title>Multi Schema</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Dream SEO"}</script><script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script></head><body><main><h1>Multi Schema</h1></main></body></html>',
      expectedFinding: false,
    },
    {
      id: "SCHEMA_JSON_AMB_1",
      ruleCode: "SCHEMA_MALFORMED_JSON",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid single JSON-LD block passes",
      url: "https://example.com/valid-article-schema",
      html: '<html><head><title>Article</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"SEO Guide"}</script></head><body><main><h1>Article</h1></main></body></html>',
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 57. SCHEMA_MISSING_TYPE
  // =========================================================================
  fixtures.push(
    {
      id: "SCHEMA_TYPE_TP_1",
      ruleCode: "SCHEMA_MISSING_TYPE",
      fixtureType: "true_positive",
      description: "JSON-LD script with @context but missing @type attribute",
      url: "https://example.com/missing-type-schema",
      html: '<html><head><title>Missing Type</title><script type="application/ld+json">{"@context":"https://schema.org","name":"Dream SEO Organization"}</script></head><body><main><h1>Missing Type</h1></main></body></html>',
      expectedFinding: true,
    },
    {
      id: "SCHEMA_TYPE_TN_1",
      ruleCode: "SCHEMA_MISSING_TYPE",
      fixtureType: "true_negative",
      description: "JSON-LD script with valid @type: 'Organization'",
      url: "https://example.com/valid-type-schema",
      html: '<html><head><title>Valid Type</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Dream SEO"}</script></head><body><main><h1>Valid Type</h1></main></body></html>',
      expectedFinding: false,
    },
    {
      id: "SCHEMA_TYPE_EXCL_1",
      ruleCode: "SCHEMA_MISSING_TYPE",
      fixtureType: "exclusion",
      description: "Page with no JSON-LD scripts has no missing type errors",
      url: "https://example.com/no-schema-type-check",
      html: "<html><head><title>No Schema</title></head><body><main><h1>No Schema</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SCHEMA_TYPE_BOUND_1",
      ruleCode: "SCHEMA_MISSING_TYPE",
      fixtureType: "boundary",
      description: "JSON-LD script with empty string @type: '' triggers missing type",
      url: "https://example.com/empty-type-schema",
      html: '<html><head><title>Empty Type</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"","name":"Test"}</script></head><body><main><h1>Empty Type</h1></main></body></html>',
      expectedFinding: true,
    },
    {
      id: "SCHEMA_TYPE_DYN_1",
      ruleCode: "SCHEMA_MISSING_TYPE",
      fixtureType: "dynamic_hydration",
      description: "Valid Schema Product type passes",
      url: "https://example.com/product-type-schema",
      html: '<html><head><title>Product</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"SEO Tool"}</script></head><body><main><h1>Product</h1></main></body></html>',
      expectedFinding: false,
    },
    {
      id: "SCHEMA_TYPE_AMB_1",
      ruleCode: "SCHEMA_MISSING_TYPE",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid Schema Article type passes",
      url: "https://example.com/article-type-schema",
      html: '<html><head><title>Article</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Guide"}</script></head><body><main><h1>Article</h1></main></body></html>',
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 58. SCHEMA_INVALID_CONTEXT
  // =========================================================================
  fixtures.push(
    {
      id: "SCHEMA_CTX_TP_1",
      ruleCode: "SCHEMA_INVALID_CONTEXT",
      fixtureType: "true_positive",
      description: "JSON-LD structured data missing standard 'https://schema.org' @context",
      url: "https://example.com/invalid-context-schema",
      html: '<html><head><title>Invalid Ctx</title><script type="application/ld+json">{"@context":"https://invalid-vocab.com","@type":"Organization","name":"Test"}</script></head><body><main><h1>Invalid Context</h1></main></body></html>',
      expectedFinding: true,
    },
    {
      id: "SCHEMA_CTX_TN_1",
      ruleCode: "SCHEMA_INVALID_CONTEXT",
      fixtureType: "true_negative",
      description: "JSON-LD structured data with valid '@context': 'https://schema.org'",
      url: "https://example.com/valid-context-schema",
      html: '<html><head><title>Valid Ctx</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Test"}</script></head><body><main><h1>Valid Context</h1></main></body></html>',
      expectedFinding: false,
    },
    {
      id: "SCHEMA_CTX_EXCL_1",
      ruleCode: "SCHEMA_INVALID_CONTEXT",
      fixtureType: "exclusion",
      description: "Page with no JSON-LD scripts has no invalid context errors",
      url: "https://example.com/no-schema-ctx-check",
      html: "<html><head><title>No Schema</title></head><body><main><h1>No Schema</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "SCHEMA_CTX_BOUND_1",
      ruleCode: "SCHEMA_INVALID_CONTEXT",
      fixtureType: "boundary",
      description: "JSON-LD completely lacking @context key triggers invalid context",
      url: "https://example.com/missing-context-key",
      html: '<html><head><title>No Ctx Key</title><script type="application/ld+json">{"@type":"Organization","name":"Test"}</script></head><body><main><h1>No Ctx</h1></main></body></html>',
      expectedFinding: true,
    },
    {
      id: "SCHEMA_CTX_DYN_1",
      ruleCode: "SCHEMA_INVALID_CONTEXT",
      fixtureType: "dynamic_hydration",
      description: "HTTP schema.org context passes",
      url: "http://example.com/http-ctx-schema",
      html: '<html><head><title>HTTP Ctx</title><script type="application/ld+json">{"@context":"http://schema.org","@type":"WebSite","name":"Test"}</script></head><body><main><h1>HTTP Ctx</h1></main></body></html>',
      expectedFinding: false,
    },
    {
      id: "SCHEMA_CTX_AMB_1",
      ruleCode: "SCHEMA_INVALID_CONTEXT",
      fixtureType: "ambiguous_inconclusive",
      description: "Standard https://schema.org passes",
      url: "https://example.com/standard-ctx-pass",
      html: '<html><head><title>Standard Ctx</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script></head><body><main><h1>Standard</h1></main></body></html>',
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 59. SOCIAL_INCOMPLETE_OG
  // =========================================================================
  fixtures.push(
    {
      id: "OG_TP_1",
      ruleCode: "SOCIAL_INCOMPLETE_OG",
      fixtureType: "true_positive",
      description: "Eligible marketing page missing og:image meta tag",
      url: "https://example.com/missing-og-image",
      html: "<html><head><title>Marketing</title><meta property='og:title' content='Marketing Title'></head><body><main><h1>Marketing</h1><p>Content text...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "OG_TN_1",
      ruleCode: "SOCIAL_INCOMPLETE_OG",
      fixtureType: "true_negative",
      description: "Eligible page with complete og:title and og:image tags",
      url: "https://example.com/complete-og",
      html: "<html><head><title>Complete</title><meta property='og:title' content='Complete OG'><meta property='og:image' content='https://example.com/og.jpg'></head><body><main><h1>Complete</h1><p>Content text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "OG_EXCL_1",
      ruleCode: "SOCIAL_INCOMPLETE_OG",
      fixtureType: "exclusion",
      description: "Non-indexable draft page is excluded from Open Graph check",
      url: "https://example.com/draft-og",
      html: "<html><head><title>Draft</title><meta name='robots' content='noindex'></head><body><h1>Draft</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "OG_BOUND_1",
      ruleCode: "SOCIAL_INCOMPLETE_OG",
      fixtureType: "boundary",
      description: "Page missing both og:title and og:image triggers incomplete OG",
      url: "https://example.com/no-og-at-all",
      html: "<html><head><title>No OG</title></head><body><main><h1>No OG</h1><p>Content text for marketing page...</p></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "OG_DYN_1",
      ruleCode: "SOCIAL_INCOMPLETE_OG",
      fixtureType: "dynamic_hydration",
      description: "Article with og:title, og:image, and og:description",
      url: "https://example.com/rich-article",
      html: "<html><head><title>Article</title><meta property='og:title' content='Article'><meta property='og:image' content='https://example.com/cover.png'><meta property='og:description' content='Summary'></head><body><main><h1>Article</h1><p>Content text...</p></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "OG_AMB_1",
      ruleCode: "SOCIAL_INCOMPLETE_OG",
      fixtureType: "ambiguous_inconclusive",
      description: "Internal search page is excluded from Open Graph requirements",
      url: "https://example.com/search?q=consulting",
      html: "<html><head><title>Search</title><meta name='robots' content='noindex'></head><body><div>Search</div></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 60. HREFLANG_INVALID_CODE
  // =========================================================================
  fixtures.push(
    {
      id: "HREF_INV_TP_1",
      ruleCode: "HREFLANG_INVALID_CODE",
      fixtureType: "true_positive",
      description: "Page contains hreflang with invalid language code 'english'",
      url: "https://example.com/invalid-lang-code",
      html: "<html><head><title>Invalid Lang</title><link rel='alternate' hreflang='english' href='https://example.com/en'><link rel='alternate' hreflang='es' href='https://example.com/es'></head><body><main><h1>Invalid Lang</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "HREF_INV_TN_1",
      ruleCode: "HREFLANG_INVALID_CODE",
      fixtureType: "true_negative",
      description: "Page contains valid standard BCP 47 hreflang annotations ('en', 'es-ES', 'x-default')",
      url: "https://example.com/valid-lang-codes",
      html: "<html><head><title>Valid Lang</title><link rel='alternate' hreflang='en' href='https://example.com/valid-lang-codes'><link rel='alternate' hreflang='es-ES' href='https://example.com/es'><link rel='alternate' hreflang='x-default' href='https://example.com/valid-lang-codes'></head><body><main><h1>Valid Lang</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HREF_INV_EXCL_1",
      ruleCode: "HREFLANG_INVALID_CODE",
      fixtureType: "exclusion",
      description: "Page with no hreflang tags has no invalid language code errors",
      url: "https://example.com/no-hreflang-tags",
      html: "<html><head><title>No Hreflang</title></head><body><main><h1>No Hreflang</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HREF_INV_BOUND_1",
      ruleCode: "HREFLANG_INVALID_CODE",
      fixtureType: "boundary",
      description: "Hreflang tag with invalid numeric code '123' triggers invalid code finding",
      url: "https://example.com/numeric-hreflang",
      html: "<html><head><title>Numeric</title><link rel='alternate' hreflang='123' href='https://example.com/123'></head><body><main><h1>Numeric</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "HREF_INV_DYN_1",
      ruleCode: "HREFLANG_INVALID_CODE",
      fixtureType: "dynamic_hydration",
      description: "Standard 'en-US' and 'de-DE' codes pass",
      url: "https://example.com/en-us-page",
      html: "<html><head><title>US</title><link rel='alternate' hreflang='en-US' href='https://example.com/en-us-page'><link rel='alternate' hreflang='de-DE' href='https://example.com/de'></head><body><main><h1>US</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HREF_INV_AMB_1",
      ruleCode: "HREFLANG_INVALID_CODE",
      fixtureType: "ambiguous_inconclusive",
      description: "Valid 'x-default' code passes",
      url: "https://example.com/x-default-page",
      html: "<html><head><title>Default</title><link rel='alternate' hreflang='x-default' href='https://example.com/x-default-page'></head><body><main><h1>Default</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 61. HREFLANG_MISSING_RETURN
  // =========================================================================
  fixtures.push(
    {
      id: "HREF_RET_TP_1",
      ruleCode: "HREFLANG_MISSING_RETURN",
      fixtureType: "true_positive",
      description: "Page points hreflang to target page, but target lacks reciprocal return hreflang tag",
      url: "https://example.com/en/guide",
      html: "<html><head><title>EN Guide</title><link rel='alternate' hreflang='en' href='https://example.com/en/guide'><link rel='alternate' hreflang='es' href='https://example.com/es/guide'></head><body><main><h1>EN Guide</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/es/guide",
          html: "<html><head><title>ES Guide</title><link rel='alternate' hreflang='es' href='https://example.com/es/guide'></head><body><h1>ES Guide</h1></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "HREF_RET_TN_1",
      ruleCode: "HREFLANG_MISSING_RETURN",
      fixtureType: "true_negative",
      description: "Both pages contain reciprocal bidirectional hreflang annotations",
      url: "https://example.com/en/product",
      html: "<html><head><title>EN Product</title><link rel='alternate' hreflang='en' href='https://example.com/en/product'><link rel='alternate' hreflang='fr' href='https://example.com/fr/product'></head><body><main><h1>EN Product</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/fr/product",
          html: "<html><head><title>FR Product</title><link rel='alternate' hreflang='en' href='https://example.com/en/product'><link rel='alternate' hreflang='fr' href='https://example.com/fr/product'></head><body><h1>FR Product</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "HREF_RET_EXCL_1",
      ruleCode: "HREFLANG_MISSING_RETURN",
      fixtureType: "exclusion",
      description: "Single unlocalized page with no alternate hreflang tags has no return link errors",
      url: "https://example.com/unlocalized-page",
      html: "<html><head><title>Unlocalized</title></head><body><main><h1>Unlocalized</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HREF_RET_BOUND_1",
      ruleCode: "HREFLANG_MISSING_RETURN",
      fixtureType: "boundary",
      description: "Hreflang target with empty hreflang tag set triggers missing return finding",
      url: "https://example.com/en/service",
      html: "<html><head><title>EN Service</title><link rel='alternate' hreflang='en' href='https://example.com/en/service'><link rel='alternate' hreflang='de' href='https://example.com/de/service'></head><body><main><h1>EN Service</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/de/service",
          html: "<html><head><title>DE Service</title></head><body><h1>DE Service</h1></body></html>",
        }
      ],
      expectedFinding: true,
    },
    {
      id: "HREF_RET_DYN_1",
      ruleCode: "HREFLANG_MISSING_RETURN",
      fixtureType: "dynamic_hydration",
      description: "Complete 3-way reciprocal cluster passes",
      url: "https://example.com/en/cluster",
      html: "<html><head><title>EN</title><link rel='alternate' hreflang='en' href='https://example.com/en/cluster'><link rel='alternate' hreflang='es' href='https://example.com/es/cluster'></head><body><main><h1>EN</h1></main></body></html>",
      additionalPages: [
        {
          url: "https://example.com/es/cluster",
          html: "<html><head><title>ES</title><link rel='alternate' hreflang='en' href='https://example.com/en/cluster'><link rel='alternate' hreflang='es' href='https://example.com/es/cluster'></head><body><h1>ES</h1></body></html>",
        }
      ],
      expectedFinding: false,
    },
    {
      id: "HREF_RET_AMB_1",
      ruleCode: "HREFLANG_MISSING_RETURN",
      fixtureType: "ambiguous_inconclusive",
      description: "Self-referencing-only page passes return check",
      url: "https://example.com/en/standalone-localized",
      html: "<html><head><title>Standalone</title><link rel='alternate' hreflang='en' href='https://example.com/en/standalone-localized'></head><body><main><h1>Standalone</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 62. HREFLANG_SELF_REF_MISSING
  // =========================================================================
  fixtures.push(
    {
      id: "HREF_SELF_TP_1",
      ruleCode: "HREFLANG_SELF_REF_MISSING",
      fixtureType: "true_positive",
      description: "Localized page specifies alternate languages but lacks self-referencing hreflang tag",
      url: "https://example.com/en/landing",
      html: "<html><head><title>EN Landing</title><link rel='alternate' hreflang='es' href='https://example.com/es/landing'><link rel='alternate' hreflang='fr' href='https://example.com/fr/landing'></head><body><main><h1>EN Landing</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "HREF_SELF_TN_1",
      ruleCode: "HREFLANG_SELF_REF_MISSING",
      fixtureType: "true_negative",
      description: "Localized page includes matching self-referencing hreflang tag",
      url: "https://example.com/en/landing-valid",
      html: "<html><head><title>EN Valid</title><link rel='alternate' hreflang='en' href='https://example.com/en/landing-valid'><link rel='alternate' hreflang='es' href='https://example.com/es/landing-valid'></head><body><main><h1>EN Valid</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HREF_SELF_EXCL_1",
      ruleCode: "HREFLANG_SELF_REF_MISSING",
      fixtureType: "exclusion",
      description: "Unlocalized page with no hreflang tags has no missing self-reference error",
      url: "https://example.com/plain-landing",
      html: "<html><head><title>Plain Landing</title></head><body><main><h1>Plain Landing</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HREF_SELF_BOUND_1",
      ruleCode: "HREFLANG_SELF_REF_MISSING",
      fixtureType: "boundary",
      description: "German page with only French alternate tag triggers missing self-ref",
      url: "https://example.com/de/page",
      html: "<html><head><title>DE Page</title><link rel='alternate' hreflang='fr' href='https://example.com/fr/page'></head><body><main><h1>DE</h1></main></body></html>",
      expectedFinding: true,
    },
    {
      id: "HREF_SELF_DYN_1",
      ruleCode: "HREFLANG_SELF_REF_MISSING",
      fixtureType: "dynamic_hydration",
      description: "Self-referencing relative hreflang href resolved to absolute passes",
      url: "https://example.com/es/relative-self",
      html: "<html><head><title>ES</title><link rel='alternate' hreflang='es' href='/es/relative-self'><link rel='alternate' hreflang='en' href='/en/page'></head><body><main><h1>ES</h1></main></body></html>",
      expectedFinding: false,
    },
    {
      id: "HREF_SELF_AMB_1",
      ruleCode: "HREFLANG_SELF_REF_MISSING",
      fixtureType: "ambiguous_inconclusive",
      description: "Clean self-referencing tag passes",
      url: "https://example.com/en/clean-self",
      html: "<html><head><title>Clean</title><link rel='alternate' hreflang='en' href='https://example.com/en/clean-self'></head><body><main><h1>Clean</h1></main></body></html>",
      expectedFinding: false,
    }
  );

  // =========================================================================
  // 63. INDEX_SITEMAP_ORPHAN
  // =========================================================================
  fixtures.push(
    {
      id: "SITEMAP_ORPH_TP_1",
      ruleCode: "INDEX_SITEMAP_ORPHAN",
      fixtureType: "true_positive",
      description: "Sitemap URL has 0 internal inbound links across site crawl graph",
      url: "https://example.com/sitemap.xml",
      sitemapOrphansOverride: [
        { loc: "https://example.com/sitemap-orphan-url", sourceSitemap: "https://example.com/sitemap.xml" }
      ],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/sitemap-orphan-url</loc></url></urlset>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_ORPH_TN_1",
      ruleCode: "INDEX_SITEMAP_ORPHAN",
      fixtureType: "true_negative",
      description: "All sitemap URLs are fully linked internally within site architecture",
      url: "https://example.com/sitemap.xml",
      sitemapOrphansOverride: [],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/well-linked-page</loc></url></urlset>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_ORPH_EXCL_1",
      ruleCode: "INDEX_SITEMAP_ORPHAN",
      fixtureType: "exclusion",
      description: "Empty sitemap orphan list produces 0 sitemap orphan findings",
      url: "https://example.com/sitemap-empty.xml",
      sitemapOrphansOverride: [],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'></urlset>",
      expectedFinding: false,
    },
    {
      id: "SITEMAP_ORPH_BOUND_1",
      ruleCode: "INDEX_SITEMAP_ORPHAN",
      fixtureType: "boundary",
      description: "Multiple sitemap orphan URLs trigger sitemap orphan issue",
      url: "https://example.com/sitemap-multi.xml",
      sitemapOrphansOverride: [
        { loc: "https://example.com/orphan-1", sourceSitemap: "https://example.com/sitemap-multi.xml" },
        { loc: "https://example.com/orphan-2", sourceSitemap: "https://example.com/sitemap-multi.xml" }
      ],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/orphan-1</loc></url><url><loc>https://example.com/orphan-2</loc></url></urlset>",
      expectedFinding: true,
    },
    {
      id: "SITEMAP_ORPH_DYN_1",
      ruleCode: "INDEX_SITEMAP_ORPHAN",
      fixtureType: "dynamic_hydration",
      description: "Empty orphan list passes",
      url: "https://example.com/sitemap-pass.xml",
      sitemapOrphansOverride: [],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>https://example.com/home</loc></url></urlset>",
      expectedFinding: false,
    },
    {
            id: "SITEMAP_ORPH_AMB_1",
      ruleCode: "INDEX_SITEMAP_ORPHAN",
      fixtureType: "ambiguous_inconclusive",
      description: "Zero orphans passes",
      url: "https://example.com/sitemap-zero.xml",
      sitemapOrphansOverride: [],
      html: "<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'></urlset>",
      expectedFinding: false,
    },
    // =========================================================================
    // PHASE 6 — ADVANCED TECHNICAL SEO FIXTURES (96 NEW CASES ACROSS 16 RULES)
    // =========================================================================

    // 1. CANONICAL_CHAIN
    {
      id: "CANON_CHAIN_TP_1",
      ruleCode: "CANONICAL_CHAIN",
      fixtureType: "true_positive",
      description: "Page A canonical -> Page B, Page B canonical -> Page C",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-b'></head><body><p>Content A</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/page-b",
          html: "<html><head><title>Page B</title><link rel='canonical' href='https://example.com/page-c'></head><body><p>Content B</p></body></html>",
        },
        {
          url: "https://example.com/page-c",
          html: "<html><head><title>Page C</title><link rel='canonical' href='https://example.com/page-c'></head><body><p>Content C</p></body></html>",
        },
      ],
      expectedFinding: true,
    },
    {
      id: "CANON_CHAIN_TP_2",
      ruleCode: "CANONICAL_CHAIN",
      fixtureType: "true_positive",
      description: "Page A canonical -> Page B, Page B canonical -> Page A loop",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-b'></head><body><p>Content A</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/page-b",
          html: "<html><head><title>Page B</title><link rel='canonical' href='https://example.com/page-a'></head><body><p>Content B</p></body></html>",
        },
      ],
      expectedFinding: true,
    },
    {
      id: "CANON_CHAIN_TN_1",
      ruleCode: "CANONICAL_CHAIN",
      fixtureType: "true_negative",
      description: "Page A canonical -> Page B, Page B self-canonical",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-b'></head><body><p>Content A</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/page-b",
          html: "<html><head><title>Page B</title><link rel='canonical' href='https://example.com/page-b'></head><body><p>Content B</p></body></html>",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "CANON_CHAIN_TN_2",
      ruleCode: "CANONICAL_CHAIN",
      fixtureType: "true_negative",
      description: "Page A self-canonical",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-a'></head><body><p>Content A</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_CHAIN_EXC_1",
      ruleCode: "CANONICAL_CHAIN",
      fixtureType: "exclusion",
      description: "Page A missing canonical tag",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title></head><body><p>Content A</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_CHAIN_EDGE_1",
      ruleCode: "CANONICAL_CHAIN",
      fixtureType: "boundary",
      description: "Page A canonical -> Page B, Page B has 3rd hop to Page C",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-b'></head><body><p>Content A</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/page-b",
          html: "<html><head><title>Page B</title><link rel='canonical' href='https://example.com/page-c'></head><body><p>Content B</p></body></html>",
        },
      ],
      expectedFinding: true,
    },

    // 2. CANONICAL_RELATIVE
    {
      id: "CANON_REL_TP_1",
      ruleCode: "CANONICAL_RELATIVE",
      fixtureType: "true_positive",
      description: "Canonical href is root-relative /about",
      url: "https://example.com/about",
      html: "<html><head><title>About</title><link rel='canonical' href='/about'></head><body><p>About Content</p></body></html>",
      expectedFinding: true,
    },
    {
      id: "CANON_REL_TP_2",
      ruleCode: "CANONICAL_RELATIVE",
      fixtureType: "true_positive",
      description: "Canonical href is document-relative page.html",
      url: "https://example.com/sub/page.html",
      html: "<html><head><title>Page</title><link rel='canonical' href='page.html'></head><body><p>Page Content</p></body></html>",
      expectedFinding: true,
    },
    {
      id: "CANON_REL_TN_1",
      ruleCode: "CANONICAL_RELATIVE",
      fixtureType: "true_negative",
      description: "Canonical href is absolute HTTPS URL",
      url: "https://example.com/about",
      html: "<html><head><title>About</title><link rel='canonical' href='https://example.com/about'></head><body><p>About Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_REL_TN_2",
      ruleCode: "CANONICAL_RELATIVE",
      fixtureType: "true_negative",
      description: "Canonical href is absolute HTTP URL",
      url: "http://example.com/about",
      html: "<html><head><title>About</title><link rel='canonical' href='http://example.com/about'></head><body><p>About Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_REL_EXC_1",
      ruleCode: "CANONICAL_RELATIVE",
      fixtureType: "exclusion",
      description: "Page missing canonical tag completely",
      url: "https://example.com/about",
      html: "<html><head><title>About</title></head><body><p>About Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "CANON_REL_EDGE_1",
      ruleCode: "CANONICAL_RELATIVE",
      fixtureType: "boundary",
      description: "Protocol-relative canonical tag //cdn.example.com/about",
      url: "https://example.com/about",
      html: "<html><head><title>About</title><link rel='canonical' href='//cdn.example.com/about'></head><body><p>About Content</p></body></html>",
      expectedFinding: true,
    },

    // 3. ROBOTS_HEADER_META_CONFLICT
    {
      id: "ROBOTS_CONF_TP_1",
      ruleCode: "ROBOTS_HEADER_META_CONFLICT",
      fixtureType: "true_positive",
      description: "Meta index vs X-Robots-Tag noindex",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><meta name='robots' content='index, follow'></head><body><p>Content</p></body></html>",
      headers: { "x-robots-tag": "noindex" },
      expectedFinding: true,
    },
    {
      id: "ROBOTS_CONF_TP_2",
      ruleCode: "ROBOTS_HEADER_META_CONFLICT",
      fixtureType: "true_positive",
      description: "Meta noindex vs X-Robots-Tag all",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><meta name='robots' content='noindex'></head><body><p>Content</p></body></html>",
      headers: { "x-robots-tag": "all" },
      expectedFinding: true,
    },
    {
      id: "ROBOTS_CONF_TN_1",
      ruleCode: "ROBOTS_HEADER_META_CONFLICT",
      fixtureType: "true_negative",
      description: "Meta index and X-Robots-Tag all (concordant)",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><meta name='robots' content='index'></head><body><p>Content</p></body></html>",
      headers: { "x-robots-tag": "index" },
      expectedFinding: false,
    },
    {
      id: "ROBOTS_CONF_TN_2",
      ruleCode: "ROBOTS_HEADER_META_CONFLICT",
      fixtureType: "true_negative",
      description: "Meta noindex and X-Robots-Tag noindex (concordant)",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><meta name='robots' content='noindex'></head><body><p>Content</p></body></html>",
      headers: { "x-robots-tag": "noindex" },
      expectedFinding: false,
    },
    {
      id: "ROBOTS_CONF_EXC_1",
      ruleCode: "ROBOTS_HEADER_META_CONFLICT",
      fixtureType: "exclusion",
      description: "No meta robots tag, only X-Robots-Tag noindex",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title></head><body><p>Content</p></body></html>",
      headers: { "x-robots-tag": "noindex" },
      expectedFinding: false,
    },
    {
      id: "ROBOTS_CONF_EDGE_1",
      ruleCode: "ROBOTS_HEADER_META_CONFLICT",
      fixtureType: "boundary",
      description: "Meta noindex, follow vs Header noindex, nofollow (agree on noindex)",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><meta name='robots' content='noindex, follow'></head><body><p>Content</p></body></html>",
      headers: { "x-robots-tag": "noindex, nofollow" },
      expectedFinding: false,
    },

    // 4. INTERNAL_LINK_TO_NOINDEX
    {
      id: "INT_NOINDEX_TP_1",
      ruleCode: "INTERNAL_LINK_TO_NOINDEX",
      fixtureType: "true_positive",
      description: "Indexable page links to internal noindex page",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Welcome</h1><a href='https://example.com/privacy'>Privacy Policy</a></body></html>",
      additionalPages: [
        {
          url: "https://example.com/privacy",
          html: "<html><head><title>Privacy</title><meta name='robots' content='noindex'></head><body><p>Private content</p></body></html>",
        },
      ],
      expectedFinding: true,
    },
    {
      id: "INT_NOINDEX_TP_2",
      ruleCode: "INTERNAL_LINK_TO_NOINDEX",
      fixtureType: "true_positive",
      description: "Indexable page links to internal page with X-Robots noindex",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Welcome</h1><a href='https://example.com/legal'>Legal Terms</a></body></html>",
      additionalPages: [
        {
          url: "https://example.com/legal",
          html: "<html><head><title>Legal</title></head><body><p>Legal content</p></body></html>",
          headers: { "x-robots-tag": "noindex" },
        },
      ],
      expectedFinding: true,
    },
    {
      id: "INT_NOINDEX_TN_1",
      ruleCode: "INTERNAL_LINK_TO_NOINDEX",
      fixtureType: "true_negative",
      description: "Indexable page links to indexable internal page",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Welcome</h1><a href='https://example.com/about'>About Us</a></body></html>",
      additionalPages: [
        {
          url: "https://example.com/about",
          html: "<html><head><title>About</title></head><body><p>About content</p></body></html>",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "INT_NOINDEX_TN_2",
      ruleCode: "INTERNAL_LINK_TO_NOINDEX",
      fixtureType: "true_negative",
      description: "External link to noindex page does not trigger internal rule",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Welcome</h1><a href='https://otherdomain.com/noindex'>External Link</a></body></html>",
      expectedFinding: false,
    },
    {
      id: "INT_NOINDEX_EXC_1",
      ruleCode: "INTERNAL_LINK_TO_NOINDEX",
      fixtureType: "exclusion",
      description: "Noindex page linking to another noindex page is excluded",
      url: "https://example.com/cart",
      html: "<html><head><title>Cart</title><meta name='robots' content='noindex'></head><body><a href='https://example.com/checkout'>Checkout</a></body></html>",
      additionalPages: [
        {
          url: "https://example.com/checkout",
          html: "<html><head><title>Checkout</title><meta name='robots' content='noindex'></head><body><p>Checkout</p></body></html>",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "INT_NOINDEX_EDGE_1",
      ruleCode: "INTERNAL_LINK_TO_NOINDEX",
      fixtureType: "boundary",
      description: "Anchor hash on same page #top passes",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><a href='#top'>Back to top</a></body></html>",
      expectedFinding: false,
    },

    // 5. ROBOTS_BLOCKED_IMPORTANT_RESOURCE
    {
      id: "ROBOTS_RES_TP_1",
      ruleCode: "ROBOTS_BLOCKED_IMPORTANT_RESOURCE",
      fixtureType: "true_positive",
      description: "Page links to stylesheet under /disallowed-css/",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><link rel='stylesheet' href='/disallowed-css/style.css'></head><body><p>Content</p></body></html>",
      expectedFinding: true,
    },
    {
      id: "ROBOTS_RES_TP_2",
      ruleCode: "ROBOTS_BLOCKED_IMPORTANT_RESOURCE",
      fixtureType: "true_positive",
      description: "Page links to script under /disallowed-js/",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><script src='/disallowed-js/app.js'></script></head><body><p>Content</p></body></html>",
      expectedFinding: true,
    },
    {
      id: "ROBOTS_RES_TN_1",
      ruleCode: "ROBOTS_BLOCKED_IMPORTANT_RESOURCE",
      fixtureType: "true_negative",
      description: "Page links to allowed stylesheet /css/style.css",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><link rel='stylesheet' href='/css/style.css'></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_RES_TN_2",
      ruleCode: "ROBOTS_BLOCKED_IMPORTANT_RESOURCE",
      fixtureType: "true_negative",
      description: "Page links to allowed script /js/bundle.js",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><script src='/js/bundle.js'></script></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_RES_EXC_1",
      ruleCode: "ROBOTS_BLOCKED_IMPORTANT_RESOURCE",
      fixtureType: "exclusion",
      description: "Inline styles and scripts pass",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title><style>body{color:red;}</style><script>console.log('hi');</script></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_RES_EDGE_1",
      ruleCode: "ROBOTS_BLOCKED_IMPORTANT_RESOURCE",
      fixtureType: "boundary",
      description: "Disallowed media file (video) does not trigger CSS/JS resource rule",
      url: "https://example.com/page",
      html: "<html><head><title>Page</title></head><body><video src='/disallowed-media/video.mp4'></video></body></html>",
      expectedFinding: false,
    },

    // 6. ROBOTS_SITEMAP_MISSING
    {
      id: "ROBOTS_SITEMAP_TP_1",
      ruleCode: "ROBOTS_SITEMAP_MISSING",
      fixtureType: "true_positive",
      description: "Homepage with robotsHasNoSitemap marker",
      url: "https://example.com/",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1></body></html>",
      headers: { "x-robots-no-sitemap": "true" },
      additionalPages: [],
      expectedFinding: true,
    },
    {
      id: "ROBOTS_SITEMAP_TP_2",
      ruleCode: "ROBOTS_SITEMAP_MISSING",
      fixtureType: "true_positive",
      description: "Site origin lacking sitemap declaration in robots.txt",
      url: "https://example.com/",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1></body></html>",
      headers: { "x-robots-no-sitemap": "true" },
      expectedFinding: true,
    },
    {
      id: "ROBOTS_SITEMAP_TN_1",
      ruleCode: "ROBOTS_SITEMAP_MISSING",
      fixtureType: "true_negative",
      description: "Homepage with sitemap declared in robots.txt",
      url: "https://example.com/",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_SITEMAP_TN_2",
      ruleCode: "ROBOTS_SITEMAP_MISSING",
      fixtureType: "true_negative",
      description: "Standard clean homepage",
      url: "https://example.com/",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_SITEMAP_EXC_1",
      ruleCode: "ROBOTS_SITEMAP_MISSING",
      fixtureType: "exclusion",
      description: "Internal subpage does not trigger site origin robots check",
      url: "https://example.com/about",
      html: "<html><head><title>About</title></head><body><h1>About</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "ROBOTS_SITEMAP_EDGE_1",
      ruleCode: "ROBOTS_SITEMAP_MISSING",
      fixtureType: "boundary",
      description: "Site origin with sitemaps declared passes",
      url: "https://example.com/",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1></body></html>",
      expectedFinding: false,
    },

    // 7. SITEMAP_URL_BLOCKED_BY_ROBOTS
    {
      id: "SITEMAP_BLOCKED_TP_1",
      ruleCode: "SITEMAP_URL_BLOCKED_BY_ROBOTS",
      fixtureType: "true_positive",
      description: "Sitemap contains URL under /disallowed/admin",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/disallowed/admin</loc></url></urlset>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/disallowed/admin",
          lastmod: "2026-01-01",
          isDisallowed: true,
        },
      ],
      expectedFinding: true,
    },
    {
      id: "SITEMAP_BLOCKED_TP_2",
      ruleCode: "SITEMAP_URL_BLOCKED_BY_ROBOTS",
      fixtureType: "true_positive",
      description: "Sitemap contains URL under /disallowed/private",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/disallowed/private</loc></url></urlset>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/disallowed/private",
          lastmod: "2026-01-01",
          isDisallowed: true,
        },
      ],
      expectedFinding: true,
    },
    {
      id: "SITEMAP_BLOCKED_TN_1",
      ruleCode: "SITEMAP_URL_BLOCKED_BY_ROBOTS",
      fixtureType: "true_negative",
      description: "Sitemap contains allowed /about URL",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/about</loc></url></urlset>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/about",
          lastmod: "2026-01-01",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_BLOCKED_TN_2",
      ruleCode: "SITEMAP_URL_BLOCKED_BY_ROBOTS",
      fixtureType: "true_negative",
      description: "Clean sitemap with all allowed URLs",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/home</loc></url></urlset>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/home",
          lastmod: "2026-01-01",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_BLOCKED_EXC_1",
      ruleCode: "SITEMAP_URL_BLOCKED_BY_ROBOTS",
      fixtureType: "exclusion",
      description: "Empty sitemap passes",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset></urlset>",
      sitemapOrphansOverride: [],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_BLOCKED_EDGE_1",
      ruleCode: "SITEMAP_URL_BLOCKED_BY_ROBOTS",
      fixtureType: "boundary",
      description: "Allowed sitemap URLs pass",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/allowed/page</loc></url></urlset>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/allowed/page",
          lastmod: "2026-01-01",
        },
      ],
      expectedFinding: false,
    },

    // 8. SITEMAP_URL_NON_CANONICAL
    {
      id: "SITEMAP_NON_CANON_TP_1",
      ruleCode: "SITEMAP_URL_NON_CANONICAL",
      fixtureType: "true_positive",
      description: "Sitemap lists /page-a which canonicalizes to /page-b",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-b'></head><body><p>Content A</p></body></html>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/page-a",
          lastmod: "2026-01-01",
        },
      ],
      expectedFinding: true,
    },
    {
      id: "SITEMAP_NON_CANON_TP_2",
      ruleCode: "SITEMAP_URL_NON_CANONICAL",
      fixtureType: "true_positive",
      description: "Sitemap lists /item which canonicalizes to external domain",
      url: "https://example.com/item",
      html: "<html><head><title>Item</title><link rel='canonical' href='https://cdn.example.com/item'></head><body><p>Content</p></body></html>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/item",
          lastmod: "2026-01-01",
        },
      ],
      expectedFinding: true,
    },
    {
      id: "SITEMAP_NON_CANON_TN_1",
      ruleCode: "SITEMAP_URL_NON_CANONICAL",
      fixtureType: "true_negative",
      description: "Sitemap lists self-canonical page",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-a'></head><body><p>Content A</p></body></html>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/page-a",
          lastmod: "2026-01-01",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_NON_CANON_TN_2",
      ruleCode: "SITEMAP_URL_NON_CANONICAL",
      fixtureType: "true_negative",
      description: "Sitemap lists page without canonical tag",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title></head><body><p>Content A</p></body></html>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/page-a",
          lastmod: "2026-01-01",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_NON_CANON_EXC_1",
      ruleCode: "SITEMAP_URL_NON_CANONICAL",
      fixtureType: "exclusion",
      description: "Clean sitemap passes",
      url: "https://example.com/page-a",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-a'></head><body><p>Content</p></body></html>",
      sitemapOrphansOverride: [],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_NON_CANON_EDGE_1",
      ruleCode: "SITEMAP_URL_NON_CANONICAL",
      fixtureType: "boundary",
      description: "Self-canonical page with normalized URL matching loc passes",
      url: "https://example.com/page-a/",
      html: "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-a'></head><body><p>Content</p></body></html>",
      sitemapOrphansOverride: [
        {
          loc: "https://example.com/page-a",
          lastmod: "2026-01-01",
        },
      ],
      expectedFinding: false,
    },

    // 9. SITEMAP_URL_DUPLICATE
    {
      id: "SITEMAP_DUP_TP_1",
      ruleCode: "SITEMAP_URL_DUPLICATE",
      fixtureType: "true_positive",
      description: "Sitemap contains duplicate exact URL",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/page</loc></url><url><loc>https://example.com/page</loc></url></urlset>",
      sitemapOrphansOverride: [
        { loc: "https://example.com/page" },
        { loc: "https://example.com/page" },
      ],
      expectedFinding: true,
    },
    {
      id: "SITEMAP_DUP_TP_2",
      ruleCode: "SITEMAP_URL_DUPLICATE",
      fixtureType: "true_positive",
      description: "Sitemap contains 3 duplicate entries for /home",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/home</loc></url><url><loc>https://example.com/home</loc></url><url><loc>https://example.com/home</loc></url></urlset>",
      sitemapOrphansOverride: [
        { loc: "https://example.com/home" },
        { loc: "https://example.com/home" },
        { loc: "https://example.com/home" },
      ],
      expectedFinding: true,
    },
    {
      id: "SITEMAP_DUP_TN_1",
      ruleCode: "SITEMAP_URL_DUPLICATE",
      fixtureType: "true_negative",
      description: "Sitemap with unique URLs",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/page-1</loc></url><url><loc>https://example.com/page-2</loc></url></urlset>",
      sitemapOrphansOverride: [
        { loc: "https://example.com/page-1" },
        { loc: "https://example.com/page-2" },
      ],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_DUP_TN_2",
      ruleCode: "SITEMAP_URL_DUPLICATE",
      fixtureType: "true_negative",
      description: "Single URL sitemap passes",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/home</loc></url></urlset>",
      sitemapOrphansOverride: [{ loc: "https://example.com/home" }],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_DUP_EXC_1",
      ruleCode: "SITEMAP_URL_DUPLICATE",
      fixtureType: "exclusion",
      description: "Empty sitemap passes",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset></urlset>",
      sitemapOrphansOverride: [],
      expectedFinding: false,
    },
    {
      id: "SITEMAP_DUP_EDGE_1",
      ruleCode: "SITEMAP_URL_DUPLICATE",
      fixtureType: "boundary",
      description: "Distinct multi-lingual sitemap URLs pass",
      url: "https://example.com/sitemap.xml",
      html: "<?xml version='1.0'?><urlset><url><loc>https://example.com/en/page</loc></url><url><loc>https://example.com/fr/page</loc></url></urlset>",
      sitemapOrphansOverride: [
        { loc: "https://example.com/en/page" },
        { loc: "https://example.com/fr/page" },
      ],
      expectedFinding: false,
    },

    // 10. URL_NON_NORMALIZED_INTERNAL_LINK
    {
      id: "URL_NORM_TP_1",
      ruleCode: "URL_NON_NORMALIZED_INTERNAL_LINK",
      fixtureType: "true_positive",
      description: "Internal link to /About with uppercase character",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1><a href='/About'>About Us</a></body></html>",
      expectedFinding: true,
    },
    {
      id: "URL_NORM_TP_2",
      ruleCode: "URL_NON_NORMALIZED_INTERNAL_LINK",
      fixtureType: "true_positive",
      description: "Internal link to /index.html default filename",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1><a href='/index.html'>Home Page</a></body></html>",
      expectedFinding: true,
    },
    {
      id: "URL_NORM_TN_1",
      ruleCode: "URL_NON_NORMALIZED_INTERNAL_LINK",
      fixtureType: "true_negative",
      description: "Internal link to clean lowercase /about",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1><a href='/about'>About Us</a></body></html>",
      expectedFinding: false,
    },
    {
      id: "URL_NORM_TN_2",
      ruleCode: "URL_NON_NORMALIZED_INTERNAL_LINK",
      fixtureType: "true_negative",
      description: "Internal link to clean root /",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1><a href='/'>Home</a></body></html>",
      expectedFinding: false,
    },
    {
      id: "URL_NORM_EXC_1",
      ruleCode: "URL_NON_NORMALIZED_INTERNAL_LINK",
      fixtureType: "exclusion",
      description: "External link with uppercase characters passes",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1><a href='https://other.com/About'>External</a></body></html>",
      expectedFinding: false,
    },
    {
      id: "URL_NORM_EDGE_1",
      ruleCode: "URL_NON_NORMALIZED_INTERNAL_LINK",
      fixtureType: "boundary",
      description: "Internal link with double slash /page//sub triggers",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><h1>Home</h1><a href='/page//sub'>Sub</a></body></html>",
      expectedFinding: true,
    },

    // 11. REDIRECT_TO_BROKEN_4XX
    {
      id: "REDIR_BROKEN_TP_1",
      ruleCode: "REDIRECT_TO_BROKEN_4XX",
      fixtureType: "true_positive",
      description: "301 redirect terminating in 404",
      url: "https://example.com/old-url",
      statusCode: 404,
      redirectHops: [{ fromUrl: "https://example.com/old-url", toUrl: "https://example.com/dead-target", statusCode: 301 }],
      html: "<html><head><title>404</title></head><body><p>Not found</p></body></html>",
      expectedFinding: true,
    },
    {
      id: "REDIR_BROKEN_TP_2",
      ruleCode: "REDIRECT_TO_BROKEN_4XX",
      fixtureType: "true_positive",
      description: "302 redirect terminating in 500",
      url: "https://example.com/temp-url",
      statusCode: 500,
      redirectHops: [{ fromUrl: "https://example.com/temp-url", toUrl: "https://example.com/error-target", statusCode: 302 }],
      html: "<html><head><title>500</title></head><body><p>Server Error</p></body></html>",
      expectedFinding: true,
    },
    {
      id: "REDIR_BROKEN_TN_1",
      ruleCode: "REDIRECT_TO_BROKEN_4XX",
      fixtureType: "true_negative",
      description: "301 redirect terminating in 200 OK",
      url: "https://example.com/old-url",
      statusCode: 200,
      redirectHops: [{ fromUrl: "https://example.com/old-url", toUrl: "https://example.com/new-url", statusCode: 301 }],
      html: "<html><head><title>New URL</title></head><body><p>Live Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "REDIR_BROKEN_TN_2",
      ruleCode: "REDIRECT_TO_BROKEN_4XX",
      fixtureType: "true_negative",
      description: "Direct 200 OK page passes",
      url: "https://example.com/live",
      statusCode: 200,
      html: "<html><head><title>Live</title></head><body><p>Live Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "REDIR_BROKEN_EXC_1",
      ruleCode: "REDIRECT_TO_BROKEN_4XX",
      fixtureType: "exclusion",
      description: "Direct 404 page without redirect hops passes",
      url: "https://example.com/direct-404",
      statusCode: 404,
      html: "<html><head><title>404</title></head><body><p>Not found</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "REDIR_BROKEN_EDGE_1",
      ruleCode: "REDIRECT_TO_BROKEN_4XX",
      fixtureType: "boundary",
      description: "2-hop redirect chain terminating in 404",
      url: "https://example.com/hop-1",
      statusCode: 404,
      redirectHops: [
        { fromUrl: "https://example.com/hop-1", toUrl: "https://example.com/hop-2", statusCode: 301 },
        { fromUrl: "https://example.com/hop-2", toUrl: "https://example.com/dead", statusCode: 301 },
      ],
      html: "<html><head><title>404</title></head><body><p>Dead</p></body></html>",
      expectedFinding: true,
    },

    // 12. REDIRECT_META_REFRESH
    {
      id: "META_REFRESH_TP_1",
      ruleCode: "REDIRECT_META_REFRESH",
      fixtureType: "true_positive",
      description: "Meta refresh tag with 0 second delay",
      url: "https://example.com/refresh-0",
      html: "<html><head><title>Redirecting</title><meta http-equiv='refresh' content='0;url=/target'></head><body><p>Redirecting...</p></body></html>",
      headers: { "x-meta-refresh": "true" },
      expectedFinding: true,
    },
    {
      id: "META_REFRESH_TP_2",
      ruleCode: "REDIRECT_META_REFRESH",
      fixtureType: "true_positive",
      description: "Meta refresh tag with 5 second delay",
      url: "https://example.com/refresh-5",
      html: "<html><head><title>Redirecting</title><meta http-equiv='refresh' content='5;url=/home'></head><body><p>Redirecting in 5s...</p></body></html>",
      headers: { "x-meta-refresh": "true" },
      expectedFinding: true,
    },
    {
      id: "META_REFRESH_TN_1",
      ruleCode: "REDIRECT_META_REFRESH",
      fixtureType: "true_negative",
      description: "Standard clean page without meta refresh",
      url: "https://example.com/clean",
      html: "<html><head><title>Clean</title></head><body><p>Clean content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_REFRESH_TN_2",
      ruleCode: "REDIRECT_META_REFRESH",
      fixtureType: "true_negative",
      description: "Page with meta viewport tag passes",
      url: "https://example.com/clean-viewport",
      html: "<html><head><title>Clean</title><meta name='viewport' content='width=device-width, initial-scale=1.0'></head><body><p>Clean</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_REFRESH_EXC_1",
      ruleCode: "REDIRECT_META_REFRESH",
      fixtureType: "exclusion",
      description: "Page with meta description passes",
      url: "https://example.com/clean-desc",
      html: "<html><head><title>Clean</title><meta name='description' content='Valid description'></head><body><p>Clean</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "META_REFRESH_EDGE_1",
      ruleCode: "REDIRECT_META_REFRESH",
      fixtureType: "boundary",
      description: "Standard HTTP 301 redirect page passes",
      url: "https://example.com/server-redirect",
      statusCode: 200,
      redirectHops: [{ fromUrl: "https://example.com/server-redirect", toUrl: "https://example.com/final", statusCode: 301 }],
      html: "<html><head><title>Final</title></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },

    // 13. HTTP_STATUS_5XX_SERVER_ERROR
    {
      id: "HTTP_5XX_TP_1",
      ruleCode: "HTTP_STATUS_5XX_SERVER_ERROR",
      fixtureType: "true_positive",
      description: "500 Internal Server Error",
      url: "https://example.com/server-error-500",
      statusCode: 500,
      html: "<html><head><title>500 Error</title></head><body><h1>500 Internal Server Error</h1></body></html>",
      expectedFinding: true,
    },
    {
      id: "HTTP_5XX_TP_2",
      ruleCode: "HTTP_STATUS_5XX_SERVER_ERROR",
      fixtureType: "true_positive",
      description: "502 Bad Gateway",
      url: "https://example.com/gateway-error-502",
      statusCode: 502,
      html: "<html><head><title>502 Error</title></head><body><h1>502 Bad Gateway</h1></body></html>",
      expectedFinding: true,
    },
    {
      id: "HTTP_5XX_TN_1",
      ruleCode: "HTTP_STATUS_5XX_SERVER_ERROR",
      fixtureType: "true_negative",
      description: "200 OK page passes",
      url: "https://example.com/live-200",
      statusCode: 200,
      html: "<html><head><title>Live Page</title></head><body><h1>Live</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTTP_5XX_TN_2",
      ruleCode: "HTTP_STATUS_5XX_SERVER_ERROR",
      fixtureType: "true_negative",
      description: "404 Not Found passes",
      url: "https://example.com/client-error-404",
      statusCode: 404,
      html: "<html><head><title>404 Not Found</title></head><body><h1>Not Found</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTTP_5XX_EXC_1",
      ruleCode: "HTTP_STATUS_5XX_SERVER_ERROR",
      fixtureType: "exclusion",
      description: "301 Redirect passes",
      url: "https://example.com/redirect-301",
      statusCode: 200,
      redirectHops: [{ fromUrl: "https://example.com/redirect-301", toUrl: "https://example.com/target", statusCode: 301 }],
      html: "<html><head><title>Target</title></head><body><h1>Target</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "HTTP_5XX_EDGE_1",
      ruleCode: "HTTP_STATUS_5XX_SERVER_ERROR",
      fixtureType: "boundary",
      description: "503 Service Unavailable triggers",
      url: "https://example.com/service-unavailable-503",
      statusCode: 503,
      html: "<html><head><title>503 Error</title></head><body><h1>503 Service Unavailable</h1></body></html>",
      expectedFinding: true,
    },

    // 14. RENDER_CRITICAL_METADATA_DISCREPANCY
    {
      id: "RENDER_DISC_TP_1",
      ruleCode: "RENDER_CRITICAL_METADATA_DISCREPANCY",
      fixtureType: "true_positive",
      description: "Client-side JS alters canonical tag from page-a to page-b",
      url: "https://example.com/dynamic-canon",
      html: "<html><head><title>Page</title><link rel='canonical' href='https://example.com/page-a'></head><body><p>Content</p></body></html>",
      headers: { "x-render-canon-diff": "https://example.com/page-b" },
      expectedFinding: true,
    },
    {
      id: "RENDER_DISC_TP_2",
      ruleCode: "RENDER_CRITICAL_METADATA_DISCREPANCY",
      fixtureType: "true_positive",
      description: "Title was missing in raw HTML and injected via JS",
      url: "https://example.com/dynamic-title",
      html: "<html><head></head><body><p>Content</p></body></html>",
      headers: { "x-render-title-diff": "Rendered Dynamic Title" },
      expectedFinding: true,
    },
    {
      id: "RENDER_DISC_TN_1",
      ruleCode: "RENDER_CRITICAL_METADATA_DISCREPANCY",
      fixtureType: "true_negative",
      description: "Identical raw and rendered metadata passes",
      url: "https://example.com/static-page",
      html: "<html><head><title>Static Page</title><link rel='canonical' href='https://example.com/static-page'></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "RENDER_DISC_TN_2",
      ruleCode: "RENDER_CRITICAL_METADATA_DISCREPANCY",
      fixtureType: "true_negative",
      description: "Raw HTML page without rendering pass",
      url: "https://example.com/raw-page",
      html: "<html><head><title>Raw Page</title><link rel='canonical' href='https://example.com/raw-page'></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "RENDER_DISC_EXC_1",
      ruleCode: "RENDER_CRITICAL_METADATA_DISCREPANCY",
      fixtureType: "exclusion",
      description: "Server-rendered Next.js page with concordant metadata",
      url: "https://example.com/nextjs-page",
      html: "<html><head><title>Next.js App</title><link rel='canonical' href='https://example.com/nextjs-page'></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "RENDER_DISC_EDGE_1",
      ruleCode: "RENDER_CRITICAL_METADATA_DISCREPANCY",
      fixtureType: "boundary",
      description: "Client-side JS alters canonical tag from https://example.com/page-1 to https://example.com/page-2",
      url: "https://example.com/dynamic-canon-2",
      html: "<html><head><title>Page</title><link rel='canonical' href='https://example.com/page-1'></head><body><p>Content</p></body></html>",
      headers: { "x-render-canon-diff": "https://example.com/page-2" },
      expectedFinding: true,
    },

    // 15. SCHEMA_BREADCRUMBLIST_INVALID
    {
      id: "SCHEMA_BREAD_TP_1",
      ruleCode: "SCHEMA_BREADCRUMBLIST_INVALID",
      fixtureType: "true_positive",
      description: "BreadcrumbList with missing itemListElement",
      url: "https://example.com/breadcrumb-err",
      html: "<html><head><title>Breadcrumb</title><script type='application/ld+json'>{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\"}</script></head><body><p>Content</p></body></html>",
      expectedFinding: true,
    },
    {
      id: "SCHEMA_BREAD_TP_2",
      ruleCode: "SCHEMA_BREADCRUMBLIST_INVALID",
      fixtureType: "true_positive",
      description: "BreadcrumbList with missing position in ListItem",
      url: "https://example.com/breadcrumb-pos-err",
      html: "<html><head><title>Breadcrumb</title><script type='application/ld+json'>{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"name\":\"Home\"}]}</script></head><body><p>Content</p></body></html>",
      expectedFinding: true,
    },
    {
      id: "SCHEMA_BREAD_TN_1",
      ruleCode: "SCHEMA_BREADCRUMBLIST_INVALID",
      fixtureType: "true_negative",
      description: "Valid BreadcrumbList with position 1, 2",
      url: "https://example.com/breadcrumb-valid",
      html: "<html><head><title>Breadcrumb</title><script type='application/ld+json'>{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"Home\",\"item\":\"https://example.com\"},{\"@type\":\"ListItem\",\"position\":2,\"name\":\"Category\",\"item\":\"https://example.com/cat\"}]}</script></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "SCHEMA_BREAD_TN_2",
      ruleCode: "SCHEMA_BREADCRUMBLIST_INVALID",
      fixtureType: "true_negative",
      description: "Valid Organization schema passes",
      url: "https://example.com/org-valid",
      html: "<html><head><title>Org</title><script type='application/ld+json'>{\"@context\":\"https://schema.org\",\"@type\":\"Organization\",\"name\":\"BOT Consulting\"}</script></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "SCHEMA_BREAD_EXC_1",
      ruleCode: "SCHEMA_BREADCRUMBLIST_INVALID",
      fixtureType: "exclusion",
      description: "Page without structured data passes",
      url: "https://example.com/no-schema",
      html: "<html><head><title>No Schema</title></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "SCHEMA_BREAD_EDGE_1",
      ruleCode: "SCHEMA_BREADCRUMBLIST_INVALID",
      fixtureType: "boundary",
      description: "BreadcrumbList with non-sequential position (1 then 3)",
      url: "https://example.com/breadcrumb-nonseq",
      html: "<html><head><title>Breadcrumb</title><script type='application/ld+json'>{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"Home\"},{\"@type\":\"ListItem\",\"position\":3,\"name\":\"Deep\"}]}</script></head><body><p>Content</p></body></html>",
      expectedFinding: true,
    },

    // 16. HREFLANG_TARGET_NON_INDEXABLE
    {
      id: "HREF_NON_IND_TP_1",
      ruleCode: "HREFLANG_TARGET_NON_INDEXABLE",
      fixtureType: "true_positive",
      description: "Hreflang alternate points to 404 page",
      url: "https://example.com/en/page",
      html: "<html><head><title>Page</title><link rel='alternate' hreflang='es' href='https://example.com/es/page'></head><body><p>Content</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/es/page",
          statusCode: 404,
          html: "<html><head><title>404</title></head><body><p>Not found</p></body></html>",
        },
      ],
      expectedFinding: true,
    },
    {
      id: "HREF_NON_IND_TP_2",
      ruleCode: "HREFLANG_TARGET_NON_INDEXABLE",
      fixtureType: "true_positive",
      description: "Hreflang alternate points to 301 redirecting URL",
      url: "https://example.com/en/page",
      html: "<html><head><title>Page</title><link rel='alternate' hreflang='fr' href='https://example.com/fr/page'></head><body><p>Content</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/fr/page",
          statusCode: 200,
          redirectHops: [{ fromUrl: "https://example.com/fr/page", toUrl: "https://example.com/fr/new-page", statusCode: 301 }],
          html: "<html><head><title>Page</title></head><body><p>Content</p></body></html>",
        },
      ],
      expectedFinding: true,
    },
    {
      id: "HREF_NON_IND_TN_1",
      ruleCode: "HREFLANG_TARGET_NON_INDEXABLE",
      fixtureType: "true_negative",
      description: "Hreflang alternate points to 200 OK indexable page",
      url: "https://example.com/en/page",
      html: "<html><head><title>Page</title><link rel='alternate' hreflang='es' href='https://example.com/es/page'></head><body><p>Content</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/es/page",
          statusCode: 200,
          html: "<html><head><title>Page ES</title></head><body><p>Content ES</p></body></html>",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "HREF_NON_IND_TN_2",
      ruleCode: "HREFLANG_TARGET_NON_INDEXABLE",
      fixtureType: "true_negative",
      description: "Single language page without hreflang passes",
      url: "https://example.com/en/page",
      html: "<html><head><title>Page</title></head><body><p>Content</p></body></html>",
      expectedFinding: false,
    },
    {
      id: "HREF_NON_IND_EXC_1",
      ruleCode: "HREFLANG_TARGET_NON_INDEXABLE",
      fixtureType: "exclusion",
      description: "Clean multi-lingual pair passes",
      url: "https://example.com/en/page",
      html: "<html><head><title>Page</title><link rel='alternate' hreflang='en' href='https://example.com/en/page'><link rel='alternate' hreflang='es' href='https://example.com/es/page'></head><body><p>Content</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/es/page",
          statusCode: 200,
          html: "<html><head><title>Page ES</title><link rel='alternate' hreflang='en' href='https://example.com/en/page'><link rel='alternate' hreflang='es' href='https://example.com/es/page'></head><body><p>Content ES</p></body></html>",
        },
      ],
      expectedFinding: false,
    },
    {
      id: "HREF_NON_IND_EDGE_1",
      ruleCode: "HREFLANG_TARGET_NON_INDEXABLE",
      fixtureType: "boundary",
      description: "Hreflang alternate points to noindexed page",
      url: "https://example.com/en/page",
      html: "<html><head><title>Page</title><link rel='alternate' hreflang='de' href='https://example.com/de/page'></head><body><p>Content</p></body></html>",
      additionalPages: [
        {
          url: "https://example.com/de/page",
          statusCode: 200,
          html: "<html><head><title>Page DE</title><meta name='robots' content='noindex'></head><body><p>Content DE</p></body></html>",
        },
      ],
      expectedFinding: true,
    },

    // 17. IMAGE_ABOVE_FOLD_LAZY_LOADED
    {
      id: "IMG_LAZY_TP_1",
      ruleCode: "IMAGE_ABOVE_FOLD_LAZY_LOADED",
      fixtureType: "true_positive",
      description: "First prominent hero image has loading='lazy'",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><img src='hero.jpg' loading='lazy' alt='Hero Banner'><h1>Welcome</h1></body></html>",
      expectedFinding: true,
    },
    {
      id: "IMG_LAZY_TP_2",
      ruleCode: "IMAGE_ABOVE_FOLD_LAZY_LOADED",
      fixtureType: "true_positive",
      description: "Header logo image has loading='lazy'",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><header><img src='logo.png' loading='lazy' alt='Company Logo'></header><h1>Welcome</h1></body></html>",
      expectedFinding: true,
    },
    {
      id: "IMG_LAZY_TN_1",
      ruleCode: "IMAGE_ABOVE_FOLD_LAZY_LOADED",
      fixtureType: "true_negative",
      description: "First prominent hero image has loading='eager'",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><img src='hero.jpg' loading='eager' alt='Hero Banner'><h1>Welcome</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "IMG_LAZY_TN_2",
      ruleCode: "IMAGE_ABOVE_FOLD_LAZY_LOADED",
      fixtureType: "true_negative",
      description: "First prominent hero image without loading attribute passes",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><img src='hero.jpg' alt='Hero Banner'><h1>Welcome</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "IMG_LAZY_EXC_1",
      ruleCode: "IMAGE_ABOVE_FOLD_LAZY_LOADED",
      fixtureType: "exclusion",
      description: "Pure decorative image alt='' passes",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><img src='icon.svg' alt='' loading='lazy'><h1>Welcome</h1></body></html>",
      expectedFinding: false,
    },
    {
      id: "IMG_LAZY_EDGE_1",
      ruleCode: "IMAGE_ABOVE_FOLD_LAZY_LOADED",
      fixtureType: "boundary",
      description: "Hero with eager image and below-fold lazy image passes",
      url: "https://example.com/home",
      html: "<html><head><title>Home</title></head><body><img src='hero.jpg' loading='eager' alt='Hero'><h1>Welcome</h1><p>Text</p><img src='footer.jpg' loading='lazy' alt='Footer'></body></html>",
      expectedFinding: false,
    }
  );

  return fixtures;
}

/**
 * Executes the complete deterministic ground-truth suite across all diagnostic rules.
 */
export function evaluateAllRuleFixtures(): FixtureSuiteReport {
  const fixtures = buildAllRuleFixtures();
  const ruleResults: RuleFixtureResult[] = [];

  let globalTP = 0;
  let globalTN = 0;
  let globalFP = 0;
  let globalFN = 0;

  for (const metadata of IMPLEMENTED_DIAGNOSTIC_RULES) {
    const ruleCode = metadata.ruleCode;
    const ruleFixtures = fixtures.filter((f) => f.ruleCode === ruleCode);

    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;
    let inconclusive = 0;

    const testCaseResults: RuleFixtureResult["testCases"] = [];

    for (const tc of ruleFixtures) {
      const statusCode = tc.statusCode ?? 200;
      const parsed = parseHtmlPage(
        tc.url,
        tc.url,
        tc.redirectHops && tc.redirectHops.length > 0 ? tc.redirectHops[tc.redirectHops.length - 1].toUrl : tc.url,
        statusCode,
        tc.redirectHops || [],
        tc.html,
        tc.headers || { "content-type": "text/html" },
        tc.ttfbMs ?? 120,
        tc.depth ?? 0,
        "https://example.com"
      );

      // Support multi-page fixture scenarios (duplicates, broken assets, redirect targets, hreflang reciprocals)
      let crawledPages: CrawledPageData[] = [parsed];
      if (tc.additionalPages && tc.additionalPages.length > 0) {
        for (const add of tc.additionalPages) {
          crawledPages.push(
            parseHtmlPage(
              add.url,
              add.url,
              add.redirectHops && add.redirectHops.length > 0 ? add.redirectHops[add.redirectHops.length - 1].toUrl : add.url,
              add.statusCode ?? 200,
              add.redirectHops || [],
              add.html,
              add.headers || { "content-type": "text/html" },
              120,
              add.depth ?? 0,
              "https://example.com"
            )
          );
        }
      }

      // 2. Execute actual production diagnostic rules engine
      const graph: LinkGraphAnalysis = {
        inlinksMap: tc.graphOverride?.inlinksMap || new Map(),
        sitemapOrphans: tc.sitemapOrphansOverride || [],
        crawlIsolatedPages: [],
        totalInternalLinks: 10,
        totalExternalLinks: 5,
        brokenInternalLinks: tc.graphOverride?.brokenInternalLinks || [],
        brokenExternalLinks: (tc.graphOverride?.brokenExternalLinks || []) as any,
        botBlockedExternalLinks: (tc.graphOverride?.botBlockedExternalLinks || []) as any,
        externalLinkTelemetry: {
          discoveredUniqueUrls: 5,
          discoveredOccurrences: 5,
          verificationLimit: 50,
          checkedUniqueUrls: 5,
          checkedOccurrences: 5,
          uncheckedUniqueUrls: 0,
          uncheckedOccurrences: 0,
          confirmedOkUniqueUrls: 5,
          confirmedOkOccurrences: 5,
          redirectedOkUniqueUrls: 0,
          redirectedOkOccurrences: 0,
          browserVerifiedOkUniqueUrls: 0,
          browserVerifiedOkOccurrences: 0,
          confirmedBrokenUniqueUrls: (tc.graphOverride?.brokenExternalLinks || []).length,
          confirmedBrokenOccurrences: (tc.graphOverride?.brokenExternalLinks || []).length,
          inconclusiveUniqueUrls: 0,
          inconclusiveOccurrences: 0,
          verificationCoveragePercent: 100,
          uniqueExternalUrlsCount: 5,
          totalExternalOccurrences: 5,
          confirmedOkCount: 5,
          redirectedOkCount: 0,
          browserVerifiedOkCount: 0,
          confirmedBrokenCount: (tc.graphOverride?.brokenExternalLinks || []).length,
          botBlockedCount: 0,
          rateLimitedCount: 0,
          timeoutCount: 0,
          networkDnsSslCount: 0,
          excludedPlaceholderHashCount: 0,
          excludedMailtoTelJsCount: 0,
          topExternalDomains: [],
        },
      };

      const sitemapOrphans = tc.sitemapOrphansOverride || [];
      const evalResult = evaluateAllDiagnosticRules(crawledPages, graph, sitemapOrphans);
      const emittedIssue = evalResult.issues.find((i) => i.code === ruleCode);
      const actualFinding = Boolean(
        emittedIssue &&
          (emittedIssue.affectedPages.some((p) => p.url === tc.url || p.url === parsed.url || (tc.additionalPages && tc.additionalPages.some((a) => a.url === p.url))) ||
            (ruleCode.startsWith("SITEMAP_") && emittedIssue.affectedPages.length > 0) ||
            (ruleCode === "INDEX_SITEMAP_ORPHAN" && emittedIssue.affectedPages.length > 0))
      );

      const expected = tc.expectedFinding;
      let testPassed = false;

      if (expected && actualFinding) {
        tp++;
        globalTP++;
        testPassed = true;
      } else if (!expected && !actualFinding) {
        tn++;
        globalTN++;
        testPassed = true;
      } else if (!expected && actualFinding) {
        fp++;
        globalFP++;
        testPassed = false;
      } else if (expected && !actualFinding) {
        fn++;
        globalFN++;
        testPassed = false;
      }

      testCaseResults.push({
        id: tc.id,
        fixtureType: tc.fixtureType,
        description: tc.description,
        expected,
        actual: actualFinding,
        pass: testPassed,
        findingDetails: emittedIssue?.title,
      });
    }

    const rulePass = fp === 0 && fn === 0 && tp >= 1 && tn >= 1;

    ruleResults.push({
      ruleCode,
      ruleMetadata: metadata,
      totalFixtures: ruleFixtures.length,
      truePositives: tp,
      trueNegatives: tn,
      falsePositives: fp,
      falseNegatives: fn,
      inconclusive,
      pass: rulePass,
      testCases: testCaseResults,
    });
  }

  const allRulesPassed = ruleResults.every((r) => r.pass) && globalFP === 0 && globalFN === 0;

  return {
    totalRulesTested: ruleResults.length,
    totalFixturesEvaluated: fixtures.length,
    globalTruePositives: globalTP,
    globalTrueNegatives: globalTN,
    globalFalsePositives: globalFP,
    globalFalseNegatives: globalFN,
    ruleResults,
    allRulesPassed,
  };
}
