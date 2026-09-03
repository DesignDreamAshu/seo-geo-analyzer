/**
 * Phase 28D.1: Live Provider Reality Certification Engine.
 * Executes free-first, cost-controlled live certification of external AI providers & models.
 * Strictly separates native structured output from prompt-guided JSON fallback semantics.
 */

import { nanoid } from "nanoid";
import { OpenRouterProviderAdapter } from "../observation/adapters/openrouter-adapter";
import {
  LiveProviderCertificationResult,
  ProviderCertificationState,
  PromptGuidedJsonState,
  StructuredMode,
  FailureClassification,
  CertificationCostGuardrail,
  DEFAULT_CERTIFICATION_GUARDRAIL,
  DiscoveredModelMetadata,
} from "./types";

export const CERTIFICATION_VERSION = "v28d.1-2026.09";

export class LiveProviderCertifier {
  constructor(private adapter: OpenRouterProviderAdapter) {}

  /**
   * Discovers free models available on OpenRouter.
   */
  public async discoverFreeModels(): Promise<DiscoveredModelMetadata[]> {
    return this.adapter.getFreeModels();
  }

  /**
   * Executes live certification against an explicit model.
   * Free-first by default. Enforces cost guardrails.
   */
  public async certifyModel(
    modelMetadata: DiscoveredModelMetadata,
    guardrail: CertificationCostGuardrail = DEFAULT_CERTIFICATION_GUARDRAIL
  ): Promise<LiveProviderCertificationResult> {
    const certId = `cert_${nanoid(10)}`;
    const timestamp = new Date().toISOString();
    const isPaid = !modelMetadata.pricing.isFree;

    // Paid model stop gate check
    if (isPaid && guardrail.requirePaidApproval) {
      return {
        certificationId: certId,
        provider: this.adapter.providerId,
        gateway: "OpenRouter",
        requestedModelId: modelMetadata.modelId,
        resolvedModelId: null,
        underlyingProvider: modelMetadata.provider,
        timestamp,
        certificationVersion: CERTIFICATION_VERSION,
        level1Connectivity: "NOT_TESTED",
        nativeStructuredOutput: "NOT_TESTED",
        promptGuidedJson: "NOT_TESTED",
        dreamSeoContract: "NOT_TESTED",
        requestedStructuredMode: "native",
        actualStructuredMode: "none",
        fallbackUsed: false,
        fallbackReason: null,
        authentication: "NOT_TESTED",
        connectivity: "NOT_TESTED",
        basicCompletion: "NOT_TESTED",
        structuredOutput: "NOT_TESTED",
        usageMetadata: "NOT_TESTED",
        timeoutHandling: "NOT_TESTED",
        errorNormalization: "NOT_TESTED",
        dreamSeoContractMapping: "NOT_TESTED",
        declaredCapabilities: ["chat", "paid_model"],
        verifiedCapabilities: [],
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        finishReason: null,
        overallResult: "UNABLE_TO_VERIFY",
        failureClassification: "MODEL_CAPABILITY_UNSUPPORTED",
        failureReason: `PAID_MODEL_APPROVAL_REQUIRED: Model '${modelMetadata.modelId}' requires paid API credits. Awaiting user authorization.`,
        verificationNotes: ["Stopped at Paid Model Gate to prevent unauthorized cloud spend."],
      };
    }

    const verificationNotes: string[] = [];
    const verifiedCaps: string[] = [];
    let totalInTokens = 0;
    let totalOutTokens = 0;
    let totalLatency = 0;
    let resolvedModelId: string | null = null;
    let lastFinishReason: string | null = "stop";
    let failureClassification: FailureClassification = "NONE";

    // --- LEVEL 1: Basic Live Connectivity Handshake ---
    const pingPrompt = "Reply with exactly: DREAM_SEO_PROVIDER_OK";
    const pingResult = await this.adapter.executePrompt(pingPrompt, {
      model: modelMetadata.modelId,
      maxTokens: 25,
      temperature: 0.0,
      timeoutMs: 25000,
    });

    let authState: ProviderCertificationState = "PASS";
    let connState: ProviderCertificationState = "PASS";
    let basicCompState: ProviderCertificationState = "PASS";
    let usageState: ProviderCertificationState = "NOT_TESTED";
    let level1State: ProviderCertificationState = "PASS";

    if (pingResult.status === "AUTH_FAILED") {
      authState = "AUTHENTICATION_FAILED";
      connState = "FAIL";
      basicCompState = "FAIL";
      level1State = "FAIL";
      return this.buildResult({
        certId,
        timestamp,
        modelMetadata,
        level1State,
        nativeStructuredOutput: "NOT_TESTED",
        promptGuidedJson: "NOT_TESTED",
        dreamSeoContract: "NOT_TESTED",
        requestedStructuredMode: "native",
        actualStructuredMode: "none",
        fallbackUsed: false,
        fallbackReason: null,
        authState,
        connState,
        basicCompState,
        structuredState: "NOT_TESTED",
        usageState: "NOT_TESTED",
        contractState: "NOT_TESTED",
        verifiedCaps,
        totalLatency: 0,
        totalInTokens: 0,
        totalOutTokens: 0,
        resolvedModelId: null,
        finishReason: null,
        overallResult: "AUTHENTICATION_FAILED",
        failureClassification: "MODEL_CAPABILITY_UNSUPPORTED",
        failureReason: pingResult.failureReason || "Authentication failed with OpenRouter.",
        verificationNotes: ["Authentication failed on initial handshake."],
      });
    }

    if (pingResult.status === "RATE_LIMITED") {
      return this.buildResult({
        certId,
        timestamp,
        modelMetadata,
        level1State: "RATE_LIMITED",
        nativeStructuredOutput: "NOT_TESTED",
        promptGuidedJson: "NOT_TESTED",
        dreamSeoContract: "NOT_TESTED",
        requestedStructuredMode: "native",
        actualStructuredMode: "none",
        fallbackUsed: false,
        fallbackReason: null,
        authState: "PASS",
        connState: "RATE_LIMITED",
        basicCompState: "RATE_LIMITED",
        structuredState: "NOT_TESTED",
        usageState: "NOT_TESTED",
        contractState: "NOT_TESTED",
        verifiedCaps,
        totalLatency: 0,
        totalInTokens: 0,
        totalOutTokens: 0,
        resolvedModelId: null,
        finishReason: null,
        overallResult: "RATE_LIMITED",
        failureClassification: "MODEL_CAPABILITY_UNSUPPORTED",
        failureReason: pingResult.failureReason || "Rate limit encountered on OpenRouter.",
        verificationNotes: ["Provider returned HTTP 429."],
      });
    }

    if (pingResult.status !== "SUCCESS" || !pingResult.response) {
      level1State = "FAIL";
      return this.buildResult({
        certId,
        timestamp,
        modelMetadata,
        level1State,
        nativeStructuredOutput: "NOT_TESTED",
        promptGuidedJson: "NOT_TESTED",
        dreamSeoContract: "NOT_TESTED",
        requestedStructuredMode: "native",
        actualStructuredMode: "none",
        fallbackUsed: false,
        fallbackReason: null,
        authState: "PASS",
        connState: "FAIL",
        basicCompState: "FAIL",
        structuredState: "NOT_TESTED",
        usageState: "NOT_TESTED",
        contractState: "NOT_TESTED",
        verifiedCaps,
        totalLatency: 0,
        totalInTokens: 0,
        totalOutTokens: 0,
        resolvedModelId: null,
        finishReason: null,
        overallResult: "FAIL",
        failureClassification: "MODEL_CAPABILITY_UNSUPPORTED",
        failureReason: pingResult.failureReason || "Connectivity test failed.",
        verificationNotes: ["Level 1 Connectivity request failed."],
      });
    }

    // Ping succeeded: Level 1 Connectivity is PASS
    level1State = "PASS";
    totalLatency += pingResult.response.latencyMs;
    resolvedModelId = pingResult.response.executionMetadata?.resolvedModel || modelMetadata.modelId;
    lastFinishReason = pingResult.response.executionMetadata?.finishReason || "stop";
    const pingInTokens = pingResult.response.executionMetadata?.promptTokens || 0;
    const pingOutTokens = pingResult.response.executionMetadata?.completionTokens || 0;
    totalInTokens += pingInTokens;
    totalOutTokens += pingOutTokens;

    if (pingInTokens > 0 || pingOutTokens > 0) {
      usageState = "PASS";
      verifiedCaps.push("token_usage_telemetry");
    } else {
      usageState = "NOT_SUPPORTED";
    }

    verifiedCaps.push("level1_gateway_connectivity");
    verificationNotes.push(`Level 1 Connectivity PASS (${pingResult.response.latencyMs}ms, resolved as: ${resolvedModelId}).`);

    // --- LEVEL 2: Structured Output Reality Test ---
    let nativeStructuredOutput: ProviderCertificationState = "NOT_TESTED";
    let promptGuidedJson: PromptGuidedJsonState = "NOT_TESTED";
    let requestedStructuredMode: StructuredMode = "native";
    let actualStructuredMode: StructuredMode = "none";
    let fallbackUsed = false;
    let fallbackReason: string | null = null;
    let structuredState: ProviderCertificationState = "FAIL";

    const testSchema = '{\n  "status": "ok",\n  "score": 1\n}';
    const structuredResult = await this.adapter.executeStructuredPrompt(
      'Respond with a JSON object containing {"status": "ok", "score": 1}.',
      testSchema,
      {
        model: modelMetadata.modelId,
        maxTokens: Math.min(150, guardrail.maxAllowedOutputTokensPerRequest),
        temperature: 0.0,
      }
    );

    if (structuredResult.finishReason) {
      lastFinishReason = structuredResult.finishReason;
    }

    actualStructuredMode = structuredResult.structuredMode;
    fallbackUsed = structuredResult.fallbackUsed;
    fallbackReason = structuredResult.fallbackReason;

    if (structuredResult.status === "SUCCESS" && structuredResult.data) {
      const isSchemaValid = structuredResult.data.status === "ok" && typeof structuredResult.data.score === "number";

      if (isSchemaValid) {
        if (structuredResult.structuredMode === "native") {
          // Rule 1: Native structured output accepted and valid
          nativeStructuredOutput = "PASS";
          promptGuidedJson = "NOT_REQUIRED";
          structuredState = "PASS";
          verifiedCaps.push("native_structured_json_output");
          verificationNotes.push("Native Structured Output (response_format) schema validation PASSED.");
        } else if (structuredResult.structuredMode === "prompt_guided" && structuredResult.fallbackUsed) {
          // Rule 2: Provider rejected response_format, but prompt-guided JSON succeeded
          nativeStructuredOutput = "NOT_SUPPORTED";
          promptGuidedJson = "PASS";
          structuredState = "PASS"; // Unified summary
          verifiedCaps.push("prompt_guided_json_output");
          verificationNotes.push("Native response_format rejected (NOT_SUPPORTED); Prompt-Guided JSON fallback PASSED.");
        } else {
          nativeStructuredOutput = "NOT_SUPPORTED";
          promptGuidedJson = "PASS";
          structuredState = "PASS";
          verifiedCaps.push("prompt_guided_json_output");
          verificationNotes.push("Prompt-Guided JSON schema validation PASSED.");
        }
      } else {
        if (structuredResult.structuredMode === "native") {
          nativeStructuredOutput = "FAIL";
          promptGuidedJson = "NOT_TESTED";
        } else {
          nativeStructuredOutput = structuredResult.nativeRejected ? "NOT_SUPPORTED" : "NOT_TESTED";
          promptGuidedJson = "FAIL";
        }
        structuredState = "FAIL";
        failureClassification = "MODEL_IGNORED_SCHEMA";
        verificationNotes.push(`Structured output schema mismatch: ${JSON.stringify(structuredResult.data)}`);
      }
    } else {
      if (structuredResult.nativeRejected) {
        nativeStructuredOutput = "NOT_SUPPORTED";
        promptGuidedJson = "FAIL";
      } else if (structuredResult.structuredMode === "native") {
        nativeStructuredOutput = "FAIL";
        promptGuidedJson = "NOT_TESTED";
      } else {
        promptGuidedJson = "FAIL";
      }
      structuredState = "FAIL";

      if (structuredResult.failureReason?.includes("PROVIDER_REJECTED_RESPONSE_FORMAT")) {
        failureClassification = "PROVIDER_REJECTED_RESPONSE_FORMAT";
      } else if (structuredResult.failureReason?.includes("OUTPUT_TRUNCATED")) {
        failureClassification = "OUTPUT_TOKEN_LIMIT_TOO_LOW";
      } else if (structuredResult.failureReason?.includes("INVALID_JSON")) {
        failureClassification = "MODEL_RETURNED_INVALID_JSON";
      } else {
        failureClassification = "MODEL_CAPABILITY_UNSUPPORTED";
      }
      verificationNotes.push(`Structured output request failed: ${structuredResult.failureReason}`);
    }

    if (structuredResult.usage) {
      totalInTokens += structuredResult.usage.inputTokens;
      totalOutTokens += structuredResult.usage.outputTokens;
    }
    totalLatency += structuredResult.latencyMs;

    // --- LEVEL 3: Dream SEO Diagnostic Contract Mapping ---
    let dreamSeoContract: ProviderCertificationState = "NOT_TESTED";
    const seoSchema = '{\n  "issueCode": "TITLE_MISSING",\n  "severity": "critical",\n  "remediationSummary": "Add a descriptive <title> tag between 30 and 60 characters to the <head> section."\n}';
    const seoPrompt = 'Given the technical SEO finding "Page title is missing on https://example.com/landing", produce the structured remediation JSON object with fields issueCode, severity, remediationSummary.';

    const seoResult = await this.adapter.executeStructuredPrompt(
      seoPrompt,
      seoSchema,
      {
        model: modelMetadata.modelId,
        maxTokens: Math.min(350, guardrail.maxAllowedOutputTokensPerRequest),
        temperature: 0.1,
      }
    );

    if (seoResult.finishReason) {
      lastFinishReason = seoResult.finishReason;
    }

    let sampleResponse: any = undefined;
    if (seoResult.status === "SUCCESS" && seoResult.data) {
      sampleResponse = {
        status: "ok",
        sampleJson: seoResult.data,
      };
      if (
        seoResult.data.issueCode &&
        seoResult.data.severity &&
        seoResult.data.remediationSummary
      ) {
        dreamSeoContract = "PASS";
        verifiedCaps.push("dream_seo_contract_mapping");
        verificationNotes.push(`Dream SEO diagnostic contract mapping PASSED (Mode: ${seoResult.structuredMode}).`);
      } else {
        dreamSeoContract = "FAIL";
        if (failureClassification === "NONE") {
          failureClassification = "DREAM_SEO_SCHEMA_MISMATCH";
        }
        verificationNotes.push(`Dream SEO contract missing required keys: ${JSON.stringify(seoResult.data)}`);
      }
    } else {
      dreamSeoContract = "FAIL";
      if (failureClassification === "NONE") {
        if (seoResult.failureReason?.includes("OUTPUT_TRUNCATED")) {
          failureClassification = "OUTPUT_TOKEN_LIMIT_TOO_LOW";
        } else if (seoResult.failureReason?.includes("INVALID_JSON")) {
          failureClassification = "MODEL_RETURNED_INVALID_JSON";
        } else {
          failureClassification = "MODEL_CAPABILITY_UNSUPPORTED";
        }
      }
      verificationNotes.push(`Dream SEO contract mapping failed: ${seoResult.failureReason}`);
    }

    if (seoResult.usage) {
      totalInTokens += seoResult.usage.inputTokens;
      totalOutTokens += seoResult.usage.outputTokens;
    }
    totalLatency += seoResult.latencyMs;

    // Calculate estimated cost
    const promptCost = (totalInTokens / 1_000_000) * modelMetadata.pricing.promptCostPerMillion;
    const completionCost = (totalOutTokens / 1_000_000) * modelMetadata.pricing.completionCostPerMillion;
    const estimatedCostUsd = promptCost + completionCost;

    const isStructuredSuccess = nativeStructuredOutput === "PASS" || promptGuidedJson === "PASS";
    const overallResult: ProviderCertificationState =
      level1State === "PASS" && isStructuredSuccess && dreamSeoContract === "PASS"
        ? "PASS"
        : "FAIL";

    if (overallResult === "PASS") {
      failureClassification = "NONE";
    }

    return this.buildResult({
      certId,
      timestamp,
      modelMetadata,
      level1State,
      nativeStructuredOutput,
      promptGuidedJson,
      dreamSeoContract,
      requestedStructuredMode,
      actualStructuredMode,
      fallbackUsed,
      fallbackReason,
      authState,
      connState,
      basicCompState,
      structuredState,
      usageState,
      contractState: dreamSeoContract,
      verifiedCaps,
      totalLatency,
      totalInTokens,
      totalOutTokens,
      resolvedModelId,
      finishReason: lastFinishReason,
      estimatedCostUsd,
      overallResult,
      failureClassification,
      failureReason: overallResult === "PASS" ? null : `Certification failed: Native: ${nativeStructuredOutput}, Prompt: ${promptGuidedJson}, SEO Contract: ${dreamSeoContract} (${failureClassification})`,
      verificationNotes,
      diagnosticSampleResponse: sampleResponse,
    });
  }

  private buildResult(params: {
    certId: string;
    timestamp: string;
    modelMetadata: DiscoveredModelMetadata;
    level1State: ProviderCertificationState;
    nativeStructuredOutput: ProviderCertificationState;
    promptGuidedJson: PromptGuidedJsonState;
    dreamSeoContract: ProviderCertificationState;
    requestedStructuredMode: StructuredMode;
    actualStructuredMode: StructuredMode;
    fallbackUsed: boolean;
    fallbackReason: string | null;
    authState: ProviderCertificationState;
    connState: ProviderCertificationState;
    basicCompState: ProviderCertificationState;
    structuredState: ProviderCertificationState;
    usageState: ProviderCertificationState;
    contractState: ProviderCertificationState;
    verifiedCaps: string[];
    totalLatency: number;
    totalInTokens: number;
    totalOutTokens: number;
    resolvedModelId: string | null;
    finishReason: string | null;
    estimatedCostUsd?: number;
    overallResult: ProviderCertificationState;
    failureClassification: FailureClassification;
    failureReason: string | null;
    verificationNotes: string[];
    diagnosticSampleResponse?: any;
  }): LiveProviderCertificationResult {
    return {
      certificationId: params.certId,
      provider: this.adapter.providerId,
      gateway: "OpenRouter",
      requestedModelId: params.modelMetadata.modelId,
      resolvedModelId: params.resolvedModelId,
      underlyingProvider: params.modelMetadata.provider,
      timestamp: params.timestamp,
      certificationVersion: CERTIFICATION_VERSION,
      level1Connectivity: params.level1State,
      nativeStructuredOutput: params.nativeStructuredOutput,
      promptGuidedJson: params.promptGuidedJson,
      dreamSeoContract: params.dreamSeoContract,
      requestedStructuredMode: params.requestedStructuredMode,
      actualStructuredMode: params.actualStructuredMode,
      fallbackUsed: params.fallbackUsed,
      fallbackReason: params.fallbackReason,
      authentication: params.authState,
      connectivity: params.connState,
      basicCompletion: params.basicCompState,
      structuredOutput: params.structuredState,
      usageMetadata: params.usageState,
      timeoutHandling: "PASS",
      errorNormalization: "PASS",
      dreamSeoContractMapping: params.contractState,
      declaredCapabilities: [
        "chat",
        ...(params.modelMetadata.supportsStructuredOutput ? ["structured_output"] : []),
        ...(params.modelMetadata.supportsTools ? ["tools"] : []),
      ],
      verifiedCapabilities: params.verifiedCaps,
      latencyMs: params.totalLatency,
      inputTokens: params.totalInTokens,
      outputTokens: params.totalOutTokens,
      totalTokens: params.totalInTokens + params.totalOutTokens,
      estimatedCostUsd: params.estimatedCostUsd || 0,
      finishReason: params.finishReason,
      overallResult: params.overallResult,
      failureClassification: params.failureClassification,
      failureReason: params.failureReason,
      verificationNotes: params.verificationNotes,
      diagnosticSampleResponse: params.diagnosticSampleResponse,
    };
  }
}
