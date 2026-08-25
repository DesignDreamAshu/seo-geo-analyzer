/**
 * Phase 28D: Abstract AI Observation Provider Adapter Contract.
 * Strict provider-neutral architecture with capability checks and safety guards.
 */

import {
  AIProviderId,
  ProviderCapability,
  AIProviderResponse,
  ObservationStatus,
} from "../types";

export interface ProviderExecutionOptions {
  model?: string;
  country?: string;
  language?: string;
  timeoutMs?: number;
}

export interface ProviderExecutionResult {
  status: ObservationStatus;
  response?: AIProviderResponse;
  failureReason?: string;
}

export interface AIObservationProvider {
  readonly providerId: AIProviderId;
  readonly providerName: string;

  getCapabilities(): ProviderCapability;
  isConfigured(): boolean;

  executePrompt(
    promptText: string,
    options?: ProviderExecutionOptions
  ): Promise<ProviderExecutionResult>;
}
