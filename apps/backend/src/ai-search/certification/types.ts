/**
 * Phase 28D.1: Live Provider Reality Certification Types.
 * Formal data contracts for multi-model AI provider certification, capabilities, and telemetry.
 */

import { AIProviderId } from "../observation/types";

export type ProviderCertificationState =
  | "PASS"
  | "FAIL"
  | "NOT_TESTED"
  | "NOT_SUPPORTED"
  | "UNABLE_TO_VERIFY"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "AUTHENTICATION_FAILED";

export type PromptGuidedJsonState =
  | "PASS"
  | "FAIL"
  | "NOT_REQUIRED"
  | "NOT_TESTED";

export type StructuredMode = "native" | "prompt_guided" | "none";

export type FailureClassification =
  | "MODEL_CAPABILITY_UNSUPPORTED"
  | "PROVIDER_REJECTED_RESPONSE_FORMAT"
  | "MODEL_RETURNED_INVALID_JSON"
  | "MODEL_IGNORED_SCHEMA"
  | "MODEL_OUTPUT_TRUNCATED"
  | "CERTIFIER_PARSER_BUG"
  | "DREAM_SEO_SCHEMA_MISMATCH"
  | "OUTPUT_TOKEN_LIMIT_TOO_LOW"
  | "NONE";

export interface ModelPricing {
  promptCostPerMillion: number;
  completionCostPerMillion: number;
  isFree: boolean;
}

export interface DiscoveredModelMetadata {
  provider: string;
  modelId: string;
  displayName: string;
  contextLength: number;
  inputModalities: string[];
  outputModalities: string[];
  supportsStructuredOutput: boolean;
  supportsTools: boolean;
  supportedParameters: string[];
  structuredOutputDeclared: boolean;
  structuredOutputMechanism: "response_format" | "prompt_guided" | "none";
  pricing: ModelPricing;
  isAvailable: boolean;
  architectureFamily?: string;
  rawMetadata?: Record<string, any>;
}

export interface LiveProviderCertificationResult {
  certificationId: string;
  provider: AIProviderId;
  gateway: "OpenRouter" | "Direct";
  requestedModelId: string;
  resolvedModelId: string | null;
  underlyingProvider: string | null;

  timestamp: string;
  certificationVersion: string;

  // Granular Capability Reality Certifications
  level1Connectivity: ProviderCertificationState;
  nativeStructuredOutput: ProviderCertificationState;
  promptGuidedJson: PromptGuidedJsonState;
  dreamSeoContract: ProviderCertificationState;

  // Execution Mode & Fallback Telemetry
  requestedStructuredMode: StructuredMode;
  actualStructuredMode: StructuredMode;
  fallbackUsed: boolean;
  fallbackReason: string | null;

  authentication: ProviderCertificationState;
  connectivity: ProviderCertificationState;
  basicCompletion: ProviderCertificationState;
  structuredOutput: ProviderCertificationState; // Unified Level 2 summary
  usageMetadata: ProviderCertificationState;
  timeoutHandling: ProviderCertificationState;
  errorNormalization: ProviderCertificationState;
  dreamSeoContractMapping: ProviderCertificationState; // Alias for dreamSeoContract

  declaredCapabilities: string[];
  verifiedCapabilities: string[];

  latencyMs: number;

  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  finishReason: string | null;

  overallResult: ProviderCertificationState;
  failureClassification: FailureClassification;
  failureReason: string | null;
  verificationNotes: string[];

  // Ephemeral diagnostic response (redacted of secrets)
  diagnosticSampleResponse?: {
    status: string;
    sampleText?: string;
    sampleJson?: Record<string, any>;
  };
}

export interface CertificationCostGuardrail {
  maxAllowedInputTokensPerRequest: number;
  maxAllowedOutputTokensPerRequest: number;
  maxPlannedCallsPerRun: number;
  hardBudgetCeilingUsd: number;
  requirePaidApproval: boolean;
}

export const DEFAULT_CERTIFICATION_GUARDRAIL: CertificationCostGuardrail = {
  maxAllowedInputTokensPerRequest: 800,
  maxAllowedOutputTokensPerRequest: 400,
  maxPlannedCallsPerRun: 10,
  hardBudgetCeilingUsd: 0.10,
  requirePaidApproval: true,
};
