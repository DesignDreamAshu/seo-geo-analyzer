/**
 * Phase 28D: Google Gemini Live Observation Provider Adapter with Google Search Grounding.
 */

import axios from "axios";
import crypto from "node:crypto";
import {
  AIObservationProvider,
  ProviderExecutionOptions,
  ProviderExecutionResult,
} from "./provider-adapter";
import { AIProviderId, ProviderCapability, CitationObservation } from "../types";

export class GeminiProviderAdapter implements AIObservationProvider {
  public readonly providerId: AIProviderId = "GEMINI";
  public readonly providerName = "Google Gemini (with Search Grounding)";

  private getApiKey(): string | null {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
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
      supportsLocation: true,
      supportsLanguage: true,
      supportsModelSelection: true,
      defaultModel: "gemini-3.5-flash",
      availableModels: [
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
      ],
    };
  }

  public async executePrompt(
    promptText: string,
    options: ProviderExecutionOptions & { disableFallback?: boolean } = {}
  ): Promise<ProviderExecutionResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        status: "PROVIDER_NOT_CONFIGURED",
        failureReason: "GEMINI_API_KEY / GOOGLE_API_KEY is not configured in environment.",
      };
    }

    const configuredModel = "gemini-3.5-flash";
    const requestedModel = options.model || configuredModel;
    const startTime = Date.now();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey}`;

    const tryRequest = async (useTools: boolean) => {
      const payload: any = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
        },
      };

      if (useTools) {
        payload.tools = [{ googleSearch: {} }];
      }

      return axios.post(endpoint, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: options.timeoutMs || 30000,
      });
    };

    try {
      let response: any;
      let usedGrounding = true;
      let fallbackUsed = false;
      let fallbackReason: string | null = null;

      try {
        response = await tryRequest(true);
      } catch (groundingErr: any) {
        if (options.disableFallback) {
          throw groundingErr;
        }

        const errMsg = groundingErr.response?.data?.error?.message || "";
        const errStatus = groundingErr.response?.data?.error?.status || "";
        const httpStatus = groundingErr.response?.status;

        if (
          httpStatus === 429 ||
          errStatus === "RESOURCE_EXHAUSTED" ||
          errMsg.includes("quota") ||
          errMsg.includes("Search Grounding")
        ) {
          // Fallback to standard inference if grounding quota is exhausted on key tier
          usedGrounding = false;
          fallbackUsed = true;
          fallbackReason = `HTTP ${httpStatus} ${errStatus}: ${errMsg}`;
          response = await tryRequest(false);
        } else {
          throw groundingErr;
        }
      }

      const candidate = response.data.candidates?.[0];
      const textParts = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean) || [];
      const rawText = textParts.join("\n");
      const latencyMs = Date.now() - startTime;
      const responseHash = crypto.createHash("sha256").update(rawText).digest("hex");

      // Extract Google Search Grounding citations metadata
      const citations: CitationObservation[] = [];
      const groundingMetadata = candidate?.groundingMetadata;
      if (groundingMetadata?.groundingChunks && usedGrounding) {
        let cIdx = 1;
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            const uri = chunk.web.uri;
            try {
              const urlObj = new URL(uri);
              citations.push({
                sourceUrl: uri,
                domain: urlObj.hostname.replace(/^www\./, ""),
                title: chunk.web.title || null,
                citationIndex: cIdx++,
                domainType: "OTHER", // Extractor will classify
                isOwnDomain: false, // Extractor will check
              });
            } catch {
              // Ignore invalid URIs
            }
          }
        }
      }

      return {
        status: "SUCCESS",
        response: {
          providerId: this.providerId,
          model: requestedModel,
          configuredModel,
          requestedModel,
          providerConfirmedModel: null, // Google API does not return a distinct provider-confirmed model in response body
          rawText,
          normalizedText: rawText.trim(),
          citations,
          responseHash,
          latencyMs,
          statusCode: response.status,
          isGroundingActive: Boolean(groundingMetadata && usedGrounding),
          requestedGrounding: true,
          groundingState: usedGrounding && groundingMetadata ? "GROUNDING_ACTIVE" : "GROUNDING_NOT_ACTIVE",
          fallbackUsed,
          fallbackReason,
          observedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      const statusCode = err.response?.status;
      const errorMsg = err.response?.data?.error?.message || err.message || "";
      let status: ProviderExecutionResult["status"] = "PROVIDER_ERROR";
      if (
        statusCode === 401 ||
        statusCode === 403 ||
        (statusCode === 400 && (errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID")))
      ) {
        status = "AUTH_FAILED";
      } else if (statusCode === 429) {
        status = "RATE_LIMITED";
      } else if (err.code === "ECONNABORTED" || errorMsg.includes("timeout")) {
        status = "TIMEOUT";
      }

      return {
        status,
        failureReason: errorMsg || "Gemini execution failed.",
      };
    }
  }
}
