import { describe, it, expect, beforeEach } from 'vitest';
import {
  AutomationEngine,
  DEFAULT_AUTOMATION_POLICY,
  generateInputAwareIdempotencyKey,
  createFencingLock,
  verifyFencingLock,
  evaluateProviderFreshness,
  evaluateVerificationTiming,
  evaluateAdapterCapabilities,
  evaluatePreconditionVersion,
  bindApprovalToMutation,
  executeDryRunSafely,
  evaluateSafeModeScale,
  AutomationPolicy,
  ExecutionProposal,
  ApprovalBinding,
  ExternalAuditReference,
  DeadLetterQueueItem,
  JobExecutionContext
} from '../index';

describe('Phase 23 Final Certification Hardening — Test Matrix (Tests A through BH)', () => {
  let policy: AutomationPolicy;

  beforeEach(() => {
    // Fresh default policy clone for each test
    policy = JSON.parse(JSON.stringify(DEFAULT_AUTOMATION_POLICY));
  });

  // A. Contextual freshness policy
  it('Test A: Contextual freshness policy exposes policyUsed, thresholdsUsed, reason, and policyVersion', () => {
    const result = evaluateProviderFreshness('gsc', 10, policy);
    expect(result.freshnessState).toBe('FRESH');
    expect(result.policyUsed).toBe(policy.name);
    expect(result.policyVersion).toBe(policy.version);
    expect(result.thresholdsUsed.freshnessMaxHours).toBe(72);
    expect(result.reason).toContain('within fresh threshold');
  });

  // B. Provider-specific freshness (GSC vs Backlinks vs CrUX)
  it('Test B: Provider-specific freshness handles 72h GSC, 168h backlinks, and 336h CrUX correctly', () => {
    // 80 hours old:
    // GSC (max 72h) -> STALE
    // Backlinks (max 168h) -> FRESH
    // CrUX (max 336h) -> FRESH
    const gscEval = evaluateProviderFreshness('gsc', 80, policy);
    expect(gscEval.freshnessState).toBe('STALE');

    const backlinkEval = evaluateProviderFreshness('backlinks', 80, policy);
    expect(backlinkEval.freshnessState).toBe('FRESH');

    const cruxEval = evaluateProviderFreshness('crux', 200, policy);
    expect(cruxEval.freshnessState).toBe('FRESH');

    const cruxStale = evaluateProviderFreshness('crux', 400, policy);
    expect(cruxStale.freshnessState).toBe('STALE');
  });

  // C. Freshness vs completeness
  it('Test C: Freshness vs completeness evaluates COMPLETE, PARTIAL, and UNKNOWN data states', () => {
    const freshPartial = evaluateProviderFreshness('gsc', 5, policy, 'PARTIAL');
    expect(freshPartial.freshnessState).toBe('FRESH');
    expect(freshPartial.completenessState).toBe('PARTIAL');

    const staleComplete = evaluateProviderFreshness('gsc', 100, policy, 'COMPLETE');
    expect(staleComplete.freshnessState).toBe('STALE');
    expect(staleComplete.completenessState).toBe('COMPLETE');
  });

  // D. Notification policy separation
  it('Test D: Notification policy separates autonomy mode from notification rules', () => {
    expect(policy.notificationPolicy).toBe('MATERIAL_CHANGES');
    const engine = new AutomationEngine({ ...policy, notificationPolicy: 'CRITICAL_ONLY' });
    const alerts = engine.evaluateAlerts([
      {
        id: 'alt-1',
        projectId: 'proj-1',
        title: 'Minor wording change',
        description: 'Notice',
        operationalUrgency: 'LOW',
        seoSeverity: 'LOW',
        ruleId: 'META_DESC_LENGTH',
        isMaterialChange: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'alt-2',
        projectId: 'proj-1',
        title: 'Critical drop',
        description: 'Disaster',
        operationalUrgency: 'EMERGENCY',
        seoSeverity: 'CRITICAL',
        ruleId: 'CANONICAL_POINTS_404',
        isMaterialChange: true,
        createdAt: new Date().toISOString()
      }
    ]);
    expect(alerts.length).toBe(1);
    expect(alerts[0].id).toBe('alt-2');
  });

  // E. Minimal AUTO_SAFE allowlist
  it('Test E: Strict minimal allowlist is empty or strictly scoped by default, not inheriting all 93 handlers', () => {
    expect(policy.execution.safeAutoExecuteAllowlist.length).toBe(0);
    const engine = new AutomationEngine(policy);
    // Non-allowlisted action must produce REQUIRE_APPROVAL, not AUTO_SAFE
    const proposal: ExecutionProposal = {
      actionId: 'act-1',
      projectId: 'proj-1',
      actionType: 'FIX_CANONICAL',
      targetUrls: ['https://example.com/p1'],
      riskLevel: 'LOW',
      impactScore: 80,
      confidenceScore: 0.95,
      requiresAdapter: 'wordpress',
      actionVersion: 'rev-1',
      mutationDigest: 'hash-abc',
      isHomogeneous: true
    };
    const gate = engine.evaluateActionGovernance(proposal);
    expect(gate.executionMode).toBe('REQUIRE_APPROVAL');
  });

  // F. Fix Intelligence != permission
  it('Test F: Fix Intelligence diagnostic availability does not imply automated execution permission', () => {
    const proposal: ExecutionProposal = {
      actionId: 'act-meta',
      projectId: 'proj-1',
      actionType: 'FIX_META_TITLE',
      targetUrls: ['https://example.com/'],
      riskLevel: 'LOW',
      impactScore: 90,
      confidenceScore: 0.99,
      actionVersion: 'v1',
      mutationDigest: 'digest-1',
      isHomogeneous: true
    };
    const engine = new AutomationEngine(policy);
    const result = engine.evaluateActionGovernance(proposal);
    // Even if confidence is 0.99 and risk is LOW, unless allowlisted, it requires approval
    expect(result.executionMode).toBe('REQUIRE_APPROVAL');
    expect(result.allowedToAutoExecute).toBe(false);
  });

  // G. Adapter capability contract
  it('Test G: Adapter capability contract enumerates all 10 required operational capabilities', () => {
    const capabilities = evaluateAdapterCapabilities('wordpress', [
      'READ', 'WRITE', 'DRY_RUN', 'VERSION_CHECK', 'ROLLBACK',
      'ATOMIC_SINGLE_WRITE', 'ATOMIC_BATCH', 'PARTIAL_BATCH_RECOVERY',
      'TEMPLATE_WRITE', 'PUBLISH_REQUIRED'
    ]);
    expect(capabilities.length).toBe(10);
    expect(capabilities).toContain('ATOMIC_BATCH');
    expect(capabilities).toContain('VERSION_CHECK');
  });

  // H. Capability gating
  it('Test H: Capability gating rejects execution with EXECUTION_CAPABILITY_UNAVAILABLE when adapter lacks capability', () => {
    const proposal: ExecutionProposal = {
      actionId: 'act-templ',
      projectId: 'proj-1',
      actionType: 'UPDATE_TEMPLATE',
      targetUrls: ['https://example.com/'],
      riskLevel: 'MEDIUM',
      impactScore: 80,
      confidenceScore: 0.9,
      requiresAdapter: 'custom-static',
      actionVersion: 'v1',
      mutationDigest: 'd1',
      isHomogeneous: true
    };
    const engine = new AutomationEngine(policy);
    // custom-static only supports READ and DRY_RUN
    const check = engine.verifyAdapterSupport(proposal, ['READ', 'DRY_RUN'], ['WRITE', 'TEMPLATE_WRITE']);
    expect(check.canExecute).toBe(false);
    expect(check.status).toBe('EXECUTION_CAPABILITY_UNAVAILABLE');
  });

  // I. Version/hash precondition
  it('Test I: Version / ETag precondition mismatch returns ACTION_STATE_STALE', () => {
    const check = evaluatePreconditionVersion('rev-old-123', 'rev-new-456');
    expect(check.isValid).toBe(false);
    expect(check.status).toBe('ACTION_STATE_STALE');
    expect(check.reason).toContain('Precondition version mismatch');
  });

  // J. Contextual approval expiry
  it('Test J: Contextual approval expiry checks against dynamic policy rather than hardcoded 14 days', () => {
    const customPolicy: AutomationPolicy = {
      ...policy,
      execution: {
        ...policy.execution,
        approvalExpiryHours: 48 // 2 days
      }
    };
    const engine = new AutomationEngine(customPolicy);
    const createdAt = new Date(Date.now() - 50 * 3600 * 1000).toISOString(); // 50 hours old
    const binding: ApprovalBinding = {
      approvalId: 'app-1',
      proposalId: 'prop-1',
      actionVersion: 'v1',
      targetUrls: ['https://example.com/'],
      mutationDigest: 'digest-1',
      approvedBy: 'seo-lead',
      approvedAt: createdAt,
      expiresAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      status: 'EXPIRED'
    };
    const valid = engine.validateApprovalBinding(binding, 'digest-1', 'v1');
    expect(valid.isValid).toBe(false);
    expect(valid.reason).toBe('Approval has expired');
  });

  // K. Approval revocation
  it('Test K: Approval revocation transitions approval to APPROVAL_REVOKED and prevents execution', () => {
    const binding: ApprovalBinding = {
      approvalId: 'app-rev',
      proposalId: 'prop-1',
      actionVersion: 'v1',
      targetUrls: ['https://example.com/'],
      mutationDigest: 'digest-1',
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'REVOKED'
    };
    const engine = new AutomationEngine(policy);
    const res = engine.validateApprovalBinding(binding, 'digest-1', 'v1');
    expect(res.isValid).toBe(false);
    expect(res.status).toBe('APPROVAL_REVOKED');
  });

  // L. Approval mutation binding
  it('Test L: Approval mutation binding rejects execution if mutationDigest or URLs change', () => {
    const binding: ApprovalBinding = {
      approvalId: 'app-bind',
      proposalId: 'prop-1',
      actionVersion: 'v1',
      targetUrls: ['https://example.com/page-a'],
      mutationDigest: 'hash-correct-111',
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'APPROVED'
    };
    const engine = new AutomationEngine(policy);
    const checkTampered = engine.validateApprovalBinding(binding, 'hash-tampered-222', 'v1');
    expect(checkTampered.isValid).toBe(false);
    expect(checkTampered.status).toBe('MUTATION_DIGEST_MISMATCH');
  });

  // M. Bulk approval homogeneity
  it('Test M: Bulk approval rejects non-homogeneous action proposals without explicit per-action binding', () => {
    const heterogeneousProposal: ExecutionProposal = {
      actionId: 'act-hetero',
      projectId: 'proj-1',
      actionType: 'BULK_MULTI_FIX',
      targetUrls: ['https://example.com/a', 'https://example.com/b'],
      riskLevel: 'HIGH',
      impactScore: 85,
      confidenceScore: 0.9,
      actionVersion: 'v1',
      mutationDigest: 'digest-hetero',
      isHomogeneous: false
    };
    const engine = new AutomationEngine(policy);
    const gate = engine.evaluateActionGovernance(heterogeneousProposal);
    expect(gate.requiresIndividualApproval).toBe(true);
  });

  // N. Dry-run semantics
  it('Test N: Dry-run guarantees PLANNED_MUTATION with mutationEquivalenceGuaranteed disclosure', () => {
    const dryRun = executeDryRunSafely({
      actionId: 'act-dry',
      proposedChanges: [{ field: 'meta_title', before: 'Old Title', after: 'New Title' }]
    });
    expect(dryRun.state).toBe('PLANNED_MUTATION');
    expect(dryRun.mutationEquivalenceGuaranteed).toBe(true);
    expect(dryRun.preview[0].field).toBe('meta_title');
  });

  // O. Contextual canary size
  it('Test O: Contextual canary size scales with site scale rather than fixed 5 URLs', () => {
    const engine = new AutomationEngine(policy);
    // 10,000 URL site -> 5% canary -> 500 URLs (capped at maxCanaryUrls 100)
    const canaryLarge = engine.calculateCanaryBatchSize(10000);
    expect(canaryLarge.canarySize).toBe(100);
    expect(canaryLarge.strategy).toBe('PERCENTAGE_OF_SITE');

    // 20 URL site -> 5% = 1 URL (minCanaryUrls 2)
    const canarySmall = engine.calculateCanaryBatchSize(20);
    expect(canarySmall.canarySize).toBe(2);
  });

  // P. Canary success criteria
  it('Test P: Canary success criteria mandates zero critical regression and >=95% valid status codes', () => {
    const engine = new AutomationEngine(policy);
    const passingCanary = engine.evaluateCanaryResults({
      testedUrls: 10,
      successCount: 10,
      criticalErrors: 0,
      performanceRegressionMs: 15
    });
    expect(passingCanary.passed).toBe(true);
    expect(passingCanary.canaryDecision).toBe('PROCEED_TO_FULL_ROLLOUT');

    const failingCanary = engine.evaluateCanaryResults({
      testedUrls: 10,
      successCount: 8,
      criticalErrors: 2,
      performanceRegressionMs: 500
    });
    expect(failingCanary.passed).toBe(false);
    expect(failingCanary.canaryDecision).toBe('HALT_AND_ROLLBACK');
  });

  // Q. Propagation-aware verification
  it('Test Q: Propagation-aware verification emits VERIFICATION_WAITING_FOR_PROPAGATION for CDN/edge changes', () => {
    const timing = evaluateVerificationTiming('EDGE_HEADER_MODIFICATION', 5, 60);
    expect(timing.timingState).toBe('VERIFICATION_WAITING_FOR_PROPAGATION');
    expect(timing.delayReason).toContain('Edge/CDN propagation latency');
  });

  // R. Immediate vs delayed verification
  it('Test R: Separates IMMEDIATE_TECHNICAL_VERIFICATION from DELAYED_SEARCH_PROVIDER_VERIFICATION', () => {
    const immediate = evaluateVerificationTiming('ROBOTS_TXT_DISALLOW', 0, 0);
    expect(immediate.timingState).toBe('IMMEDIATE_TECHNICAL_VERIFICATION');

    const delayed = evaluateVerificationTiming('SERP_INDEXING_CHECK', 10, 2880);
    expect(delayed.timingState).toBe('DELAYED_SEARCH_PROVIDER_VERIFICATION');
  });

  // S. Verification transient failure
  it('Test S: Transient probe network timeouts return DATA_NOT_READY rather than marking action as failed', () => {
    const engine = new AutomationEngine(policy);
    const verify = engine.evaluateProbeResult({ status: 'TIMEOUT', isTransient: true, httpCode: 0 });
    expect(verify.verificationStatus).toBe('DATA_NOT_READY');
    expect(verify.actionMarkedAsFailed).toBe(false);
  });

  // T. Rollback capability states
  it('Test T: Rollback capability exposes ROLLBACK_FULLY_SUPPORTED, ROLLBACK_BEST_EFFORT, ROLLBACK_MANUAL, and ROLLBACK_UNAVAILABLE', () => {
    const engine = new AutomationEngine(policy);
    const full = engine.getRollbackCapability('wordpress');
    expect(full).toBe('ROLLBACK_FULLY_SUPPORTED');

    const none = engine.getRollbackCapability('ftp_legacy_upload');
    expect(none).toBe('ROLLBACK_UNAVAILABLE');
  });

  // U. Rollback storage truth
  it('Test U: Rollback snapshots declare RUNTIME_IMMUTABLE guarantee and verify before/after state persistence', () => {
    const engine = new AutomationEngine(policy);
    const snapshot = engine.createSnapshot('proj-1', { url: 'https://example.com', title: 'Original Title' });
    expect(snapshot.storageGuarantee).toBe('RUNTIME_IMMUTABLE');
    expect(snapshot.snapshotData.title).toBe('Original Title');
  });

  // V. Atomicity states
  it('Test V: Multi-URL execution tracks ATOMIC, PARTIALLY_ATOMIC, and NON_ATOMIC execution states', () => {
    const engine = new AutomationEngine(policy);
    const atomicRes = engine.evaluateBatchAtomicity('shopify', 5, 5);
    expect(atomicRes.atomicityState).toBe('ATOMIC');

    const partialRes = engine.evaluateBatchAtomicity('custom_api', 3, 5);
    expect(partialRes.atomicityState).toBe('PARTIALLY_ATOMIC');
  });

  // W. Partial execution recovery
  it('Test W: Partial execution provides exact success/failure URL lists and recovery instructions', () => {
    const engine = new AutomationEngine(policy);
    const recovery = engine.generatePartialBatchRecovery([
      { url: 'https://example.com/1', status: 'SUCCESS' },
      { url: 'https://example.com/2', status: 'FAILED', error: 'HTTP 500' }
    ]);
    expect(recovery.successfulUrls).toContain('https://example.com/1');
    expect(recovery.failedUrls).toContain('https://example.com/2');
    expect(recovery.recoveryStrategy).toBe('RETRY_FAILED_SUBSET_ONLY');
  });

  // X. Input-aware idempotency
  it('Test X: generateInputAwareIdempotencyKey includes projectId, automationType, unit, unitId, inputDigest, and policyVersion', () => {
    const key = generateInputAwareIdempotencyKey({
      projectId: 'proj-seo-1',
      automationType: 'CRAWL_REFRESH',
      unit: 'PAGE',
      unitId: 'https://example.com/product',
      inputDigest: 'abc123hash',
      policyVersion: '1.1.0'
    });
    expect(key).toBe('proj-seo-1:CRAWL_REFRESH:PAGE:https://example.com/product:abc123hash:1.1.0');
  });

  // Y. Duplicate audit reference
  it('Test Y: Duplicate incoming audit requests reference existing execution without duplicating load', () => {
    const engine = new AutomationEngine(policy);
    const ref: ExternalAuditReference = {
      originalJobId: 'job-100',
      idempotencyKey: 'proj-1:CRAWL:SITE:root:hash:1.1.0',
      status: 'IN_PROGRESS',
      firstSeenAt: new Date().toISOString()
    };
    const dedupe = engine.handleDuplicateAuditRequest(ref);
    expect(dedupe.actionTaken).toBe('ATTACH_TO_EXISTING_EXECUTION');
    expect(dedupe.jobId).toBe('job-100');
  });

  // Z. Fencing/lock safety
  it('Test Z: Fencing lock with monotonic generation token rejects stale workers', () => {
    const lock = createFencingLock('resource-canonical-1', 1);
    expect(verifyFencingLock(lock, 1)).toBe(true);
    expect(verifyFencingLock(lock, 0)).toBe(false);
  });

  // AA. Provider-specific retry semantics
  it('Test AA: Provider-specific retry semantics handle 429 rate limit differently from 503 service unavailable', () => {
    const engine = new AutomationEngine(policy);
    const rateLimit = engine.evaluateProviderError('gsc', 429);
    expect(rateLimit.retryRecommended).toBe(true);
    expect(rateLimit.backoffStrategy).toBe('EXPONENTIAL_WITH_JITTER');

    const authError = engine.evaluateProviderError('gsc', 401);
    expect(authError.retryRecommended).toBe(false);
    expect(authError.failureClassification).toBe('PERMANENT_AUTH_FAILURE');
  });

  // AB. Circuit breaker policy
  it('Test AB: Circuit breaker opens on consecutive failures and enters HALF_OPEN on timeout expiration', () => {
    const engine = new AutomationEngine(policy);
    for (let i = 0; i < 5; i++) {
      engine.recordProviderFailure('ahrefs');
    }
    expect(engine.getProviderCircuitBreakerState('ahrefs')).toBe('OPEN');
    // Simulate reset cooldown
    engine.resetProviderCircuitBreakerCooldown('ahrefs');
    expect(engine.getProviderCircuitBreakerState('ahrefs')).toBe('HALF_OPEN');
  });

  // AC. Unconfigured budget
  it('Test AC: Unconfigured budget returns BUDGET_UNCONFIGURED without breaking execution flow', () => {
    const noBudgetPolicy: AutomationPolicy = {
      ...policy,
      budget: {
        costEstimationConfidence: 'BUDGET_UNCONFIGURED',
        maxMonthlyCostUsd: undefined,
        hardCapStop: false
      }
    };
    const engine = new AutomationEngine(noBudgetPolicy);
    const budgetStatus = engine.evaluateBudgetState(15.5);
    expect(budgetStatus.confidence).toBe('BUDGET_UNCONFIGURED');
    expect(budgetStatus.isBlocked).toBe(false);
  });

  // AD. Estimated-vs-actual cost
  it('Test AD: Estimated-vs-actual cost tracking prevents billing overruns', () => {
    const engine = new AutomationEngine(policy);
    const costEval = engine.evaluateCostCap(45.0, 10.0, 50.0); // current 45 + next 10 = 55 > cap 50
    expect(costEval.exceedsCap).toBe(true);
    expect(costEval.verdict).toBe('HALT_JOB_PREVENT_OVERRUN');
  });

  // AE. Alert materiality
  it('Test AE: Filters noise by classifying material vs non-material changes according to policy', () => {
    const engine = new AutomationEngine(policy);
    expect(engine.isMaterialAlert({ seoSeverity: 'LOW', rankDrop: 1, isMaterialChange: false })).toBe(false);
    expect(engine.isMaterialAlert({ seoSeverity: 'HIGH', rankDrop: 15, isMaterialChange: true })).toBe(true);
  });

  // AF. Contextual cooldown
  it('Test AF: Contextual cooldown suppresses duplicate alerts within the same cooldown window', () => {
    const engine = new AutomationEngine(policy);
    const alert1 = engine.processAlertCooldown('proj-1', 'TITLE_MISSING', 'https://example.com/p1');
    expect(alert1.suppressed).toBe(false);

    const alert2 = engine.processAlertCooldown('proj-1', 'TITLE_MISSING', 'https://example.com/p1');
    expect(alert2.suppressed).toBe(true);
    expect(alert2.reason).toBe('ALERT_IN_COOLDOWN');
  });

  // AG. Positive resolution evidence
  it('Test AG: Alert resolution requires positive fix evidence, not merely missing/failed provider data', () => {
    const engine = new AutomationEngine(policy);
    const resWithNoData = engine.evaluateAlertResolution({ providerReturnedData: false, issueFound: false });
    expect(resWithNoData.resolved).toBe(false);
    expect(resWithNoData.reason).toBe('CANNOT_RESOLVE_DUE_TO_MISSING_DATA');

    const resWithPositiveData = engine.evaluateAlertResolution({ providerReturnedData: true, issueFound: false });
    expect(resWithPositiveData.resolved).toBe(true);
  });

  // AH. Reopen identity
  it('Test AH: Reopened alerts preserve original issue ID and lineage across regression lifecycles', () => {
    const engine = new AutomationEngine(policy);
    const reopened = engine.reopenAlert('alt-101', 'CANONICAL_POINTS_404', 'https://example.com/page');
    expect(reopened.alertId).toBe('alt-101');
    expect(reopened.reopenCount).toBe(1);
    expect(reopened.lineagePreserved).toBe(true);
  });

  // AI. Operational-vs-SEO severity
  it('Test AI: Separates operational urgency (INFRASTRUCTURE) from SEO ranking severity (METRICS)', () => {
    const engine = new AutomationEngine(policy);
    const alert = engine.createStructuredAlert({
      operationalUrgency: 'HIGH', // Cloudflare rate limited
      seoSeverity: 'LOW',         // Minor keyword position drift
      ruleId: 'RATE_LIMIT_HIT'
    });
    expect(alert.operationalUrgency).toBe('HIGH');
    expect(alert.seoSeverity).toBe('LOW');
  });

  // AJ. Expected mass change (deployment context)
  it('Test AJ: Expected deployment migrations suppress false-positive site-wide safe mode alerts', () => {
    const safeMode = evaluateSafeModeScale({
      totalUrlsCrawled: 1000,
      disappearedUrls: 400,
      new404Urls: 0,
      deploymentInProgress: true
    }, policy);
    expect(safeMode.safeModeActive).toBe(false);
    expect(safeMode.confidence).toBe('INSUFFICIENT_EVIDENCE');
    expect(safeMode.reason).toContain('deployment in progress');
  });

  // AK. Deployment context
  it('Test AK: Explicit deployment context tags audit execution as PLANNED_MIGRATION', () => {
    const engine = new AutomationEngine(policy);
    const runCtx = engine.createExecutionContext({ isDeploymentMigration: true });
    expect(runCtx.contextType).toBe('PLANNED_MIGRATION');
  });

  // AL. Safe mode trigger taxonomy
  it('Test AL: Safe mode trigger taxonomy classifies SAFE_MODE_TRIGGER_CONFIRMED vs SAFE_MODE_TRIGGER_REVIEW', () => {
    // 30% disappeared (> 15% threshold) with no deployment context -> CONFIRMED
    const confirmed = evaluateSafeModeScale({
      totalUrlsCrawled: 1000,
      disappearedUrls: 300,
      new404Urls: 0,
      deploymentInProgress: false
    }, policy);
    expect(confirmed.confidence).toBe('SAFE_MODE_TRIGGER_CONFIRMED');
    expect(confirmed.safeModeActive).toBe(true);

    // 12% disappeared (< 15% threshold) -> REVIEW / Normal
    const review = evaluateSafeModeScale({
      totalUrlsCrawled: 1000,
      disappearedUrls: 120,
      new404Urls: 0,
      deploymentInProgress: false
    }, policy);
    expect(review.safeModeActive).toBe(false);
    expect(review.confidence).toBe('SAFE_MODE_TRIGGER_REVIEW');
  });

  // AM. Safe mode scope
  it('Test AM: Safe mode pauses only affected scope: PROJECT_MUTATIONS_PAUSED, ADAPTER_PAUSED, or SITEWIDE_PAUSED', () => {
    const engine = new AutomationEngine(policy);
    const scopeAction = engine.evaluateSafeModeScope('WORDPRESS_ADAPTER_ERROR');
    expect(scopeAction.activeScope).toBe('ADAPTER_PAUSED');
    expect(scopeAction.pausedAdapters).toContain('wordpress');

    const globalScope = engine.evaluateSafeModeScope('MASS_DELETION');
    expect(globalScope.activeScope).toBe('PROJECT_MUTATIONS_PAUSED');
  });

  // AN. Safe mode revalidation
  it('Test AN: Safe mode revalidation automatically clears lock once healthy crawl passes verification', () => {
    const engine = new AutomationEngine(policy);
    engine.triggerSafeMode('PROJECT_MUTATIONS_PAUSED', 'High error rate');
    expect(engine.isSafeModeActive()).toBe(true);

    const reval = engine.revalidateSafeMode({ errorRatePercent: 0.5, urlsDisappeared: 0 });
    expect(reval.cleared).toBe(true);
    expect(engine.isSafeModeActive()).toBe(false);
  });

  // AO. Contextual scheduler
  it('Test AO: Contextual scheduler aligns crawl frequencies with site size and change frequency', () => {
    const engine = new AutomationEngine(policy);
    const scheduleLarge = engine.calculateNextScheduledRun(50000, 'DAILY');
    const scheduleSmall = engine.calculateNextScheduledRun(50, 'LOW_FREQUENCY');
    expect(scheduleLarge.intervalHours).toBeLessThan(scheduleSmall.intervalHours);
  });

  // AP. Budget-aware adaptive frequency
  it('Test AP: Adaptive scheduler decreases crawl frequency when API budget approaches threshold', () => {
    const engine = new AutomationEngine(policy);
    const adaptive = engine.calculateAdaptiveFrequency({ budgetConsumedPercent: 90, standardIntervalHours: 24 });
    expect(adaptive.adjustedIntervalHours).toBe(48); // throttled
  });

  // AQ. DST scheduling
  it('Test AQ: Cron scheduler handles daylight savings transitions cleanly via UTC normalization', () => {
    const engine = new AutomationEngine(policy);
    const utcNormalized = engine.normalizeScheduleTimeToUtc('2026-03-29T02:00:00', 'Europe/London');
    expect(utcNormalized).toContain('Z');
  });

  // AR. Stalled-job semantics
  it('Test AR: Stalled job detection evaluates both heartbeat timestamp and incremental progress counter', () => {
    const engine = new AutomationEngine(policy);
    const stalledContext: JobExecutionContext = {
      jobId: 'job-999',
      lastHeartbeatAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      processedUnits: 10,
      totalUnits: 1000,
      status: 'RUNNING'
    };
    const check = engine.checkJobLiveness(stalledContext, 1800); // 30 min timeout
    expect(check.isStalled).toBe(true);
    expect(check.action).toBe('TERMINATE_AND_FAILOVER');
  });

  // AS. Dead-letter recovery
  it('Test AS: Dead-letter queue retains failed jobs with failure context and allows replay', () => {
    const engine = new AutomationEngine(policy);
    const deadItem: DeadLetterQueueItem = {
      jobId: 'job-fail-1',
      actionType: 'ROBOTS_TXT_UPDATE',
      failureReason: 'Connection reset by peer',
      failedAt: new Date().toISOString(),
      payload: { rule: 'Disallow: /temp' }
    };
    engine.pushToDeadLetterQueue(deadItem);
    const item = engine.replayDeadLetterItem('job-fail-1');
    expect(item?.jobId).toBe('job-fail-1');
  });

  // AT. External/manual fix verification
  it('Test AT: Detects and credits externally applied fixes during scheduled verification sweeps', () => {
    const engine = new AutomationEngine(policy);
    const ext = engine.verifyExternalRemediation('RULE_NOINDEX_FIX', { hasNoIndexTag: false });
    expect(ext.resolvedExternally).toBe(true);
  });

  // AU. Access control
  it('Test AU: Role-based access control enforces VIEWER, OPERATOR, and ADMIN capabilities', () => {
    const engine = new AutomationEngine(policy);
    expect(engine.checkPermission('VIEWER', 'TRIGGER_MUTATION')).toBe(false);
    expect(engine.checkPermission('OPERATOR', 'TRIGGER_MUTATION')).toBe(true);
    expect(engine.checkPermission('ADMIN', 'MODIFY_POLICIES')).toBe(true);
  });

  // AV. Secret redaction
  it('Test AV: Redacts API keys, auth tokens, and passwords in all logs and reports', () => {
    const engine = new AutomationEngine(policy);
    const log = engine.formatLogEntry('Connecting with Bearer ya29.a0AfH6_SECRET_KEY_12345 to Google');
    expect(log).not.toContain('ya29.a0AfH6_SECRET_KEY_12345');
    expect(log).toContain('[REDACTED]');
  });

  // AW. Audit integrity
  it('Test AW: Audit records provide tamper-evident sequential hash chaining', () => {
    const engine = new AutomationEngine(policy);
    const entry1 = engine.appendAuditLog('action_1', null);
    const entry2 = engine.appendAuditLog('action_2', entry1.hash);
    expect(entry2.previousHash).toBe(entry1.hash);
  });

  // AX. No autonomy self-escalation
  it('Test AX: Engine prevents background tasks from modifying their own execution mode', () => {
    const engine = new AutomationEngine(policy);
    const attempt = engine.attemptModeEscalation('BACKGROUND_WORKER', 'AUTO_SAFE');
    expect(attempt.allowed).toBe(false);
    expect(attempt.error).toBe('SELF_ESCALATION_FORBIDDEN');
  });

  // AY. No self-modifying allowlist
  it('Test AY: Execution allowlist can only be mutated through certified admin config changes', () => {
    const engine = new AutomationEngine(policy);
    const res = engine.attemptAllowlistMutation('MUTATION_TASK', 'FIX_CANONICAL');
    expect(res.allowed).toBe(false);
  });

  // AZ. Phase 11 boundary
  it('Test AZ: Preserves Phase 11 Action Planning contract without mutating ROI or priority logic', () => {
    const engine = new AutomationEngine(policy);
    const plan = engine.integratePhase11ActionPlan({ actionId: 'act-11', estimatedRoi: 4.5, priorityScore: 92 });
    expect(plan.priorityScore).toBe(92);
  });

  // BA. Phase 17 boundary
  it('Test BA: Preserves Phase 17 Knowledge Graph & Content Demand integration contracts', () => {
    const engine = new AutomationEngine(policy);
    const kg = engine.integratePhase17KnowledgeGraph({ entityId: 'kg-1', confidence: 0.98 });
    expect(kg.entityId).toBe('kg-1');
  });

  // BB. Phase 19 boundary
  it('Test BB: Preserves Phase 19 Deep Diagnostic Intelligence boundaries', () => {
    const engine = new AutomationEngine(policy);
    const diag = engine.integratePhase19Diagnostics({ diagnosticRuleCount: 95 });
    expect(diag.diagnosticRuleCount).toBe(95);
  });

  // BC. Phase 20 boundary
  it('Test BC: Preserves Phase 20 AI Search Engines & Crawler Intelligence boundaries', () => {
    const engine = new AutomationEngine(policy);
    const aiCrawler = engine.integratePhase20AiCrawlerRegistry({ botName: 'GPTBot', allowed: true });
    expect(aiCrawler.botName).toBe('GPTBot');
  });

  // BD. Phase 21 boundary
  it('Test BD: Preserves Phase 21 Remediation Engine 95/95 Fix Intelligence contract', () => {
    const engine = new AutomationEngine(policy);
    const rem = engine.integratePhase21RemediationEngine({ totalRules: 95, totalHandlers: 93, manualReview: 2 });
    expect(rem.totalRules).toBe(95);
    expect(rem.totalHandlers).toBe(93);
    expect(rem.manualReview).toBe(2);
  });

  // BE. Phase 22 boundary
  it('Test BE: Preserves Phase 22 Autonomous SEO Experiments & Causal Engine integration', () => {
    const engine = new AutomationEngine(policy);
    const exp = engine.integratePhase22Experiments({ experimentId: 'exp-seo-1', methodology: 'SYNTHETIC_CONTROL' });
    expect(exp.methodology).toBe('SYNTHETIC_CONTROL');
  });

  // BF. Project isolation
  it('Test BF: Enforces strict multi-tenant isolation; actions in Project A cannot affect Project B', () => {
    const engine = new AutomationEngine(policy);
    engine.recordProviderFailure('gsc', 'proj-A');
    expect(engine.getProviderFailures('proj-A')).toBe(1);
    expect(engine.getProviderFailures('proj-B')).toBe(0);
  });

  // BG. Rule boundary (95 remains 95)
  it('Test BG: Certified production diagnostic rule count remains strictly 95 (0 added, 0 removed)', () => {
    const engine = new AutomationEngine(policy);
    expect(engine.getCertifiedProductionRuleCount()).toBe(95);
  });

  // BH. Report evidence
  it('Test BH: Automation report serialization includes comprehensive policy, verification, and audit metadata', () => {
    const engine = new AutomationEngine(policy);
    const report = engine.serializeReportMetadata();
    expect(report.policyVersion).toBe(policy.version);
    expect(report.safeModeActive).toBe(false);
    expect(report.engineStatus).toBe('READY');
  });
});
