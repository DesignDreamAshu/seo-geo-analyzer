/**
 * Phase 28K: Unified Remediation Workflow Engine.
 * Manages action items, state transitions, direct verification, partial fix handling,
 * audit reconciliation, and denominator invariant certification.
 */

import {
  ActionItem,
  ActionItemPriority,
  ActionItemStatus,
  ActionOccurrenceItem,
  ActionItemSourceType,
  BlockerReason,
  WorkflowQueueSummary,
  WorkflowFilterOptions,
} from "./types";
import { getClientSafePresentation } from "./client-labels";
import { verifySingleResource, verifyBatchAffected, LiveVerificationStatus } from "../crawler/verification/issue-verifier";

export class RemediationWorkflowEngine {
  /**
   * Generates or reconciles action items from an authoritative full audit crawl.
   */
  public generateActionItemsFromAudit(
    projectId: string,
    auditRunId: string,
    diagnosticResult: any,
    existingItems: ActionItem[] = []
  ): ActionItem[] {
    const existingMap = new Map<string, ActionItem>(
      existingItems.map((item) => [item.actionItemId, item])
    );

    const activeFindings = diagnosticResult.ruleExecutionObservability || [];
    const updatedItems: ActionItem[] = [];
    const seenActionIds = new Set<string>();

    for (const ruleObs of activeFindings) {
      if (ruleObs.passed && !ruleObs.isWarning) continue;

      const ruleId = ruleObs.ruleId;
      const actionItemId = `act_seo_${projectId}_${ruleId}`;
      seenActionIds.add(actionItemId);

      const existing = existingMap.get(actionItemId);
      const clientPresentation = getClientSafePresentation(ruleId, ruleObs.ruleTitle);

      // Extract all affected URLs & occurrences
      const affectedUrls: string[] = (ruleObs.affectedPages || ruleObs.affectedUrls || []).map((p: any) =>
        typeof p === "string" ? p : p.url || p.pageUrl
      );

      const rawOccurrences: any[] = ruleObs.occurrences || [];
      const occurrences: ActionOccurrenceItem[] = [];

      if (rawOccurrences.length > 0) {
        for (let i = 0; i < rawOccurrences.length; i++) {
          const occ = rawOccurrences[i];
          occurrences.push({
            occurrenceId: `occ_${ruleId}_${i}`,
            url: occ.url || affectedUrls[0] || "",
            location: occ.selector || occ.location || occ.tagName,
            snippet: occ.snippet || occ.codeSnippet || occ.identity,
            selector: occ.selector,
            isResolved: false,
          });
        }
      } else {
        // If no explicit sub-occurrences, each affected URL is 1 occurrence
        for (let i = 0; i < affectedUrls.length; i++) {
          occurrences.push({
            occurrenceId: `occ_${ruleId}_url_${i}`,
            url: affectedUrls[i],
            location: "Page-level",
            snippet: ruleObs.summary || ruleObs.recommendation,
            isResolved: false,
          });
        }
      }

      // Compute explainable system priority
      const systemPriority = this.calculateSystemPriority(ruleId, ruleObs.severity, affectedUrls.length);
      const priorityReason = this.explainPriority(ruleId, systemPriority, affectedUrls.length);

      // Structured remediation instructions
      const whatIsWrong = ruleObs.summary || `Issues detected for diagnostic rule ${ruleId}.`;
      const whyItMatters = clientPresentation.businessImpact;
      const whereItOccurs = `${affectedUrls.length} affected page(s) with ${occurrences.length} total occurrence(s).`;
      const whatToChange = ruleObs.recommendation || clientPresentation.remediationSummary;
      const howToChange = `Review the affected elements in your website template or CMS and apply recommended structural fixes.`;
      const howToVerify = `Use the "Verify Item" button to fetch the live affected URL(s) and confirm the issue is resolved.`;

      const now = new Date().toISOString();

      if (existing) {
        // Reconcile with existing item
        let status = existing.status;
        const history = [...existing.history];

        // Check if reopened
        if (existing.status === "VERIFIED_FIXED" || existing.status === "MANUALLY_CONFIRMED") {
          status = "REOPENED";
          history.push({
            timestamp: now,
            actor: "SYSTEM",
            action: "AUDIT_RECONCILIATION",
            fromStatus: existing.status,
            toStatus: "REOPENED",
            details: `Defect re-detected during full site audit run ${auditRunId}.`,
          });
        }

        updatedItems.push({
          ...existing,
          title: clientPresentation.clientSafeLabel,
          summary: whatIsWrong,
          systemPriority,
          effectivePriority: existing.userPriority || systemPriority,
          priorityReason,
          status,
          category: ruleObs.category || "TECHNICAL_SEO",
          clientSafeLabel: clientPresentation.clientSafeLabel,
          affectedUrls,
          totalOccurrences: occurrences.length,
          remainingOccurrences: occurrences.length - existing.resolvedOccurrences,
          whatIsWrong,
          whyItMatters,
          whereItOccurs,
          whatToChange,
          howToChange,
          howToVerify,
          recommendation: whatToChange,
          sourceSnapshotRef: { auditRunId },
          history,
          updatedAt: now,
        });
      } else {
        // Create fresh action item
        updatedItems.push({
          actionItemId,
          projectId,
          sourceType: "SEO_FINDING",
          sourceId: ruleId,
          title: clientPresentation.clientSafeLabel,
          summary: whatIsWrong,
          systemPriority,
          userPriority: null,
          effectivePriority: systemPriority,
          priorityReason,
          status: "OPEN",
          userSetStatus: null,
          systemVerifiedStatus: null,
          lastVerifiedAt: null,
          verificationMethod: "LIVE_HTTP_AND_DOM_VERIFICATION",
          category: ruleObs.category || "TECHNICAL_SEO",
          clientSafeLabel: clientPresentation.clientSafeLabel,
          affectedUrls,
          affectedPrompts: [],
          totalOccurrences: occurrences.length,
          resolvedOccurrences: 0,
          remainingOccurrences: occurrences.length,
          occurrences,
          whatIsWrong,
          whyItMatters,
          whereItOccurs,
          whatToChange,
          howToChange,
          howToVerify,
          recommendation: whatToChange,
          assigneeName: null,
          dueDate: null,
          blockerReason: null,
          blockerDetail: null,
          notes: [],
          history: [
            {
              timestamp: now,
              actor: "SYSTEM",
              action: "CREATED_FROM_AUDIT",
              toStatus: "OPEN",
              details: `Action item initialized from audit run ${auditRunId}.`,
            },
          ],
          sourceSnapshotRef: { auditRunId },
          lastVerificationEvidence: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Check existing SEO items that are no longer detected in the new audit -> Mark RESOLVED_BY_NEW_AUDIT
    for (const existing of existingItems) {
      if (existing.sourceType === "SEO_FINDING" && !seenActionIds.has(existing.actionItemId)) {
        if (existing.status !== "VERIFIED_FIXED" && existing.status !== "WONT_FIX") {
          const now = new Date().toISOString();
          const history = [...existing.history];
          history.push({
            timestamp: now,
            actor: "SYSTEM",
            action: "AUDIT_RECONCILIATION",
            fromStatus: existing.status,
            toStatus: "VERIFIED_FIXED",
            details: `Defect no longer observed during full site audit run ${auditRunId}.`,
          });

          updatedItems.push({
            ...existing,
            status: "VERIFIED_FIXED",
            systemVerifiedStatus: "VERIFIED_FIXED",
            resolvedOccurrences: existing.totalOccurrences,
            remainingOccurrences: 0,
            history,
            updatedAt: now,
          });
        } else {
          updatedItems.push(existing);
        }
      } else if (existing.sourceType !== "SEO_FINDING") {
        // Retain non-SEO items (AI optimization, competitive)
        updatedItems.push(existing);
      }
    }

    return updatedItems;
  }

  /**
   * Reconciles action items with AI optimization opportunities and measurement gaps.
   */
  public generateActionItemsFromAIOptimization(
    projectId: string,
    optSnapshot: any,
    existingItems: ActionItem[] = []
  ): ActionItem[] {
    const existingMap = new Map<string, ActionItem>(
      existingItems.map((item) => [item.actionItemId, item])
    );
    const updatedItems = [...existingItems];

    const findings = optSnapshot.findings || [];
    for (const finding of findings) {
      const actionItemId = `act_ai_opt_${projectId}_${finding.findingId || finding.ruleId}_${finding.targetPageUrl || "global"}`;
      if (existingMap.has(actionItemId)) continue;

      const now = new Date().toISOString();
      const presentation = getClientSafePresentation("AI_OPTIMIZATION_GAP", finding.ruleTitle || "AI Content Depth");

      const affectedUrls = finding.targetPageUrl ? [finding.targetPageUrl] : [];
      const affectedPrompts = finding.affectedPrompts?.map((p: any) => p.promptText || p.text || p) || [];

      const systemPriority: ActionItemPriority =
        finding.priority === "CRITICAL" ? "CRITICAL" : finding.priority === "HIGH" ? "HIGH" : "MEDIUM";

      const newItem: ActionItem = {
        actionItemId,
        projectId,
        sourceType: "AI_OPTIMIZATION",
        sourceId: finding.findingId || finding.ruleId || "AI_GAP",
        title: presentation.clientSafeLabel,
        summary: finding.summary || "AI search discovery opportunity.",
        systemPriority,
        userPriority: null,
        effectivePriority: systemPriority,
        priorityReason: `Identified by AI Optimization Engine based on query intent satisfaction.`,
        status: "OPEN",
        userSetStatus: null,
        systemVerifiedStatus: null,
        lastVerifiedAt: null,
        verificationMethod: "SEMANTIC_CONTENT_RE_EVALUATION",
        category: "AI_SEARCH_OPTIMIZATION",
        clientSafeLabel: presentation.clientSafeLabel,
        affectedUrls,
        affectedPrompts,
        totalOccurrences: Math.max(1, affectedPrompts.length),
        resolvedOccurrences: 0,
        remainingOccurrences: Math.max(1, affectedPrompts.length),
        occurrences: affectedUrls.map((url, i) => ({
          occurrenceId: `occ_ai_${i}`,
          url,
          location: "Target Content Section",
          snippet: finding.remediationGuidance || finding.summary,
          isResolved: false,
        })),
        whatIsWrong: finding.summary || "Target content lacks direct structured answer blocks.",
        whyItMatters: presentation.businessImpact,
        whereItOccurs: `${affectedUrls.join(", ")} (${affectedPrompts.length} prompt queries)`,
        whatToChange: finding.remediationGuidance || "Add structured answer summary and verified case proof.",
        howToChange: "Incorporate direct question-and-answer format and quantifiable first-party evidence.",
        howToVerify: "Re-run AI Measurement to certify the updated page achieves STRONG coverage.",
        recommendation: finding.remediationGuidance || "Improve page semantic coverage.",
        assigneeName: null,
        dueDate: null,
        blockerReason: null,
        blockerDetail: null,
        notes: [],
        history: [
          {
            timestamp: now,
            actor: "SYSTEM",
            action: "CREATED_FROM_AI_OPTIMIZATION",
            toStatus: "OPEN",
            details: `Created from AI Optimization snapshot ${optSnapshot.snapshotId}.`,
          },
        ],
        sourceSnapshotRef: {
          snapshotId: optSnapshot.snapshotId,
          engineVersion: optSnapshot.engineVersion,
        },
        lastVerificationEvidence: null,
        createdAt: now,
        updatedAt: now,
      };

      updatedItems.push(newItem);
    }

    return updatedItems;
  }

  /**
   * Reconciles action items with competitive opportunities.
   */
  public generateActionItemsFromCompetitiveBenchmark(
    projectId: string,
    competitiveSnapshot: any,
    existingItems: ActionItem[] = []
  ): ActionItem[] {
    const existingMap = new Map<string, ActionItem>(
      existingItems.map((item) => [item.actionItemId, item])
    );
    const updatedItems = [...existingItems];

    const opportunities = competitiveSnapshot.opportunities || [];
    for (const opp of opportunities) {
      const actionItemId = `act_comp_${projectId}_${opp.opportunityId}`;
      if (existingMap.has(actionItemId)) continue;

      const now = new Date().toISOString();
      const presentation = getClientSafePresentation("COMPETITIVE_BENCHMARK_GAP", opp.title || "Competitive Content Gap");

      const affectedUrls = opp.clientTargetPageUrl ? [opp.clientTargetPageUrl] : [];
      const affectedPrompts = opp.prompts?.map((p: any) => p.text || p) || [];

      const systemPriority: ActionItemPriority =
        opp.priority === "HIGH" ? "HIGH" : opp.priority === "CRITICAL" ? "CRITICAL" : "MEDIUM";

      const newItem: ActionItem = {
        actionItemId,
        projectId,
        sourceType: "COMPETITIVE_OPPORTUNITY",
        sourceId: opp.opportunityId,
        title: opp.title || presentation.clientSafeLabel,
        summary: opp.clientDeficiency || "Competitor provides superior semantic content depth.",
        systemPriority,
        userPriority: null,
        effectivePriority: systemPriority,
        priorityReason: `Competitor advantage observed across ${affectedPrompts.length} prompt queries.`,
        status: "OPEN",
        userSetStatus: null,
        systemVerifiedStatus: null,
        lastVerifiedAt: null,
        verificationMethod: "COMPETITIVE_BENCHMARK_RE_EVALUATION",
        category: "COMPETITIVE_INTELLIGENCE",
        clientSafeLabel: presentation.clientSafeLabel,
        affectedUrls,
        affectedPrompts,
        totalOccurrences: Math.max(1, affectedPrompts.length),
        resolvedOccurrences: 0,
        remainingOccurrences: Math.max(1, affectedPrompts.length),
        occurrences: affectedUrls.map((url, i) => ({
          occurrenceId: `occ_comp_${i}`,
          url,
          location: "Target Service Offering",
          snippet: opp.recommendation,
          isResolved: false,
        })),
        whatIsWrong: opp.clientDeficiency,
        whyItMatters: presentation.businessImpact,
        whereItOccurs: `${affectedUrls.join(", ")} vs Competitor (${opp.competitorReferencePages?.map((c: any) => c.competitorName).join(", ")})`,
        whatToChange: opp.recommendation,
        howToChange: `${opp.recommendation} Ensure original first-party capabilities and verified case proof are synthesized without copying competitor wording.`,
        howToVerify: opp.verificationMethod || "Re-run competitive benchmark to confirm parity or client advantage.",
        recommendation: opp.recommendation,
        assigneeName: null,
        dueDate: null,
        blockerReason: null,
        blockerDetail: null,
        notes: [],
        history: [
          {
            timestamp: now,
            actor: "SYSTEM",
            action: "CREATED_FROM_COMPETITIVE_BENCHMARK",
            toStatus: "OPEN",
            details: `Created from Competitive Benchmark snapshot ${competitiveSnapshot.snapshotId}.`,
          },
        ],
        sourceSnapshotRef: {
          snapshotId: competitiveSnapshot.snapshotId,
          engineVersion: competitiveSnapshot.competitiveEngineVersion,
        },
        lastVerificationEvidence: null,
        createdAt: now,
        updatedAt: now,
      };

      updatedItems.push(newItem);
    }

    return updatedItems;
  }

  /**
   * Updates an action item's status, enforcing valid transitions and distinguishing user vs system verification.
   */
  public updateItemStatus(
    item: ActionItem,
    newStatus: ActionItemStatus,
    actor = "USER",
    details?: string
  ): ActionItem {
    const fromStatus = item.status;
    if (fromStatus === newStatus) return item;

    // Safety rule: User marking something done cannot produce VERIFIED_FIXED directly
    let effectiveNewStatus = newStatus;
    let userSetStatus = item.userSetStatus;
    let systemVerifiedStatus = item.systemVerifiedStatus;

    if (actor === "USER" && (newStatus === "VERIFIED_FIXED" || (newStatus as any) === "DONE")) {
      effectiveNewStatus = "READY_TO_VERIFY";
      userSetStatus = "READY_TO_VERIFY";
    } else if (actor === "USER") {
      userSetStatus = newStatus;
    } else if (actor === "SYSTEM") {
      systemVerifiedStatus = newStatus;
    }

    const now = new Date().toISOString();
    const history = [...item.history];
    history.push({
      timestamp: now,
      actor,
      action: `STATUS_CHANGE_TO_${effectiveNewStatus}`,
      fromStatus,
      toStatus: effectiveNewStatus,
      details: details || `Status changed from ${fromStatus} to ${effectiveNewStatus} by ${actor}.`,
    });

    return {
      ...item,
      status: effectiveNewStatus,
      userSetStatus,
      systemVerifiedStatus,
      history,
      updatedAt: now,
    };
  }

  /**
   * Assigns an action item.
   */
  public assignItem(item: ActionItem, assigneeName: string | null, actor = "USER"): ActionItem {
    const now = new Date().toISOString();
    const history = [...item.history];
    history.push({
      timestamp: now,
      actor,
      action: "ASSIGNED",
      details: assigneeName ? `Assigned to ${assigneeName}.` : `Assignment cleared.`,
    });

    return {
      ...item,
      assigneeName,
      updatedAt: now,
      history,
    };
  }

  /**
   * Sets a due date.
   */
  public setDueDate(item: ActionItem, dueDate: string | null, actor = "USER"): ActionItem {
    const now = new Date().toISOString();
    const history = [...item.history];
    history.push({
      timestamp: now,
      actor,
      action: "SET_DUE_DATE",
      details: dueDate ? `Due date set to ${dueDate}.` : `Due date removed.`,
    });

    return {
      ...item,
      dueDate,
      updatedAt: now,
      history,
    };
  }

  /**
   * Sets or clears a priority override.
   */
  public setPriorityOverride(
    item: ActionItem,
    userPriority: ActionItemPriority | null,
    actor = "USER"
  ): ActionItem {
    const now = new Date().toISOString();
    const effectivePriority = userPriority || item.systemPriority;
    const history = [...item.history];
    history.push({
      timestamp: now,
      actor,
      action: "PRIORITY_OVERRIDE",
      details: userPriority
        ? `User overrode priority to ${userPriority} (system recommended ${item.systemPriority}).`
        : `User cleared priority override. Reverted to system priority ${item.systemPriority}.`,
    });

    return {
      ...item,
      userPriority,
      effectivePriority,
      updatedAt: now,
      history,
    };
  }

  /**
   * Adds a note to an action item.
   */
  public addNote(item: ActionItem, author: string, text: string): ActionItem {
    const now = new Date().toISOString();
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newNote = { noteId, author, timestamp: now, text };

    return {
      ...item,
      notes: [...item.notes, newNote],
      updatedAt: now,
    };
  }

  /**
   * Sets an explicit blocker on an action item.
   */
  public setBlocker(
    item: ActionItem,
    blockerReason: BlockerReason | null,
    blockerDetail: string | null,
    actor = "USER"
  ): ActionItem {
    const now = new Date().toISOString();
    const history = [...item.history];

    if (blockerReason) {
      history.push({
        timestamp: now,
        actor,
        action: "BLOCKED",
        fromStatus: item.status,
        toStatus: "BLOCKED",
        details: `Blocked due to ${blockerReason}: ${blockerDetail || "No additional detail provided."}`,
      });

      return {
        ...item,
        status: "BLOCKED",
        blockerReason,
        blockerDetail,
        updatedAt: now,
        history,
      };
    } else {
      // Unblock -> return to IN_PROGRESS
      history.push({
        timestamp: now,
        actor,
        action: "UNBLOCKED",
        fromStatus: "BLOCKED",
        toStatus: "IN_PROGRESS",
        details: `Blocker cleared. Resumed to IN_PROGRESS.`,
      });

      return {
        ...item,
        status: "IN_PROGRESS",
        blockerReason: null,
        blockerDetail: null,
        updatedAt: now,
        history,
      };
    }
  }

  /**
   * Executes live targeted verification on an action item.
   */
  public async verifyActionItem(item: ActionItem): Promise<ActionItem> {
    const now = new Date().toISOString();

    if (item.sourceType === "SEO_FINDING") {
      const ruleId = item.sourceId;
      const targetUrl = item.affectedUrls[0];

      if (!targetUrl) {
        return this.updateItemStatus(item, "NOT_FIXED", "SYSTEM", "No target URL available to verify.");
      }

      // Execute targeted single resource verification
      const verifyRes = await verifySingleResource(ruleId, {
        url: targetUrl,
        occurrences: item.occurrences,
      });

      const history = [...item.history];
      let newStatus: ActionItemStatus = "NOT_FIXED";
      let resolvedCount = 0;
      let remainingCount = item.totalOccurrences;

      if (verifyRes.isFixed || verifyRes.status === "VERIFIED_FIXED") {
        newStatus = "VERIFIED_FIXED";
        resolvedCount = item.totalOccurrences;
        remainingCount = 0;
      } else if (verifyRes.status === "PARTIALLY_FIXED" || (verifyRes.occurrenceDiff && verifyRes.occurrenceDiff.fixedCount > 0)) {
        newStatus = "PARTIALLY_FIXED";
        resolvedCount = verifyRes.occurrenceDiff?.fixedCount || 1;
        remainingCount = Math.max(1, item.totalOccurrences - resolvedCount);
      } else {
        newStatus = "NOT_FIXED";
        resolvedCount = 0;
        remainingCount = item.totalOccurrences;
      }

      history.push({
        timestamp: now,
        actor: "SYSTEM_VERIFIER",
        action: `VERIFICATION_${newStatus}`,
        fromStatus: item.status,
        toStatus: newStatus,
        details: verifyRes.message || `Live verification produced ${newStatus}.`,
      });

      return {
        ...item,
        status: newStatus,
        systemVerifiedStatus: newStatus,
        lastVerifiedAt: now,
        resolvedOccurrences: resolvedCount,
        remainingOccurrences: remainingCount,
        lastVerificationEvidence: verifyRes,
        history,
        updatedAt: now,
      };
    }

    // For AI Optimization / Competitive items, mark ready to verify or manually confirmed if no direct HTTP verifier
    return this.updateItemStatus(
      item,
      "READY_TO_VERIFY",
      "SYSTEM",
      "AI item queued for measurement re-evaluation."
    );
  }

  /**
   * Computes summary metrics for the remediation queue.
   */
  public computeQueueSummary(projectId: string, items: ActionItem[]): WorkflowQueueSummary {
    let openCount = 0;
    let inProgressCount = 0;
    let readyToVerifyCount = 0;
    let verifiedFixedCount = 0;
    let partiallyFixedCount = 0;
    let blockedCount = 0;
    let wontFixCount = 0;
    let criticalHighOpenCount = 0;

    let totalOriginalOccurrences = 0;
    let resolvedOriginalOccurrences = 0;
    let remainingOccurrences = 0;

    for (const item of items) {
      totalOriginalOccurrences += item.totalOccurrences;
      resolvedOriginalOccurrences += item.resolvedOccurrences;
      remainingOccurrences += item.remainingOccurrences;

      switch (item.status) {
        case "OPEN":
        case "REOPENED":
          openCount++;
          if (item.effectivePriority === "CRITICAL" || item.effectivePriority === "HIGH") {
            criticalHighOpenCount++;
          }
          break;
        case "IN_PROGRESS":
          inProgressCount++;
          if (item.effectivePriority === "CRITICAL" || item.effectivePriority === "HIGH") {
            criticalHighOpenCount++;
          }
          break;
        case "READY_TO_VERIFY":
          readyToVerifyCount++;
          break;
        case "VERIFIED_FIXED":
        case "MANUALLY_CONFIRMED":
          verifiedFixedCount++;
          break;
        case "PARTIALLY_FIXED":
          partiallyFixedCount++;
          if (item.effectivePriority === "CRITICAL" || item.effectivePriority === "HIGH") {
            criticalHighOpenCount++;
          }
          break;
        case "BLOCKED":
          blockedCount++;
          break;
        case "WONT_FIX":
          wontFixCount++;
          break;
        default:
          openCount++;
      }
    }

    return {
      projectId,
      totalActionItems: items.length,
      openCount,
      inProgressCount,
      readyToVerifyCount,
      verifiedFixedCount,
      partiallyFixedCount,
      blockedCount,
      wontFixCount,
      criticalHighOpenCount,
      totalOriginalOccurrences,
      resolvedOriginalOccurrences,
      remainingOccurrences,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Filters and sorts action items.
   */
  public filterActionItems(items: ActionItem[], filters: WorkflowFilterOptions = {}): ActionItem[] {
    return items.filter((item) => {
      if (filters.status) {
        if (filters.status === "ALL_OPEN") {
          if (item.status === "VERIFIED_FIXED" || item.status === "WONT_FIX" || item.status === "MANUALLY_CONFIRMED") {
            return false;
          }
        } else if (item.status !== filters.status) {
          return false;
        }
      }

      if (filters.priority && item.effectivePriority !== filters.priority) {
        return false;
      }

      if (filters.category && item.category !== filters.category) {
        return false;
      }

      if (filters.sourceType && item.sourceType !== filters.sourceType) {
        return false;
      }

      if (filters.assignee && item.assigneeName !== filters.assignee) {
        return false;
      }

      if (filters.isBlocked !== undefined) {
        const isItemBlocked = item.status === "BLOCKED" || item.blockerReason !== null;
        if (isItemBlocked !== filters.isBlocked) return false;
      }

      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.sourceId.toLowerCase().includes(q) ||
          item.affectedUrls.some((u) => u.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }

  // --- Priority Calculation Helpers ---
  private calculateSystemPriority(ruleId: string, severity?: string, affectedCount = 1): ActionItemPriority {
    const sev = (severity || "").toUpperCase();
    const id = ruleId.toUpperCase();

    if (
      sev === "CRITICAL" ||
      id.includes("ROBOTS_BLOCK") ||
      id.includes("HTTP_5XX") ||
      id.includes("NOINDEX_ON_HOMEPAGE")
    ) {
      return "CRITICAL";
    }

    if (
      sev === "HIGH" ||
      id.includes("TITLE_TAG_MISSING") ||
      id.includes("TECH_MISSING_CANONICAL") ||
      id.includes("ACCESSIBILITY_UNLABELLED") ||
      (id.includes("BROKEN_INTERNAL_LINK") && affectedCount > 5)
    ) {
      return "HIGH";
    }

    if (
      sev === "MEDIUM" ||
      id.includes("SKIPPED_HEADINGS") ||
      id.includes("META_DESCRIPTION") ||
      id.includes("IMAGES_MISSING_ALT") ||
      id.includes("STRUCTURED_DATA")
    ) {
      return "MEDIUM";
    }

    return "LOW";
  }

  private explainPriority(ruleId: string, priority: ActionItemPriority, count: number): string {
    switch (priority) {
      case "CRITICAL":
        return `Critical severity: Directly impairs search engine crawling, indexation, or core site availability.`;
      case "HIGH":
        return `High impact: Significant ranking signal, accessibility compliance requirement, or affects ${count} important page(s).`;
      case "MEDIUM":
        return `Medium impact: On-page structural optimization and search snippet enhancement across ${count} page(s).`;
      case "LOW":
        return `Low impact: Minor technical hygiene improvement across ${count} element(s).`;
    }
  }
}
