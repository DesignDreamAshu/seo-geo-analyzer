import { describe, it, expect } from "vitest";
import {
  extractProjectKnowledgeProfile,
} from "../knowledge-profile/extractor";
import {
  globalKnowledgeGovernance,
} from "../knowledge-profile/governance";
import {
  discoverQuestions,
} from "../prompts/question-discovery";
import {
  generatePromptCandidates,
} from "../prompts/prompt-generator";
import {
  deduplicateAndClusterPrompts,
} from "../prompts/deduplication";
import {
  selectMonitoringPrompts,
} from "../prompts/priority-selector";
import {
  generateProjectKnowledgeAndPromptUniverse,
} from "../engine";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import type { CrawledPageData } from "../../crawler/types";

describe("Phase 28C: Project Knowledge Profile & Prompt Discovery Engine", () => {
  const samplePages: CrawledPageData[] = [
    {
      url: "https://www.botconsulting.io/",
      normalizedUrl: "https://www.botconsulting.io/",
      finalUrl: "https://www.botconsulting.io/",
      statusCode: 200,
      redirectHops: 0,
      html: "<html><head><title>BOT Consulting | Enterprise ServiceNow & AI Solutions</title><meta name='description' content='BOT Consulting empowers enterprises with certified ServiceNow consulting, Snowflake architectures, and custom AI agents.'></head><body><h1>Enterprise AI & Cloud Consulting</h1></body></html>",
      title: "BOT Consulting | Enterprise ServiceNow & AI Solutions",
      metaDescription: "BOT Consulting empowers enterprises with certified ServiceNow consulting, Snowflake architectures, and custom AI agents.",
      h1: "Enterprise AI & Cloud Consulting",
      headings: ["How does ServiceNow modernize IT workflows?", "Why choose certified consulting partners?"],
      canonicalUrl: "https://www.botconsulting.io/",
      robotsDirectives: { noindex: false, nofollow: false, none: false, noarchive: false, nosnippet: false },
      links: [],
      images: [],
      resources: [],
      crawledAt: new Date().toISOString(),
      sourceMode: "raw_http",
      authoritativeSource: "raw",
      renderEngine: "raw_http",
      responseTimeMs: 250,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "BOT Consulting",
          url: "https://www.botconsulting.io",
        },
      ],
      openGraph: {
        siteName: "BOT Consulting",
        title: "BOT Consulting | Enterprise Solutions",
        description: "Enterprise ServiceNow and AI solutions",
      },
    },
    {
      url: "https://www.botconsulting.io/solution-service-now",
      normalizedUrl: "https://www.botconsulting.io/solution-service-now",
      finalUrl: "https://www.botconsulting.io/solution-service-now",
      statusCode: 200,
      redirectHops: 0,
      html: "<html><head><title>ServiceNow Consulting & Implementation | BOT Consulting</title></head><body><h1>ServiceNow Enterprise Consulting</h1><p>We deliver certified ServiceNow ITSM and HRSD implementations for Higher Education and Financial Services.</p></body></html>",
      title: "ServiceNow Consulting & Implementation | BOT Consulting",
      h1: "ServiceNow Enterprise Consulting",
      metaDescription: "Certified ServiceNow implementation services for modern enterprise workflows.",
      headings: ["What is the timeline for ServiceNow implementation?", "How does ServiceNow automate workflows?"],
      canonicalUrl: "https://www.botconsulting.io/solution-service-now",
      robotsDirectives: { noindex: false, nofollow: false, none: false, noarchive: false, nosnippet: false },
      links: [],
      images: [],
      resources: [],
      crawledAt: new Date().toISOString(),
      sourceMode: "raw_http",
      authoritativeSource: "raw",
      renderEngine: "raw_http",
      responseTimeMs: 220,
    },
    {
      url: "https://www.botconsulting.io/cloudsmith",
      normalizedUrl: "https://www.botconsulting.io/cloudsmith",
      finalUrl: "https://www.botconsulting.io/cloudsmith",
      statusCode: 200,
      redirectHops: 0,
      html: "<html><head><title>Cloudsmith AI Automation Platform | BOT Consulting</title></head><body><h1>Cloudsmith AI Automation Platform</h1></body></html>",
      title: "Cloudsmith AI Automation Platform | BOT Consulting",
      h1: "Cloudsmith AI Automation Platform",
      metaDescription: "Autonomous enterprise agent orchestration with Cloudsmith AI.",
      canonicalUrl: "https://www.botconsulting.io/cloudsmith",
      robotsDirectives: { noindex: false, nofollow: false, none: false, noarchive: false, nosnippet: false },
      links: [],
      images: [],
      resources: [],
      crawledAt: new Date().toISOString(),
      sourceMode: "raw_http",
      authoritativeSource: "raw",
      renderEngine: "raw_http",
      responseTimeMs: 210,
    },
  ];

  it("1. Extracts Brand Identity, Offerings, and Topic Maps with Evidence Provenance", () => {
    const profile = extractProjectKnowledgeProfile("proj_test", "botconsulting.io", samplePages);

    expect(profile.brand.name).toBe("BOT Consulting");
    expect(profile.brand.domain).toBe("botconsulting.io");
    expect(profile.offerings.length).toBeGreaterThanOrEqual(2);

    const snOffering = profile.offerings.find((o) => o.name.includes("ServiceNow"));
    expect(snOffering).toBeDefined();
    expect(snOffering?.importance).toBe("PRIMARY");
    expect(snOffering?.provenance[0].sourceType).toBe("WEBSITE_EXPLICIT");

    const snTopic = profile.topics.find((t) => t.name === "ServiceNow");
    expect(snTopic).toBeDefined();
    expect(snTopic?.classification).toBe("CORE");
    expect(profile.completenessScore).toBeGreaterThanOrEqual(70);
  });

  it("2. Discovers Authentic Questions from Content and Problem Mappings", () => {
    const profile = extractProjectKnowledgeProfile("proj_test", "botconsulting.io", samplePages);
    const questions = discoverQuestions(samplePages, profile);

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.questionText.includes("timeline for ServiceNow"))).toBe(true);
    expect(questions.some((q) => q.sourceType === "OBSERVED_WEBSITE_QUESTION")).toBe(true);
  });

  it("3. Generates Natural, Neutral, Evidence-Constrained Prompt Candidates", () => {
    const profile = extractProjectKnowledgeProfile("proj_test", "botconsulting.io", samplePages);
    const questions = discoverQuestions(samplePages, profile);
    const candidates = generatePromptCandidates(profile, questions);

    expect(candidates.length).toBeGreaterThanOrEqual(8);

    // Verify unbranded discovery prompts NEVER include brand name
    const unbranded = candidates.filter((c) => c.brandedness === "UNBRANDED");
    expect(unbranded.length).toBeGreaterThan(0);
    for (const u of unbranded) {
      expect(u.prompt.toLowerCase()).not.toContain("bot consulting");
    }

    // Verify branded prompts exist
    const branded = candidates.filter((c) => c.brandedness === "BRANDED");
    expect(branded.length).toBeGreaterThan(0);
    expect(branded[0].prompt).toContain("BOT Consulting");
  });

  it("4. Deduplicates Near-Duplicates & Clusters into Stable Identities", () => {
    const profile = extractProjectKnowledgeProfile("proj_test", "botconsulting.io", samplePages);
    const questions = discoverQuestions(samplePages, profile);
    const candidates = generatePromptCandidates(profile, questions);

    const { deduplicatedCandidates, clusters } = deduplicateAndClusterPrompts(candidates);

    expect(deduplicatedCandidates.length).toBeGreaterThan(0);
    expect(clusters.length).toBeGreaterThan(0);

    // Stable cluster ID verification
    for (const cl of clusters) {
      expect(cl.id).toMatch(/^cls_[a-f0-9]{10}$/);
      expect(cl.promptsCount).toBeGreaterThan(0);
    }
  });

  it("5. Selects Monitoring Set with 100% Core Offering & Intent Coverage", () => {
    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      "proj_test",
      "botconsulting.io",
      samplePages
    );

    expect(promptUniverse.monitoringSet.length).toBeGreaterThan(0);
    expect(promptUniverse.health.coreOfferingCoverage.ratio).toBe(1.0);
    expect(promptUniverse.health.commercialIntentCoverage.ratio).toBe(1.0);
    expect(promptUniverse.health.tier1Count).toBeGreaterThan(0);
  });

  it("6. Preserves User Confirmations, Rejections, and Overrides across Recalculations", () => {
    const profile = extractProjectKnowledgeProfile("proj_gov", "botconsulting.io", samplePages);
    const offId = profile.offerings[0].id;

    // User confirms offering
    globalKnowledgeGovernance.confirmItem("proj_gov", offId);
    const governed = globalKnowledgeGovernance.applyOverrides(profile);
    expect(governed.offerings.find((o) => o.id === offId)?.status).toBe("CONFIRMED");

    // User rejects offering
    globalKnowledgeGovernance.rejectItem("proj_gov", offId);
    const governedAfterReject = globalKnowledgeGovernance.applyOverrides(profile);
    expect(governedAfterReject.offerings.find((o) => o.id === offId)).toBeUndefined();
  });

  it("7. ABSOLUTE SEO ISOLATION: Preserves 108 Production Rules & 118 Canonical Dimensions", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

    const fullyCovered = CANONICAL_118_DIMENSIONS.filter((d) => d.classification === "FULLY_COVERED");
    expect(fullyCovered.length).toBe(113);
  });
});
