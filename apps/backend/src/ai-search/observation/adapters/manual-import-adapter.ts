/**
 * Phase 28D: Manual Import Provider Adapter.
 * Allows importing live observations directly from ChatGPT Web, Claude, Copilot, etc.
 */

import crypto from "node:crypto";
import {
  AIObservationProvider,
  ProviderExecutionOptions,
  ProviderExecutionResult,
} from "./provider-adapter";
import { AIProviderId, ProviderCapability, CitationObservation } from "../types";

export interface ManualImportPayload {
  promptText: string;
  responseText: string;
  sourceEngineName?: string;
  citations?: string[];
  observedAt?: string;
}

export class ManualImportProviderAdapter implements AIObservationProvider {
  public readonly providerId: AIProviderId = "MANUAL_IMPORT";
  public readonly providerName = "Manual Import (User Verified)";

  public isConfigured(): boolean {
    return true; // Always available for user manual entry
  }

  public getCapabilities(): ProviderCapability {
    return {
      providerId: this.providerId,
      providerName: this.providerName,
      isConfigured: true,
      supportsApi: false,
      supportsWebGrounding: true,
      supportsCitations: true,
      supportsSourceUrls: true,
      supportsLocation: true,
      supportsLanguage: true,
      supportsModelSelection: false,
      defaultModel: "manual-web-entry",
      availableModels: ["manual-web-entry"],
    };
  }

  public async executePrompt(
    _promptText: string,
    _options: ProviderExecutionOptions = {}
  ): Promise<ProviderExecutionResult> {
    return {
      status: "UNSUPPORTED",
      failureReason: "Manual import adapter requires direct payload ingestion via importResponse().",
    };
  }

  public importResponse(payload: ManualImportPayload): ProviderExecutionResult {
    const rawText = payload.responseText || "";
    if (!rawText.trim()) {
      return {
        status: "FAILED",
        failureReason: "Response text cannot be empty for manual import.",
      };
    }

    const responseHash = crypto.createHash("sha256").update(rawText).digest("hex");
    const citations: CitationObservation[] = [];
    let cIdx = 1;

    for (const uri of payload.citations || []) {
      try {
        const urlObj = new URL(uri);
        citations.push({
          sourceUrl: uri,
          domain: urlObj.hostname.replace(/^www\./, ""),
          citationIndex: cIdx++,
          domainType: "OTHER",
          isOwnDomain: false,
        });
      } catch {
        // Ignore invalid URL strings
      }
    }

    return {
      status: "SUCCESS",
      response: {
        providerId: this.providerId,
        model: payload.sourceEngineName || "manual-web-entry",
        rawText,
        normalizedText: rawText.trim(),
        citations,
        responseHash,
        latencyMs: 0,
        isGroundingActive: citations.length > 0,
        observedAt: payload.observedAt || new Date().toISOString(),
      },
    };
  }
}
