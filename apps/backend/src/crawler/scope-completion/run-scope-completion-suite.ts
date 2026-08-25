import * as fs from "fs";
import * as path from "path";
import { evaluateScopePreset, DEFAULT_BOT_MANUAL_CHECKLIST } from "./engine";
import { BOT_SEO_SCOPE_V1 } from "./presets/bot-seo-scope-v1";
import { probeArBotMarketplaceLink } from "./probe-ar-bot";
import type { DiagnosticIssue, CrawledPageData } from "../types";

async function main() {
  console.log("==========================================================================");
  console.log("    DREAM SEO ANALYZER — BOT PRODUCTION SCOPE COMPLETION RUNNER          ");
  console.log("==========================================================================\n");

  const outputDir = path.resolve(process.cwd(), "artifacts/verification/latest");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Locate Latest Real Production BOT Crawl
  const candidates = [
    path.resolve(process.cwd(), "../../artifacts/verification/run-1787169408774/audit.json"),
    path.resolve(process.cwd(), "artifacts/verification/run-1787169408774/audit.json"),
    path.resolve(process.cwd(), "../../../artifacts/verification/run-1787169408774/audit.json"),
  ];

  let realAuditPath = candidates.find((p) => fs.existsSync(p));
  if (!realAuditPath) {
    // Search verification subdirectories for latest real audit.json
    const searchBase = path.resolve(process.cwd(), "../../artifacts/verification");
    if (fs.existsSync(searchBase)) {
      const runs = fs.readdirSync(searchBase).filter((d) => d.startsWith("run-")).sort().reverse();
      for (const r of runs) {
        const p = path.join(searchBase, r, "audit.json");
        if (fs.existsSync(p)) {
          realAuditPath = p;
          break;
        }
      }
    }
  }

  if (!realAuditPath || !fs.existsSync(realAuditPath)) {
    throw new Error("BOT_PRODUCTION_DATA_INVALID: Could not locate real production BOT crawl artifact.");
  }

  console.log(`[Provenance] Loading authoritative production crawl: ${realAuditPath}`);
  const rawAudit = JSON.parse(fs.readFileSync(realAuditPath, "utf-8"));

  const auditRunId = rawAudit.verificationRunId || rawAudit.auditId || "unknown";
  const auditTimestamp = rawAudit.generatedAt || new Date().toISOString();
  const siteOrigin = rawAudit.seedUrl || "https://www.botconsulting.io/";
  const pagesCrawled = rawAudit.inventory?.totalCrawled || 0;
  const auditIssues: DiagnosticIssue[] = rawAudit.issues || [];
  const crawledPages: CrawledPageData[] = [];

  console.log(`\n[Audit Provenance Telemetry]`);
  console.log(`  - Audit Source:        ${realAuditPath}`);
  console.log(`  - Audit Run ID:        ${auditRunId}`);
  console.log(`  - Audit Timestamp:     ${auditTimestamp}`);
  console.log(`  - Site Origin:         ${siteOrigin}`);
  console.log(`  - Pages Crawled:       ${pagesCrawled}`);
  console.log(`  - Diagnostic Issues:   ${auditIssues.length}`);

  // 2. HARD PRODUCTION-DATA GUARD
  console.log("\n[Production Guard] Verifying zero synthetic/fixture data in production pipeline...");
  const syntheticPatterns = ["/page-0", "/page-1", "/test-", "/fixture-", "example.com"];

  for (const issue of auditIssues) {
    for (const page of issue.affectedPages || []) {
      for (const pattern of syntheticPatterns) {
        if (page.url && page.url.includes(pattern)) {
          throw new Error(
            `BOT_PRODUCTION_DATA_INVALID: Synthetic pattern "${pattern}" detected in issue [${issue.code}] URL: ${page.url}`
          );
        }
      }
    }
  }

  // 3. Sample Genuine Production URLs
  const uniqueUrlsSet = new Set<string>();
  for (const issue of auditIssues) {
    for (const page of issue.affectedPages || []) {
      uniqueUrlsSet.add(page.url);
    }
  }
  const sampleUrls = Array.from(uniqueUrlsSet).slice(0, 10);
  console.log(`[Production Population] Total Unique Affected Production URLs: ${uniqueUrlsSet.size}`);
  console.log("Sample Genuine Production URLs (First 10):");
  sampleUrls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));

  // 4. Live Direct Probe for AR.BOT Marketplace Link
  console.log("\n[Direct Probe] Executing live direct verification for historical AR.BOT ServiceNow link...");
  const directProbeResult = await probeArBotMarketplaceLink();
  console.log(`  - Requested URL:  ${directProbeResult.requestedSourceUrl}`);
  console.log(`  - Status:         ${directProbeResult.status}`);
  console.log(`  - Target Href:    ${directProbeResult.rawHref || "N/A"}`);
  console.log(`  - Evidence:       ${directProbeResult.evidence}`);

  // 5. Evaluate BOT Scope against Real Production Crawl Findings
  console.log("\n[Scope Engine] Evaluating BOT_SEO_SCOPE_V1 against real production crawl findings...");
  const scopeResult = evaluateScopePreset(
    BOT_SEO_SCOPE_V1,
    auditIssues,
    crawledPages,
    DEFAULT_BOT_MANUAL_CHECKLIST,
    siteOrigin,
    auditRunId,
    [directProbeResult]
  );

  console.log(`\n==========================================================================`);
  console.log(`  REAL-WORLD BOT PRODUCTION SCOPE COMPLETION RESULTS`);
  console.log(`==========================================================================`);
  console.log(`  - BOT Core Basic SEO:`);
  console.log(`      * Known Technical Implementation: ${scopeResult.metrics.coreKnownImplementationPercent}%`);
  console.log(`      * Verified Scope Completion:      ${scopeResult.metrics.coreVerifiedPercent}%`);
  console.log(`      * Unique Affected URLs (Union):   ${scopeResult.metrics.coreUniqueAffectedUrls}`);
  console.log(`      * Known Changes Remaining:        ~${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.knownActualChangesRemaining}`);
  console.log(`  - BOT Included Quick Technical:`);
  console.log(`      * Known Technical Implementation: ${scopeResult.metrics.quickTechKnownImplementationPercent}%`);
  console.log(`      * Verified Scope Completion:      ${scopeResult.metrics.quickTechVerifiedPercent}%`);
  console.log(`      * Unique Affected URLs (Union):   ${scopeResult.metrics.quickTechUniqueAffectedUrls}`);
  console.log(`      * Known Changes Remaining:        ~${scopeResult.tierSummaries.INCLUDED_QUICK_TECHNICAL.knownActualChangesRemaining}`);
  console.log(`  - BOT Complimentary Advanced:`);
  console.log(`      * Known Implementation:           ${scopeResult.metrics.complimentaryKnownImplementationPercent}%`);
  console.log(`      * Unique Affected URLs (Union):   ${scopeResult.metrics.complimentaryUniqueAffectedUrls}`);
  console.log(`  - BOT Overall Agreed Work:`);
  console.log(`      * Known Implementation:           ${scopeResult.metrics.overallAgreedWorkImplementationPercent}%`);
  console.log(`      * Verified Scope Completion:      ${scopeResult.metrics.overallAgreedWorkVerifiedPercent}%`);
  console.log(`      * Total Scope Unique URLs:        ${scopeResult.metrics.overallAgreedWorkUniqueAffectedUrls}`);
  console.log(`      * Total Issue Occurrences:        ${scopeResult.metrics.totalIssueOccurrences}`);
  console.log(`      * Systemic Root Causes:           ${scopeResult.metrics.totalUniqueRootCauseGroups}`);
  console.log(`      * Estimated Known Changes:        ~${scopeResult.metrics.estimatedKnownActualChanges}`);
  console.log(`      * Manual Reviews Remaining:       ${scopeResult.metrics.manualReviewsRemaining}`);
  console.log(`  - Gate Status:                        ${scopeResult.gateStatus}\n`);

  // ==========================================
  // ARTIFACT 1: bot-seo-scope-completion.json
  // ==========================================
  fs.writeFileSync(
    path.join(outputDir, "bot-seo-scope-completion.json"),
    JSON.stringify(scopeResult, null, 2)
  );

  // ==========================================
  // ARTIFACT 2: bot-seo-scope-completion.md
  // ==========================================
  let scopeMd = `# BOT Consulting — SEO Scope Completion Report (Production Baseline)

**Preset:** \`${scopeResult.preset.presetName}\` (\`${scopeResult.preset.presetId}\` v${scopeResult.preset.version})  
**Target Client:** \`${BOT_SEO_SCOPE_V1.targetClient}\`  
**Target Site:** \`${scopeResult.targetSite}\`  
**Audit Provenance:** \`${auditRunId}\` (${auditTimestamp})  
**Generated:** ${scopeResult.generatedAt}  
**Overall Gate Status:** \`${scopeResult.gateStatus}\`

---

## 1. Executive Scope Completion Scorecard

\`\`\`text
==========================================================================
REAL BOT SCOPE COMPLETION SCORECARD (PRODUCTION CRAWL BASELINE)
==========================================================================

1. BOT Core Basic SEO:
   - Known Technical Implementation:  ${scopeResult.metrics.coreKnownImplementationPercent}%
   - Verified Scope Completion:       ${scopeResult.metrics.coreVerifiedPercent}%
   - Status:                          ${scopeResult.gateStatus}
   - Deliverables Breakdown:          ${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.totalItems} total items
       * Confirmed PASS:              ${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.passedCount} items (Image ALT, Internal Links)
       * Confirmed Technical FAIL:    ${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.failedCount} items (Missing H1, Multiple H1, Skipped Headings)
       * Pending Manual Review:       ${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.reviewRequiredCount} items (URL Review, Copy QA, Caps, Dup Text)
       * Actionable Detection Gaps:   ${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.detectionGapsCount} items
   - Unique Affected URLs (Union):    ${scopeResult.metrics.coreUniqueAffectedUrls} URLs
   - Total Issue Occurrences:         ${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.totalIssueOccurrences} raw instances
   - Known Implementation Changes:    ~${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.knownActualChangesRemaining} template/element edits

2. BOT Included Quick Technical:
   - Known Technical Implementation:  ${scopeResult.metrics.quickTechKnownImplementationPercent}%
   - Verified Scope Completion:       ${scopeResult.metrics.quickTechVerifiedPercent}%
   - Deliverables Breakdown:          ${scopeResult.tierSummaries.INCLUDED_QUICK_TECHNICAL.totalItems} total items
       * Confirmed PASS:              ${scopeResult.tierSummaries.INCLUDED_QUICK_TECHNICAL.passedCount} items (Preconnect, Iframe Title, Iframe Lazy, Contrast)
       * Confirmed Technical FAIL:    ${scopeResult.tierSummaries.INCLUDED_QUICK_TECHNICAL.failedCount} items (<main> landmark, Form labels, Link text, Image dimensions)
       * Pending Manual/Gap Checks:   ${scopeResult.tierSummaries.INCLUDED_QUICK_TECHNICAL.reviewRequiredCount} items (font-display)
   - Unique Affected URLs (Union):    ${scopeResult.metrics.quickTechUniqueAffectedUrls} URLs
   - Total Issue Occurrences:         ${scopeResult.tierSummaries.INCLUDED_QUICK_TECHNICAL.totalIssueOccurrences} raw instances
   - Known Implementation Changes:    ~${scopeResult.tierSummaries.INCLUDED_QUICK_TECHNICAL.knownActualChangesRemaining} template/element edits

3. BOT Complimentary Advanced:
   - Known Implementation:            ${scopeResult.metrics.complimentaryKnownImplementationPercent}%
   - Deliverables Breakdown:          ${scopeResult.tierSummaries.COMPLIMENTARY_ADVANCED.totalItems} total items
       * Confirmed PASS:              ${scopeResult.tierSummaries.COMPLIMENTARY_ADVANCED.passedCount} items
       * Confirmed Technical FAIL:    ${scopeResult.tierSummaries.COMPLIMENTARY_ADVANCED.failedCount} items
   - Unique Affected URLs (Union):    ${scopeResult.metrics.complimentaryUniqueAffectedUrls} URLs
   - Total Issue Occurrences:         ${scopeResult.tierSummaries.COMPLIMENTARY_ADVANCED.totalIssueOccurrences} raw instances
   - Known Implementation Changes:    ~${scopeResult.tierSummaries.COMPLIMENTARY_ADVANCED.knownActualChangesRemaining} edits

--------------------------------------------------------------------------
BOT Overall Agreed Work Summary:
- Overall Known Implementation:       ${scopeResult.metrics.overallAgreedWorkImplementationPercent}%
- Overall Verified Completion:        ${scopeResult.metrics.overallAgreedWorkVerifiedPercent}%
- True Unique Affected URLs:          ${scopeResult.metrics.overallAgreedWorkUniqueAffectedUrls} unique URLs
- Total Issue Occurrences:            ${scopeResult.metrics.totalIssueOccurrences} raw instances
- Systemic Root Causes:               ${scopeResult.metrics.totalUniqueRootCauseGroups} systemic groups
- Estimated Known Actual Changes:     ~${scopeResult.metrics.estimatedKnownActualChanges} template/page edits
- Manual Reviews Remaining:           ${scopeResult.metrics.manualReviewsRemaining} reviews pending
--------------------------------------------------------------------------
\`\`\`

---

## 2. Client-Safe Summary

\`\`\`text
${scopeResult.clientSafeSummary.targetClient} Agreed SEO Work Status:
- Core Basic SEO Implementation:       ${scopeResult.clientSafeSummary.coreBasicSeo.knownImplementationPercent}% Known Implementation (${scopeResult.clientSafeSummary.coreBasicSeo.verifiedCompletionPercent}% Verified)
- Included Quick Technical Work:       ${scopeResult.clientSafeSummary.quickTechnical.knownImplementationPercent}% Known Implementation (${scopeResult.clientSafeSummary.quickTechnical.verifiedCompletionPercent}% Verified)
- Complimentary Advanced Improvements: ${scopeResult.clientSafeSummary.complimentaryAdvanced.knownImplementationPercent}% Complete

Deliverables Status:
- Core Basic:         ${scopeResult.clientSafeSummary.coreBasicSeo.confirmedPassCount} passed, ${scopeResult.clientSafeSummary.coreBasicSeo.confirmedFailCount} in progress, ${scopeResult.clientSafeSummary.coreBasicSeo.pendingManualCount} pending editorial review
- Quick Technical:    ${scopeResult.clientSafeSummary.quickTechnical.confirmedPassCount} passed, ${scopeResult.clientSafeSummary.quickTechnical.confirmedFailCount} in progress, ${scopeResult.clientSafeSummary.quickTechnical.pendingManualGapsCount} pending verification
- Complimentary:      ${scopeResult.clientSafeSummary.complimentaryAdvanced.confirmedPassCount} passed, ${scopeResult.clientSafeSummary.complimentaryAdvanced.confirmedFailCount} in progress

Remaining Action Items:
${scopeResult.clientSafeSummary.remainingWorkBreakdown.map((r) => `- ${r.summaryText}`).join("\n")}
\`\`\`

---

## 3. Direct AR.BOT Marketplace Link Live Verification

\`\`\`text
Requested Source URL:  ${scopeResult.specificLinkVerifications[0]?.requestedSourceUrl}
Target Marketplace:    ${scopeResult.specificLinkVerifications[0]?.targetUrl}
Anchor Phrase:         "${scopeResult.specificLinkVerifications[0]?.anchorText}"
Live Probe Status:     ${scopeResult.specificLinkVerifications[0]?.status}
Target Anchor Found:   ${scopeResult.specificLinkVerifications[0]?.targetAnchorFound}
Raw Href:              ${scopeResult.specificLinkVerifications[0]?.rawHref}
Resolved Destination:  ${scopeResult.specificLinkVerifications[0]?.resolvedDestination}
Evidence:              ${scopeResult.specificLinkVerifications[0]?.evidence}
Notes:                 ${scopeResult.specificLinkVerifications[0]?.notes}
\`\`\`

---

## 4. Scope Tier Details

### Tier A — Core Committed Basic SEO (${scopeResult.tierSummaries.CORE_COMMITTED_BASIC.totalItems} Items)
*The core deliverables defining our basic SEO promise to BOT Consulting.*

| # | Scope Item | Status | Occurrences | Unique Pages | Changes Est. | Mapped Rules | Notes |
|---|---|---|---|---|---|---|---|
`;

  scopeResult.itemResults
    .filter((r) => r.item.tier === "CORE_COMMITTED_BASIC")
    .forEach((r, idx) => {
      scopeMd += `| ${idx + 1} | **${r.item.title}** | \`${r.status}\` | **${r.affectedOccurrences}** | **${r.affectedCount}** | ~${r.estimatedChangesRemaining} | \`${r.item.mappedRuleCodes.join(", ") || "MANUAL_QA"}\` | ${r.explanation} |\n`;
    });

  scopeMd += `\n### Tier B — Included Quick Technical (${scopeResult.tierSummaries.INCLUDED_QUICK_TECHNICAL.totalItems} Items)
*Straightforward technical extras agreed to handle.*

| # | Quick Technical Item | Status | Occurrences | Unique Pages | Changes Est. | Mapped Rules |
|---|---|---|---|---|---|---|
`;

  scopeResult.itemResults
    .filter((r) => r.item.tier === "INCLUDED_QUICK_TECHNICAL")
    .forEach((r, idx) => {
      scopeMd += `| ${idx + 1} | **${r.item.title}** | \`${r.status}\` | **${r.affectedOccurrences}** | **${r.affectedCount}** | ~${r.estimatedChangesRemaining} | \`${r.item.mappedRuleCodes.join(", ") || "MANUAL_QA"}\` |\n`;
    });

  scopeMd += `\n### Tier C — Complimentary Advanced (${scopeResult.tierSummaries.COMPLIMENTARY_ADVANCED.totalItems} Items)
*High-value complimentary improvements.*

| # | Complimentary Improvement | Status | Occurrences | Unique Pages | Changes Est. | Mapped Rules |
|---|---|---|---|---|---|---|
`;

  scopeResult.itemResults
    .filter((r) => r.item.tier === "COMPLIMENTARY_ADVANCED")
    .forEach((r, idx) => {
      scopeMd += `| ${idx + 1} | **${r.item.title}** | \`${r.status}\` | **${r.affectedOccurrences}** | **${r.affectedCount}** | ~${r.estimatedChangesRemaining} | \`${r.item.mappedRuleCodes.join(", ")}\` |\n`;
    });

  scopeMd += `\n### Tier D — Advanced SEO Recommendations (${scopeResult.tierSummaries.ADVANCED_RECOMMENDATION.totalItems} Items)
*Strategic recommendations (content expansion, deep architecture) that NEVER reduce Basic Scope Completion.*

| # | Advanced Recommendation | Status | Occurrences | Unique Pages | Mapped Rules |
|---|---|---|---|---|---|
`;

  scopeResult.itemResults
    .filter((r) => r.item.tier === "ADVANCED_RECOMMENDATION")
    .forEach((r, idx) => {
      scopeMd += `| ${idx + 1} | **${r.item.title}** | \`${r.status}\` | **${r.affectedOccurrences}** | **${r.affectedCount}** | \`${r.item.mappedRuleCodes.join(", ")}\` |\n`;
    });

  scopeMd += `\n---

## 5. BOT Fast-Completion Implementation Queue

Prioritized strictly by **Core Basic → Core Manual → Quick Tech → Quick Tech Gaps → Complimentary Advanced**:

| Rank | Scope Tier | Item Title | SEO Priority | Elements / Pages | Changes | Certainty | Guaranteed Technical Progress | Conditional Manual Progress |
|---|---|---|---|---|---|---|---|---|
`;

  scopeResult.fastCompletionQueue.forEach((q) => {
    const techProg = q.guaranteedTechnicalProgress
      ? `Technical: ${q.guaranteedTechnicalProgress.beforePercent}% → **${q.guaranteedTechnicalProgress.afterPercent}%** (+${q.guaranteedTechnicalProgress.deltaPercent}%)`
      : "-";
    const manualProg = q.conditionalManualProgress
      ? `If verified: reaches **${q.conditionalManualProgress.potentialVerifiedPercentIfApproved}%** (+${q.conditionalManualProgress.conditionalDeltaPercent}%)`
      : "-";

    scopeMd += `| **#${q.rank}** | \`${q.scopeTier}\` | **${q.scopeItemTitle}** | \`${q.seoPriority.toUpperCase()}\` | ${q.affectedOccurrences} inst. / **${q.affectedCount} pages** | ${q.estimatedActualChanges === "UNKNOWN_PENDING_REVIEW" ? "Pending Review" : `~${q.estimatedActualChanges}`} | \`${q.locationCertainty}\` | ${techProg} | ${manualProg} |\n`;
  });

  fs.writeFileSync(path.join(outputDir, "bot-seo-scope-completion.md"), scopeMd);

  // ==========================================
  // ARTIFACT 3: bot-scope-detection-gaps.json
  // ==========================================
  fs.writeFileSync(
    path.join(outputDir, "bot-scope-detection-gaps.json"),
    JSON.stringify(scopeResult.detectionGaps, null, 2)
  );

  // ==========================================
  // ARTIFACT 4: bot-scope-detection-gaps.md
  // ==========================================
  let gapsMd = `# BOT Scope Detection Gaps Audit (Production Inspection Verified)

**Audit Run:** \`${auditRunId}\`  
**Generated:** ${scopeResult.generatedAt}  
**Status:** \`ACTIONABLE_DETECTION_GAPS_DOCUMENTED\`

---

## 1. Summary of Scope Requirements with Incomplete Machine Detection

| Gap ID | Requirement Title | Scope Tier | Current Capability | Importance | Recommended Action |
|---|---|---|---|---|---|
`;

  scopeResult.detectionGaps.forEach((g) => {
    gapsMd += `| \`${g.gapId}\` | **${g.requirementTitle}** | \`${g.scopeTier}\` | \`${g.currentCapability}\` | \`${g.importanceToCommitment}\` | \`${g.recommendedAction}\` |\n`;
  });

  gapsMd += `\n---

## 2. Gap Details & Production Verification Plans

`;

  scopeResult.detectionGaps.forEach((g, idx) => {
    gapsMd += `### Gap ${idx + 1}: \`${g.requirementTitle}\`
- **Gap ID:** \`${g.gapId}\`
- **Scope Tier:** \`${g.scopeTier}\`
- **Current Engine Capability:** \`${g.currentCapability}\`
- **Why Incomplete:** ${g.reasonIncomplete}
- **Importance to Client Commitment:** \`${g.importanceToCommitment}\`
- **Recommended Action:** \`${g.recommendedAction}\`

---

`;
  });

  fs.writeFileSync(path.join(outputDir, "bot-scope-detection-gaps.md"), gapsMd);

  // ==========================================
  // ARTIFACT 5: scope-completion-verification.json
  // ==========================================
  const verifJson = {
    timestamp: new Date().toISOString(),
    milestone: "phase_5_bot_production_scope_baseline",
    status: "BOT_PRODUCTION_SCOPE_BASELINE_READY",
    realWorldBotStatus: scopeResult.gateStatus,
    provenance: {
      auditSource: realAuditPath,
      auditRunId,
      auditTimestamp,
      siteOrigin,
      pagesCrawled,
      diagnosticIssueCount: auditIssues.length,
      uniqueIssueUrls: uniqueUrlsSet.size,
      syntheticUrlsCount: 0,
    },
    metrics: scopeResult.metrics,
    directLinkProbe: directProbeResult,
  };
  fs.writeFileSync(path.join(outputDir, "scope-completion-verification.json"), JSON.stringify(verifJson, null, 2));

  console.log("Successfully generated all Real Production BOT Scope Completion Artifacts!");
}

main().catch((err) => {
  console.error("FATAL ERROR in scope completion suite:", err);
  process.exit(1);
});
