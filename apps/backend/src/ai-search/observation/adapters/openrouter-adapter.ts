/**
 * Phase 28D.1: OpenRouter Multi-Model Gateway Adapter.
 * Implements official OpenRouter OpenAI-compatible chat completion & model discovery API.
 * 
 * SECURITY:
 * API key is accessed strictly through process.env.OPENROUTER_API_KEY at runtime.
 * Never hardcoded, never logged, never persisted, never exported to client.
 */

import dotenv from "dotenv";
dotenv.config();

import axios, { AxiosError } from "axios";
import crypto from "node:crypto";
import {
  AIObservationProvider,
  ProviderExecutionOptions,
  ProviderExecutionResult,
} from "./provider-adapter";
import { AIProviderId, ProviderCapability } from "../types";
import { DiscoveredModelMetadata } from "../../certification/types";

export interface OpenRouterExecutionOptions extends ProviderExecutionOptions {
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" | "text" };
  systemPrompt?: string;
  customHeaders?: Record<string, string>;
  allowRetries?: boolean;
  maxRetries?: number;
}

export class OpenRouterProviderAdapter implements AIObservationProvider {
  public readonly providerId: AIProviderId = "OPENROUTER";
  public readonly providerName = "OpenRouter (Multi-Model Gateway)";
  public readonly baseUrl = "https://openrouter.ai/api/v1";

  /**
   * Internal runtime credential resolver.
   * STRICT SECURITY: Key is read solely from process.env at call time.
   */
  private getApiKey(): string | null {
    return process.env.OPENROUTER_API_KEY || null;
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
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      availableModels: [
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "deepseek/deepseek-r1:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "mistralai/mistral-7b-instruct:free",
      ],
    };
  }

  /**
   * Discovers live model metadata and pricing directly from OpenRouter.
   */
  public async discoverModels(customKey?: string): Promise<DiscoveredModelMetadata[]> {
    const apiKey = customKey || this.getApiKey();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://dreamseo.app",
      "X-Title": "Dream SEO",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers,
        timeout: 15000,
      });

      const rawModels = response.data?.data || [];
      return rawModels.map((m: any): DiscoveredModelMetadata => {
        const pricingPrompt = parseFloat(m.pricing?.prompt || "0");
        const pricingCompletion = parseFloat(m.pricing?.completion || "0");
        const isFree = (pricingPrompt === 0 && pricingCompletion === 0) || m.id?.endsWith(":free");

        const idParts = (m.id || "").split("/");
        const providerName = idParts.length > 1 ? idParts[0] : "openrouter";
        const supportedParams: string[] = Array.isArray(m.supported_parameters)
          ? m.supported_parameters
          : [];

        const hasNativeJson =
          supportedParams.includes("response_format") ||
          supportedParams.includes("structured_outputs");
        const isInstructTuned =
          Boolean(m.architecture?.instruct_type) ||
          m.id?.toLowerCase().includes("instruct") ||
          m.id?.toLowerCase().includes("chat");

        let structuredOutputMechanism: "response_format" | "prompt_guided" | "none" = "none";
        if (hasNativeJson) {
          structuredOutputMechanism = "response_format";
        } else if (isInstructTuned) {
          structuredOutputMechanism = "prompt_guided";
        }

        return {
          provider: providerName,
          modelId: m.id,
          displayName: m.name || m.id,
          contextLength: m.context_length || 4096,
          inputModalities: m.architecture?.modality ? [m.architecture.modality] : ["text"],
          outputModalities: ["text"],
          supportsStructuredOutput: structuredOutputMechanism !== "none",
          supportsTools: Array.isArray(m.tools) && m.tools.length > 0,
          supportedParameters: supportedParams,
          structuredOutputDeclared: hasNativeJson,
          structuredOutputMechanism,
          pricing: {
            promptCostPerMillion: pricingPrompt * 1000000,
            completionCostPerMillion: pricingCompletion * 1000000,
            isFree,
          },
          isAvailable: true,
          architectureFamily: m.architecture?.tokenizer || providerName,
          rawMetadata: {
            description: m.description,
            top_provider: m.top_provider,
            per_request_limits: m.per_request_limits,
            supported_parameters: m.supported_parameters,
          },
        };
      });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        throw new Error("AUTHENTICATION_FAILED: OpenRouter API key rejected.");
      }
      throw new Error(`OpenRouter model discovery failed: ${err.message || String(err)}`);
    }
  }

  /**
   * Returns list of currently available FREE models from OpenRouter.
   */
  public async getFreeModels(): Promise<DiscoveredModelMetadata[]> {
    const allModels = await this.discoverModels();
    return allModels.filter((m) => m.pricing.isFree);
  }

  /**
   * Selects suitable free models ranked by instruction-following and JSON capability.
   */
  public async getRankedFreeModels(): Promise<DiscoveredModelMetadata[]> {
    const freeModels = await this.getFreeModels();
    
    // Priority Scoring:
    // 1. Native response_format support (+100)
    // 2. Large established family e.g. Meta Llama, Google Gemini, Mistral, Qwen, DeepSeek (+50)
    // 3. Instruction tuned (+30)
    // 4. Large context window >= 8k (+20)
    // 5. Demote tiny/experimental previews (-40)
    const scored = freeModels.map((m) => {
      let score = 0;
      if (m.structuredOutputDeclared) score += 100;
      if (m.structuredOutputMechanism === "prompt_guided") score += 40;

      const idLower = m.modelId.toLowerCase();
      if (idLower.includes("llama-3") || idLower.includes("gemini") || idLower.includes("qwen") || idLower.includes("mistral") || idLower.includes("deepseek")) {
        score += 50;
      }
      if (idLower.includes("instruct")) score += 30;
      if (m.contextLength >= 8192) score += 20;
      if (idLower.includes("preview") || idLower.includes("note") || idLower.includes("fin")) {
        score -= 40;
      }
      return { model: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.model);
  }

  /**
   * Executes prompt against OpenRouter chat completions endpoint.
   */
  public async executePrompt(
    promptText: string,
    options: OpenRouterExecutionOptions = {}
  ): Promise<ProviderExecutionResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        status: "PROVIDER_NOT_CONFIGURED",
        failureReason: "OPENROUTER_API_KEY is not configured in backend environment.",
      };
    }

    const model = options.model || "meta-llama/llama-3.3-70b-instruct:free";
    const systemPrompt =
      options.systemPrompt ||
      "You are an enterprise AI research assistant providing accurate, neutral, factual recommendations.";
    const timeoutMs = options.timeoutMs || 25000;
    const maxRetries = options.allowRetries ? (options.maxRetries ?? 1) : 0;

    const requestPayload: Record<string, any> = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptText },
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 250,
    };

    if (options.responseFormat) {
      requestPayload.response_format = options.responseFormat;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://dreamseo.app",
      "X-Title": "Dream SEO",
      ...(options.customHeaders || {}),
    };

    let attempt = 0;
    while (attempt <= maxRetries) {
      const startTime = Date.now();
      try {
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          requestPayload,
          {
            headers,
            timeout: timeoutMs,
          }
        );

        const latencyMs = Date.now() - startTime;
        const choice = response.data?.choices?.[0];
        const rawText = choice?.message?.content ?? "";
        const resolvedModel = response.data?.model || model;
        const responseHash = crypto.createHash("sha256").update(rawText).digest("hex");

        const promptTokens = response.data?.usage?.prompt_tokens ?? 0;
        const completionTokens = response.data?.usage?.completion_tokens ?? 0;
        const totalTokens = response.data?.usage?.total_tokens ?? (promptTokens + completionTokens);
        const finishReason = choice?.finish_reason || "stop";

        return {
          status: "SUCCESS",
          response: {
            providerId: this.providerId,
            model,
            rawText,
            normalizedText: typeof rawText === "string" ? rawText.trim() : JSON.stringify(rawText),
            citations: [],
            responseHash,
            latencyMs,
            statusCode: response.status,
            isGroundingActive: false,
            observedAt: new Date().toISOString(),
            tokensUsed: { promptTokens, completionTokens, totalTokens },
            executionMetadata: {
              gateway: "OpenRouter",
              resolvedModel,
              promptTokens,
              completionTokens,
              totalTokens,
              finishReason,
            },
          },
        };
      } catch (err: any) {
        attempt++;
        const isLastAttempt = attempt > maxRetries;
        const normalized = this.normalizeAxiosError(err, model);

        // If provider rejected response_format: { type: "json_object" } with 400, retry without response_format
        if (
          options.responseFormat &&
          err.response?.status === 400 &&
          (JSON.stringify(err.response?.data || "").includes("response_format") ||
           JSON.stringify(err.response?.data || "").includes("json_object"))
        ) {
          return {
            status: "UNSUPPORTED",
            failureReason: "PROVIDER_REJECTED_RESPONSE_FORMAT: Model does not support native response_format json_object.",
          };
        }

        // Transient errors may retry if allowed
        const isTransient = normalized.status === "RATE_LIMITED" || normalized.status === "PROVIDER_ERROR";
        if (!isLastAttempt && isTransient) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        return normalized;
      }
    }

    return {
      status: "PROVIDER_ERROR",
      failureReason: "Max retry attempts exceeded without success.",
    };
  }

  /**
   * Executes a structured JSON prompt and extracts/validates JSON structure.
   */
  public async executeStructuredPrompt<T = any>(
    promptText: string,
    schemaDescription: string,
    options: OpenRouterExecutionOptions = {}
  ): Promise<{
    status: ProviderExecutionResult["status"];
    data: T | null;
    rawText: string;
    latencyMs: number;
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    resolvedModel?: string;
    finishReason?: string;
    failureReason?: string;
    structuredMode: "native" | "prompt_guided" | "none";
    nativeRejected: boolean;
    fallbackUsed: boolean;
    fallbackReason: string | null;
  }> {
    const fullPrompt = `${promptText}\n\nYou MUST return valid JSON matching this schema:\n${schemaDescription}\nReturn ONLY the JSON object, with no preamble, no markdown, and no explanation.`;

    // Attempt with native json_object if requested
    const wantsNative = options.responseFormat?.type === "json_object" || options.responseFormat === undefined;
    let structuredMode: "native" | "prompt_guided" | "none" = wantsNative ? "native" : "prompt_guided";
    let nativeRejected = false;
    let fallbackUsed = false;
    let fallbackReason: string | null = null;

    let result = await this.executePrompt(fullPrompt, {
      ...options,
      responseFormat: wantsNative ? { type: "json_object" } : undefined,
      maxTokens: options.maxTokens || 350,
      temperature: options.temperature ?? 0.1,
    });

    // If native response_format was rejected by provider (HTTP 400), fallback to prompt-guided JSON
    if (wantsNative && result.status === "UNSUPPORTED" && result.failureReason?.includes("PROVIDER_REJECTED_RESPONSE_FORMAT")) {
      nativeRejected = true;
      fallbackUsed = true;
      fallbackReason = "Provider rejected native response_format json_object (HTTP 400). Fallback to prompt-guided JSON.";
      structuredMode = "prompt_guided";

      result = await this.executePrompt(fullPrompt, {
        ...options,
        responseFormat: undefined,
        maxTokens: options.maxTokens || 350,
        temperature: options.temperature ?? 0.1,
      });
    }

    if (result.status !== "SUCCESS" || !result.response) {
      return {
        status: result.status,
        data: null,
        rawText: "",
        latencyMs: 0,
        failureReason: result.failureReason || "Provider execution failed",
        structuredMode: nativeRejected ? "prompt_guided" : (wantsNative ? "native" : "prompt_guided"),
        nativeRejected,
        fallbackUsed,
        fallbackReason,
      };
    }

    const rawText = result.response.rawText;
    const latencyMs = result.response.latencyMs;
    const usage = {
      inputTokens: result.response.executionMetadata?.promptTokens || 0,
      outputTokens: result.response.executionMetadata?.completionTokens || 0,
      totalTokens: result.response.executionMetadata?.totalTokens || 0,
    };
    const resolvedModel = result.response.executionMetadata?.resolvedModel;
    const finishReason = result.response.executionMetadata?.finishReason;

    // Robust JSON extraction
    try {
      let cleaned = rawText.trim();
      // Extract from markdown code fences if present
      const jsonFenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (jsonFenceMatch && jsonFenceMatch[1]) {
        cleaned = jsonFenceMatch[1].trim();
      } else {
        // Find outermost { ... }
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
      }

      if (!cleaned || (!cleaned.startsWith("{") && !cleaned.startsWith("["))) {
        throw new Error("No JSON object detected in response content.");
      }

      const parsed = JSON.parse(cleaned);
      return {
        status: "SUCCESS",
        data: parsed,
        rawText,
        latencyMs,
        usage,
        resolvedModel,
        finishReason,
        structuredMode,
        nativeRejected,
        fallbackUsed,
        fallbackReason,
      };
    } catch (parseErr: any) {
      // Check if output was truncated
      if (finishReason === "length" || parseErr.message?.includes("Unexpected end of JSON input")) {
        return {
          status: "PROVIDER_ERROR",
          data: null,
          rawText,
          latencyMs,
          usage,
          resolvedModel,
          finishReason,
          failureReason: `OUTPUT_TRUNCATED: Response truncated before JSON completed (finish_reason: ${finishReason}).`,
          structuredMode,
          nativeRejected,
          fallbackUsed,
          fallbackReason,
        };
      }

      return {
        status: "PROVIDER_ERROR",
        data: null,
        rawText,
        latencyMs,
        usage,
        resolvedModel,
        finishReason,
        failureReason: `INVALID_JSON: ${parseErr.message}`,
        structuredMode,
        nativeRejected,
        fallbackUsed,
        fallbackReason,
      };
    }
  }

  /**
   * Normalizes axios/network errors into formal ProviderExecutionResult.
   * SAFE: Never exposes or formats the bearer token in messages.
   */
  public normalizeAxiosError(err: any, model: string): ProviderExecutionResult {
    if (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout")) {
      return {
        status: "TIMEOUT",
        failureReason: `Request to OpenRouter model '${model}' timed out.`,
      };
    }

    const status = err.response?.status;
    const errorData = err.response?.data?.error;
    const errorMessage = errorData?.message || err.message || "Unknown error";

    if (status === 401 || status === 403) {
      return {
        status: "AUTH_FAILED",
        failureReason: "OpenRouter authentication failed (HTTP 401/403). Verify OPENROUTER_API_KEY.",
      };
    }

    if (status === 429) {
      return {
        status: "RATE_LIMITED",
        failureReason: `OpenRouter rate limit reached (HTTP 429): ${errorMessage}`,
      };
    }

    if (
      status === 404 ||
      errorMessage.toLowerCase().includes("not found") ||
      errorMessage.toLowerCase().includes("does not exist")
    ) {
      return {
        status: "UNSUPPORTED",
        failureReason: `Model '${model}' is unavailable or unsupported on OpenRouter.`,
      };
    }

    if (status >= 500) {
      return {
        status: "PROVIDER_ERROR",
        failureReason: `OpenRouter upstream server error (HTTP ${status}): ${errorMessage}`,
      };
    }

    return {
      status: "FAILED",
      failureReason: `OpenRouter execution failed: ${errorMessage}`,
    };
  }
}
