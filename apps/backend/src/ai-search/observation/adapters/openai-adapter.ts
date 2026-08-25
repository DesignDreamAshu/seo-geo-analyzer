/**
 * Phase 28D: OpenAI Live Observation Provider Adapter.
 */

import axios from "axios";
import crypto from "node:crypto";
import {
  AIObservationProvider,
  ProviderExecutionOptions,
  ProviderExecutionResult,
} from "./provider-adapter";
import { AIProviderId, ProviderCapability } from "../types";

export class OpenAIProviderAdapter implements AIObservationProvider {
  public readonly providerId: AIProviderId = "OPENAI";
  public readonly providerName = "OpenAI (ChatGPT / Search)";

  private getApiKey(): string | null {
    return process.env.OPENAI_API_KEY || null;
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
      defaultModel: "gpt-4o",
      availableModels: ["gpt-4o", "gpt-4o-mini", "chatgpt-4o-latest"],
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
        failureReason: "OPENAI_API_KEY is not configured in environment.",
      };
    }

    const model = options.model || "gpt-4o";
    const startTime = Date.now();

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "system",
              content:
                "You are an enterprise AI research assistant providing accurate, neutral, factual consulting and technology recommendations based on live web sources.",
            },
            {
              role: "user",
              content: promptText,
            },
          ],
          temperature: 0.7,
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

      return {
        status: "SUCCESS",
        response: {
          providerId: this.providerId,
          model,
          rawText,
          normalizedText: rawText.trim(),
          citations: [],
          responseHash,
          latencyMs,
          statusCode: response.status,
          isGroundingActive: false,
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
        failureReason: err.response?.data?.error?.message || err.message || "OpenAI execution failed.",
      };
    }
  }
}
