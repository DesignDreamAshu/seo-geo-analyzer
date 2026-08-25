/**
 * Phase 28G: Remediation Verification Engine.
 * Provides two-level verification strictly separating website-side code implementation
 * (Level 1) from probabilistic external AI engine visibility outcomes (Level 2).
 */

import { AIOptimizationFinding, AIOptimizationLifecycleStatus } from "./types";
import { CrawledPageContext, PromptPageMapper } from "./mapper";
import { AIObservation } from "../observation/types";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";

export interface VerificationResult {
  findingId: string;
  previousStatus: AIOptimizationLifecycleStatus;
  updatedStatus: AIOptimizationLifecycleStatus;
  level1WebsiteVerified: boolean;
  level1Evidence: string;
  level2ProviderVerified: boolean;
  level2Evidence: string;
  reconciliationNotes: string;
}

export class AIOptimizationVerifier {
  private mapper = new PromptPageMapper();

  public verifyRemediation(
    finding: AIOptimizationFinding,
    pages: CrawledPageContext[],
    latestObservations: AIObservation[],
    profile: ProjectKnowledgeProfile
  ): VerificationResult {
    let level1Verified = false;
    let level1Evidence = "Level 1 website verification not yet met.";
    let level2Verified = false;
    let level2Evidence = "Level 2 provider outcome verification not yet observed.";
    let updatedStatus: AIOptimizationLifecycleStatus = finding.lifecycleStatus;

    // --- LEVEL 1: WEBSITE-SIDE FIX VERIFICATION ---
    if (finding.code === "AI_OPT_ENTITY_CLARITY_GENERIC_ACRONYM") {
      const hasOrgSchema = pages.some((p) => p.schemaTypes?.includes("Organization"));
      const homepage = pages[0];
      const hasDefinition = (homepage?.visibleText || "").toLowerCase().includes(profile.brand.name.toLowerCase());

      if (hasOrgSchema || hasDefinition) {
        level1Verified = true;
        level1Evidence = `Verified: Organization structured data or explicit entity definition is active on website.`;
      }
    } else if (finding.code === "AI_OPT_ANSWER_COVERAGE_GAP") {
      const targetUrl = finding.affectedPages[0]?.url;
      const targetPage = pages.find((p) => p.url === targetUrl);
      if (targetPage) {
        const text = (targetPage.visibleText || "").toLowerCase();
        const hasDefinition = text.includes("we provide") || text.includes("we offer") || text.includes("consulting");
        const hasAudience = text.includes("enterprise") || text.includes("business") || text.includes("clients");
        if (hasDefinition && hasAudience) {
          level1Verified = true;
          level1Evidence = `Verified: Direct answer summary and enterprise audience definition are present on ${targetUrl}.`;
        }
      }
    } else if (finding.code === "AI_OPT_STRUCTURED_ENTITY_SERVICE_SCHEMA_MISSING") {
      const allTargetPagesFixed = finding.affectedPages.every((af) => {
        const p = pages.find((page) => page.url === af.url);
        return p?.schemaTypes?.includes("Service") || p?.schemaTypes?.includes("ProfessionalService");
      });
      if (allTargetPagesFixed && finding.affectedPages.length > 0) {
        level1Verified = true;
        level1Evidence = `Verified: Schema.org Service JSON-LD detected across all ${finding.affectedPages.length} target pages.`;
      }
    } else if (finding.code === "AI_OPT_PROMPT_NO_TARGET_PAGE") {
      const samplePrompt = finding.affectedPrompts[0];
      if (samplePrompt) {
        const mapping = this.mapper.mapSinglePrompt(
          {
            id: samplePrompt.id,
            prompt: samplePrompt.prompt,
            promptType: "SERVICE_DISCOVERY",
            brandedness: samplePrompt.brandedness as any,
            intents: [samplePrompt.intent as any],
            funnelStage: samplePrompt.funnelStage as any,
            specificity: "MID",
            clusterId: "cl_1",
            monitoringTier: "TIER_1_CORE",
            isRepresentative: true,
            isPinned: false,
            isExcluded: false,
            isManual: false,
            priorityScore: 80,
            confidenceScore: 1.0,
            evidenceTrace: {
              sourceSignal: "DERIVED_FROM_EVIDENCE",
              reason: "Verification evaluation",
            },
            locale: { country: "US", language: "en" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          pages,
          profile
        );
        if (mapping.coverageState === "STRONG_MATCH" || mapping.coverageState === "PARTIAL_MATCH") {
          level1Verified = true;
          level1Evidence = `Verified: Dedicated landing page published (${mapping.targetPageUrl}) with mapping confidence ${mapping.mappingConfidence}.`;
        }
      }
    }

    // --- LEVEL 2: PROVIDER VISIBILITY OUTCOME VERIFICATION ---
    const targetPromptIds = new Set(finding.affectedPrompts.map((p) => p.id));
    const matchingObs = latestObservations.filter((o) => targetPromptIds.has(o.promptId));

    if (matchingObs.length > 0) {
      const confirmedObs = matchingObs.filter((o) => o.brandMentioned && o.entityAttribution?.entityMentionConfirmed);
      if (confirmedObs.length > 0) {
        level2Verified = true;
        level2Evidence = `Verified: ${confirmedObs.length}/${matchingObs.length} live AI observations confirmed brand entity visibility.`;
      } else {
        level2Evidence = `Provider recheck executed: Brand not yet confirmed across ${matchingObs.length} matching observations.`;
      }
    }

    // --- RECONCILE LIFECYCLE STATUS ---
    if (level1Verified && level2Verified) {
      updatedStatus = "IMPROVEMENT_OBSERVED";
    } else if (level1Verified && !level2Verified) {
      updatedStatus = matchingObs.length > 0 ? "NO_CHANGE_OBSERVED" : "WEBSITE_FIX_VERIFIED";
    } else if (!level1Verified && level2Verified) {
      updatedStatus = "IMPROVEMENT_OBSERVED"; // External engine improved independently
    }

    return {
      findingId: finding.id,
      previousStatus: finding.lifecycleStatus,
      updatedStatus,
      level1WebsiteVerified: level1Verified,
      level1Evidence,
      level2ProviderVerified: level2Verified,
      level2Evidence,
      reconciliationNotes: `Lifecycle updated from ${finding.lifecycleStatus} to ${updatedStatus}.`,
    };
  }
}
