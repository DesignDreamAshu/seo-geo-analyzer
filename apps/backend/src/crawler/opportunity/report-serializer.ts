/**
 * Master SEO Opportunity & Action Plan Serializer.
 * Formats prioritized opportunities, high-leverage summaries, and team queues into an actionable report.
 */

import { SeoOpportunityPlan } from "./types";

export function serializeOpportunityPlanMarkdown(plan: SeoOpportunityPlan): string {
  const s = plan.summary;
  const e = plan.eightyTwentySummary;

  let md = `# SEO OPPORTUNITY & ACTION PLAN

**Generated:** ${plan.generatedAt}  
**Project:** \`${plan.projectId}\`  
**Traffic Policy:** \`${plan.trafficPolicy.selectedPolicy}\` (${plan.trafficPolicy.selectionSource})  
**Total Action Items:** **${s.totalActions}** | **Estimated Real Changes:** **~${s.estimatedRealEditsTotal} edits**  
**Total Search Exposure:** **${s.totalSearchExposureImpressions.toLocaleString()} evaluated GSC search impressions**

---

## 1. Executive Action Summary

| Action Bucket | Count | Focus / Scope |
|---|---|---|
| **🚨 DO NOW** | **${s.doNowCount}** | Critical blockers & high-leverage immediate fixes |
| **📈 DO NEXT** | **${s.doNextCount}** | Important growth & decline recovery opportunities |
| **💡 LATER / OPTIMIZE** | ${s.laterOptimizeCount} | Lower-impact, advisory & content optimizations |
| **⚡ Quick Wins** | **${s.quickWinsCount}** | Low-effort adjustments with meaningful search leverage |
| **🧩 Systemic Fixes** | **${s.systemicFixesCount}** | Multi-page template fixes (~1 edit per group) |
| **🔒 Blocked Actions** | ${s.blockedCount} | Growth actions waiting on upstream indexability fixes |

---

## 2. High-Leverage Action Summary (80/20 View)

> **High-Leverage Focus:** The smallest high-confidence action set identified comprises **${e.topActionCount} actions**, requiring only **~${e.estimatedEdits} real edits**, resolving issues across **${e.affectedUrls} affected URLs**, and covering **${e.gscImpressionsCovered.toLocaleString()} evaluated search impressions**.

---

`;

  // 3. DO NOW Actions
  md += `## 3. 🚨 DO NOW (Immediate Priority)\n\n`;
  if (plan.doNowActions.length === 0) {
    md += `*No critical technical blockers or immediate regressions active.*\n\n`;
  } else {
    for (const a of plan.doNowActions) {
      md += `### [${a.actionPriority}] ${a.title}\n`;
      md += `- **Action ID:** \`${a.actionId}\` | **Type:** \`${a.type}\` (${a.nature})\n`;
      md += `- **Primary Owner:** \`${a.primaryOwner}\` (Confidence: \`${a.ownerRoutingConfidence}\`)\n`;
      md += `- **Effort:** \`${a.effort}\` (~${a.estimatedRealEdits} edit — *${a.effortRationale}*)\n`;
      md += `- **Affected Scope:** **${a.affectedUrlsCount} URLs** (e.g. \`${a.representativeUrls[0]}\`)\n`;
      if (a.gscExposure) {
        md += `- **Search Exposure:** **${a.gscExposure.totalImpressions.toLocaleString()} evaluated impressions** (${a.gscExposure.totalClicks.toLocaleString()} clicks, Data Quality: \`${a.gscExposure.dataQuality}\`)\n`;
      }
      md += `- **Page Importance:** \`${a.pageImportanceStatus}\`\n`;
      md += `- **Why This Priority:**\n`;
      for (const w of a.whyThisPriority) {
        md += `  - ${w}\n`;
      }
      md += `- **Where to Fix:** ${a.whereToFix}\n`;
      md += `- **Recommended Action:** ${a.recommendedAction}\n`;
      md += `- **Verification:** ${a.verificationInstructions}\n\n`;
    }
  }
  md += `---\n\n`;

  // 4. High-Leverage Systemic Fixes
  if (plan.systemicFixes.length > 0) {
    md += `## 4. 🧩 High-Leverage Systemic Template Fixes\n\n`;
    for (const a of plan.systemicFixes) {
      md += `### ${a.title}\n`;
      md += `- **Root Cause Hypothesis:** ${a.rootCauseGroup || "Shared Template Component"} (Confidence: \`${a.rootCauseConfidence || "HIGH_CONFIDENCE"}\`)\n`;
      md += `- **Estimated Real Edits:** **~${a.estimatedRealEdits} edit** fixes **${a.affectedUrlsCount} pages**\n`;
      md += `- **Where to Fix:** ${a.whereToFix}\n`;
      md += `- **Remediation:** ${a.recommendedAction}\n\n`;
    }
    md += `---\n\n`;
  }

  // 5. Quick Wins
  if (plan.quickWins.length > 0) {
    md += `## 5. ⚡ Quick Wins (Low Effort × Meaningful Leverage)\n\n`;
    for (const a of plan.quickWins) {
      md += `- **[${a.effort}] ${a.title}** on [${a.representativeUrls[0]}](${a.representativeUrls[0]})\n`;
      md += `  - *Rationale:* ${a.quickWinRationale}\n`;
      md += `  - *Action:* ${a.recommendedAction}\n`;
    }
    md += `\n---\n\n`;
  }

  // 6. DO NEXT Actions
  if (plan.doNextActions.length > 0) {
    md += `## 6. 📈 DO NEXT (Growth & Recovery Opportunities)\n\n`;
    for (const a of plan.doNextActions.slice(0, 10)) {
      md += `### [${a.actionPriority}] ${a.title}\n`;
      md += `- **Type:** \`${a.type}\` | **Primary Owner:** \`${a.primaryOwner}\`\n`;
      md += `- **Scope:** ${a.affectedUrlsCount} URLs | **Effort:** \`${a.effort}\`\n`;
      if (a.caution) {
        md += `- ⚠️ **Caution:** ${a.caution}\n`;
      }
      md += `- **Action:** ${a.recommendedAction}\n\n`;
    }
    md += `---\n\n`;
  }

  // 7. Team Work Queues
  md += `## 7. 👥 Team Work Queues\n\n`;
  for (const [owner, queue] of Object.entries(plan.teamQueues)) {
    if (queue.actionCount > 0) {
      md += `### ${owner} Queue (${queue.actionCount} items, ${queue.criticalCount} critical, ${queue.highCount} high)\n`;
      for (const a of queue.actions.slice(0, 5)) {
        md += `- **[${a.actionPriority}] \`${a.actionId}\`:** ${a.title} (~${a.estimatedRealEdits} edit)\n`;
      }
      if (queue.actions.length > 5) {
        md += `  *... and ${queue.actions.length - 5} additional items.*\n`;
      }
      md += `\n`;
    }
  }

  return md;
}
