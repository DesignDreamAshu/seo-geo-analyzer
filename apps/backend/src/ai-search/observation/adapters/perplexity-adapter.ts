/**
 * Phase 28D: Perplexity Live Observation Provider Adapter.
 */

import axios from "axios";
import crypto from "node:crypto";
import {
  AIObservationProvider,
  ProviderExecutionOptions,
  ProviderExecutionResult,
} from "./provider-adapter";
import { AIProviderId, ProviderCapability, CitationObservation } from "../types";

export class PerplexityProviderAdapter implements AIObservationProvider {
  public readonly providerId: AIProviderId = "PERPLEXITY";
  public readonly providerName = "Perplexity AI (Sonar Search)";

  private getApiKey(): string | null {
    return process.env.PERPLEXITY_API_KEY || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public getCapabilities(): ProviderCapability {
    const configured = this.isConfigured();
    return {
      providerId: this.providerId,
      providerName: this.providerName,
      isConfigured: configured,
      supportsApi: true,
      supportsWebGrounding: true,
      supportsCitations: true,
      supportsSourceUrls: true,
      supportsLocation: false,
      supportsLanguage: true,
      supportsModelSelection: true,
      defaultModel: "sonar",
      availableModels: ["sonar", "sonar-pro", "sonar-reasoning"],
    };
  }

  public async executePrompt(
    promptText: string,
    options: ProviderExecutionOptions = {}
  ): Promise<ProviderExecutionResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        status: "PROVIDER_NOT_CONFIGURED",
        failureReason: "PERPLEXITY_API_KEY is not configured in environment.",
      };
    }

    const model = options.model || "sonar";
    const startTime = Date.now();

    try {
      const response = await axios.post(
        "https://api.perplexity.ai/chat/completions",
        {
          model,
          messages: [
            {
              role: "system",
              content: "Be precise, neutral, and cite authoritative enterprise sources.",
            },
            {
              role: "user",
              content: promptText,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: options.timeoutMs || 30000,
        }
      );

      const rawText = response.data.choices?.[0]?.message?.content || "";
      const latencyMs = Date.now() - startTime;
      const responseHash = crypto.createHash("sha256").update(rawText).digest("hex");

      const citations: CitationObservation[] = [];
      const rawCitations = response.data.citations || [];
      let cIdx = 1;
      for (const uri of rawCitations) {
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
          model,
          rawText,
          normalizedText: rawText.trim(),
          citations,
          responseHash,
          latencyMs,
          statusCode: response.status,
          isGroundingActive: citations.length > 0,
          observedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      const statusCode = err.response?.status;
      let status: ProviderExecutionResult["status"] = "PROVIDER_ERROR";
      if (statusCode === 401 || statusCode === 403) status = "AUTH_FAILED";
      else if (statusCode === 429) status = "RATE_LIMITED";
      else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) status = "TIMEOUT";

      return {
        status,
        failureReason: err.response?.data?.error?.message || err.message || "Perplexity execution failed.",
      };
    }
  }
}
