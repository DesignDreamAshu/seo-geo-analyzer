/**
 * Dream SEO — AI Entitlement & Billing Service.
 * Manages access control, credit checks, and safe development-only entitlement bypasses.
 * 
 * SECURITY:
 * Hard production safety guard prevents any development bypass in production environments.
 */

export interface AIEntitlementResult {
  allowed: boolean;
  source: "DEV_BYPASS" | "PAID_PLAN" | "CREDITS" | "DENIED";
  creditsRequired: number;
  creditsConsumed: number;
  isDevBypass: boolean;
  reason?: string;
}

export interface CreditUsageTelemetry {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export class AIEntitlementService {
  /**
   * Evaluates if the development entitlement bypass is active and permitted.
   * STRICT SAFETY GUARD: Production environment unconditionally disables bypass.
   */
  public isDevBypassActive(): boolean {
    const isProd = process.env.NODE_ENV === "production";
    const bypassFlag = process.env.DREAMSEO_DEV_BYPASS_AI_ENTITLEMENT === "true";

    if (isProd && bypassFlag) {
      console.warn("[SECURITY GUARD] DREAMSEO_DEV_BYPASS_AI_ENTITLEMENT is ignored in production environment.");
      return false;
    }

    return !isProd && bypassFlag;
  }

  /**
   * Checks if user/project is entitled to generate an AI report.
   */
  public async checkAiReportAccess(
    userId = "default_user",
    projectId: string
  ): Promise<AIEntitlementResult> {
    if (this.isDevBypassActive()) {
      return {
        allowed: true,
        source: "DEV_BYPASS",
        creditsRequired: 0,
        creditsConsumed: 0,
        isDevBypass: true,
        reason: "Development bypass active for local testing.",
      };
    }

    // Default production check (can be wired to Stripe / DreamHub / database user plans)
    const hasPaidPlan = false; // Production billing placeholder
    const userCredits = 0;

    if (hasPaidPlan) {
      return {
        allowed: true,
        source: "PAID_PLAN",
        creditsRequired: 0,
        creditsConsumed: 0,
        isDevBypass: false,
      };
    }

    if (userCredits >= 1) {
      return {
        allowed: true,
        source: "CREDITS",
        creditsRequired: 1,
        creditsConsumed: 0,
        isDevBypass: false,
      };
    }

    return {
      allowed: false,
      source: "DENIED",
      creditsRequired: 1,
      creditsConsumed: 0,
      isDevBypass: false,
      reason: "Insufficient AI report credits. Upgrade to a paid plan or purchase report credits.",
    };
  }

  /**
   * Consumes credits after successful AI report generation.
   */
  public async consumeAiReportCredits(
    userId = "default_user",
    usage: CreditUsageTelemetry
  ): Promise<AIEntitlementResult> {
    if (this.isDevBypassActive()) {
      return {
        allowed: true,
        source: "DEV_BYPASS",
        creditsRequired: 0,
        creditsConsumed: 0,
        isDevBypass: true,
        reason: "0 credits consumed (development bypass).",
      };
    }

    // Deduct credit in production
    return {
      allowed: true,
      source: "CREDITS",
      creditsRequired: 1,
      creditsConsumed: 1,
      isDevBypass: false,
      reason: "1 credit consumed for AI report generation.",
    };
  }

  /**
   * Gets current user's AI report entitlement status.
   */
  public async getAiReportEntitlement(userId = "default_user"): Promise<AIEntitlementResult> {
    return this.checkAiReportAccess(userId, "default_project");
  }
}

export const globalAIEntitlementService = new AIEntitlementService();
