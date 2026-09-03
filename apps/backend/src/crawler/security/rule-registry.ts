/**
 * Security Rule Registry & Orchestrator (SECURITY S2).
 * Registers all deterministic security rules and manages execution, deduplication, and coverage aggregation.
 */

import type { SecurityAuditFacts } from "./types";
import type {
  SecurityRule,
  SecurityFinding,
  SecurityCoverageRecord,
  SecurityEvaluationResult,
  SecurityRuleCategory,
} from "./rule-types";

import { transportRules } from "./rules/transport-rules";
import { hstsRules } from "./rules/hsts-rules";
import { cspRules } from "./rules/csp-rules";
import { frameProtectionRules } from "./rules/frame-protection-rules";
import { browserHeaderRules } from "./rules/browser-header-rules";
import { cookieRules } from "./rules/cookie-rules";
import { corsRules } from "./rules/cors-rules";
import { disclosureRules } from "./rules/disclosure-rules";
import { sensitiveFileRules } from "./rules/sensitive-file-rules";
import { formRules } from "./rules/form-rules";
import { thirdPartyRules } from "./rules/third-party-rules";
import { domainEmailRules } from "./rules/domain-email-rules";
import { manualCoverageRules } from "./rules/manual-coverage-rules";

export class SecurityRuleRegistry {
  private rules: Map<string, SecurityRule> = new Map();

  constructor() {
    this.registerAll([
      ...transportRules,
      ...hstsRules,
      ...cspRules,
      ...frameProtectionRules,
      ...browserHeaderRules,
      ...cookieRules,
      ...corsRules,
      ...disclosureRules,
      ...sensitiveFileRules,
      ...formRules,
      ...thirdPartyRules,
      ...domainEmailRules,
      ...manualCoverageRules,
    ]);
  }

  public register(rule: SecurityRule): void {
    if (this.rules.has(rule.ruleId)) {
      throw new Error(`Duplicate Security Rule ID registered: ${rule.ruleId}`);
    }
    this.rules.set(rule.ruleId, rule);
  }

  public registerAll(rules: SecurityRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  public getRule(ruleId: string): SecurityRule | undefined {
    return this.rules.get(ruleId);
  }

  public getAllRules(): SecurityRule[] {
    return Array.from(this.rules.values());
  }

  public getRulesByCategory(category: SecurityRuleCategory): SecurityRule[] {
    return this.getAllRules().filter((r) => r.category === category);
  }

  /**
   * Evaluates all registered security rules against authoritative S1 SecurityAuditFacts.
   */
  public evaluate(facts: SecurityAuditFacts): SecurityEvaluationResult {
    const allFindings: SecurityFinding[] = [];
    const coverageRecords: SecurityCoverageRecord[] = [];

    let passedCount = 0;
    let failedCount = 0;
    let warningCount = 0;
    let observedCount = 0;
    let notApplicableCount = 0;
    let notObservableCount = 0;
    let manualCount = 0;

    const findingsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };

    for (const rule of this.rules.values()) {
      try {
        const evalResult = rule.evaluate(facts);

        // Capability status determination
        let capabilityStatus = facts.capabilities.securityHeaderAnalysis;
        if (rule.requiredCapability && facts.capabilities[rule.requiredCapability]) {
          capabilityStatus = facts.capabilities[rule.requiredCapability];
        }

        // Aggregate findings
        for (const finding of evalResult.findings) {
          allFindings.push(finding);
          findingsBySeverity[finding.severity]++;
        }

        // Count execution statuses
        if (evalResult.status === "PASS") passedCount++;
        else if (evalResult.status === "FAIL") failedCount++;
        else if (evalResult.status === "WARNING") warningCount++;
        else if (evalResult.status === "OBSERVED") observedCount++;
        else if (evalResult.status === "NOT_APPLICABLE") notApplicableCount++;
        else if (evalResult.status === "NOT_OBSERVABLE") notObservableCount++;
        else if (evalResult.status === "REQUIRES_MANUAL_VERIFICATION") manualCount++;

        coverageRecords.push({
          ruleId: rule.ruleId,
          title: rule.title,
          category: rule.category,
          status: evalResult.status,
          verificationClassification: rule.verificationClassification,
          capabilityStatus,
          testedTargets: evalResult.testedTargets,
          passedTargets: evalResult.passedTargets,
          failedTargets: evalResult.failedTargets,
          notApplicableTargets: evalResult.notApplicableTargets,
          evidenceSummary: evalResult.evidenceSummary,
          findingsGeneratedCount: evalResult.findings.length,
        });
      } catch (err: any) {
        coverageRecords.push({
          ruleId: rule.ruleId,
          title: rule.title,
          category: rule.category,
          status: "ERROR",
          verificationClassification: rule.verificationClassification,
          capabilityStatus: "NOT_AVAILABLE",
          testedTargets: 0,
          passedTargets: 0,
          failedTargets: 0,
          notApplicableTargets: 0,
          evidenceSummary: `Execution error: ${err?.message || String(err)}`,
          findingsGeneratedCount: 0,
        });
      }
    }

    return {
      findings: allFindings,
      coverage: coverageRecords,
      summary: {
        totalRulesEvaluated: this.rules.size,
        passedRulesCount: passedCount,
        failedRulesCount: failedCount,
        warningRulesCount: warningCount,
        observedRulesCount: observedCount,
        notApplicableRulesCount: notApplicableCount,
        notObservableRulesCount: notObservableCount,
        manualVerificationRulesCount: manualCount,
        totalFindingsCount: allFindings.length,
        findingsBySeverity,
      },
    };
  }
}

export const defaultSecurityRuleRegistry = new SecurityRuleRegistry();
