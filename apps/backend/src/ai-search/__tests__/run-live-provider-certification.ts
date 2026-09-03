/**
 * Phase 28D.1: Explicit Live Provider Reality Certification Command.
 * Executes free-first, cost-controlled live certification against OpenRouter.
 * 
 * Command: npm run certify:providers:live
 * 
 * SAFETY:
 * 1. Requires OPENROUTER_API_KEY from environment.
 * 2. Never logs or prints the credential.
 * 3. Enforces Paid Model Stop Gate (only tests free models by default).
 * 4. Records exact token usage and latency across 3 distinct certification levels.
 */

import dotenv from "dotenv";
dotenv.config();

import { OpenRouterProviderAdapter } from "../observation/adapters/openrouter-adapter";
import { LiveProviderCertifier } from "../certification/certifier";
import { SqliteProviderCertificationRepository } from "../certification/persistence";
import { getDatabase } from "../../crawler/persistence/db";
import { runMigrations } from "../../crawler/persistence/schema";
import { LiveProviderCertificationResult } from "../certification/types";

export async function runLiveProviderCertification(): Promise<{
  success: boolean;
  totalModelsTested: number;
  results: LiveProviderCertificationResult[];
}> {
  console.log(`\n===============================================================`);
  console.log(`DREAM SEO — PHASE 28D.1 LIVE PROVIDER REALITY CERTIFICATION`);
  console.log(`===============================================================\n`);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ ERROR: OPENROUTER_API_KEY environment variable is not set.");
    console.error("   Live provider certification requires a valid runtime key in backend environment.");
    console.error("   Usage: $env:OPENROUTER_API_KEY=\"...\"; npm run certify:providers:live\n");
    return { success: false, totalModelsTested: 0, results: [] };
  }

  const adapter = new OpenRouterProviderAdapter();
  const certifier = new LiveProviderCertifier(adapter);
  const db = getDatabase();
  runMigrations(db);
  const repo = new SqliteProviderCertificationRepository(db);

  // --- STEP 1: Discover and Rank Free Models on OpenRouter ---
  console.log("▶ Discovering and ranking live free models on OpenRouter...");
  let rankedFreeModels;
  try {
    const allModels = await adapter.discoverModels();
    rankedFreeModels = await adapter.getRankedFreeModels();
    const freeCount = allModels.filter((m) => m.pricing.isFree).length;
    console.log(`✓ Discovered ${allModels.length} total models (${freeCount} free models available).\n`);
  } catch (err: any) {
    console.error(`❌ Model discovery failed: ${err.message}`);
    return { success: false, totalModelsTested: 0, results: [] };
  }

  if (rankedFreeModels.length === 0) {
    console.warn("⚠️ No free models currently detected on OpenRouter. Awaiting paid model gate approval.");
    return { success: false, totalModelsTested: 0, results: [] };
  }

  // --- STEP 2: Select Minimal Top-Ranked Free Multi-Family Matrix ---
  // Select up to 3 distinct family models with best structured output & instruction ranking
  const selectedModels: any[] = [];
  const families = new Set<string>();

  for (const fm of rankedFreeModels) {
    const fam = fm.provider || "other";
    if (!families.has(fam) && selectedModels.length < 3) {
      families.add(fam);
      selectedModels.push(fm);
    }
  }

  // Fallback to top 2 if distinct families not found
  if (selectedModels.length < 2 && rankedFreeModels.length >= 2) {
    for (const fm of rankedFreeModels) {
      if (!selectedModels.some((s) => s.modelId === fm.modelId)) {
        selectedModels.push(fm);
        if (selectedModels.length >= 2) break;
      }
    }
  }

  console.log(`▶ Selected ${selectedModels.length} Top-Ranked Free Model(s) for Reality Certification:`);
  selectedModels.forEach((m, idx) => {
    console.log(`  ${idx + 1}. [${m.provider.toUpperCase()}] ${m.modelId}`);
    console.log(`     Context: ${m.contextLength} | Mechanism: ${m.structuredOutputMechanism} | Free: $0.00`);
  });
  console.log("");

  // --- STEP 3: Execute Live Bounded Certification on Selected Models ---
  const results: LiveProviderCertificationResult[] = [];
  let atLeastOneVerified = false;

  for (const model of selectedModels) {
    console.log(`▶ Testing Model: ${model.modelId}...`);
    const certResult = await certifier.certifyModel(model);
    results.push(certResult);

    // Persist to SQLite
    repo.saveCertification(certResult);

    const isPass = certResult.overallResult === "PASS";
    if (isPass) atLeastOneVerified = true;

    console.log(`  ${isPass ? "✅" : "❌"} Overall: ${certResult.overallResult}`);
    console.log(`     - Connectivity:        ${certResult.level1Connectivity} (Resolved: ${certResult.resolvedModelId || model.modelId})`);
    console.log(`     - Native Structured:   ${certResult.nativeStructuredOutput}`);
    console.log(`     - Prompt JSON:         ${certResult.promptGuidedJson}`);
    console.log(`     - Dream SEO Contract:  ${certResult.dreamSeoContract}`);
    console.log(`     - Mode / Fallback:     ${certResult.actualStructuredMode}${certResult.fallbackUsed ? ` (Fallback from ${certResult.requestedStructuredMode})` : ""}`);
    console.log(`     - Finish Reason:       ${certResult.finishReason || "stop"}`);
    console.log(`     - Tokens:              ${certResult.totalTokens} (Prompt: ${certResult.inputTokens}, Completion: ${certResult.outputTokens})`);
    console.log(`     - Latency:             ${certResult.latencyMs}ms`);
    console.log(`     - Est. Cost:           $${certResult.estimatedCostUsd.toFixed(6)}`);
    if (certResult.failureReason) {
      console.log(`     - Failure Note:        ${certResult.failureReason}`);
    }
    console.log("");
  }

  // --- STEP 4: Authoritative Summary Scorecard ---
  console.log(`========================================================================================================================`);
  console.log(`PHASE 28D.1 OPENROUTER LIVE CERTIFICATION SCORECARD (SEPARATE NATIVE VS PROMPT-GUIDED JSON SEMANTICS)`);
  console.log(`========================================================================================================================`);
  console.log(`| Model                                      | Connectivity | Native Structured | Prompt JSON   | Dream SEO Contract | Overall |`);
  console.log(`| :----------------------------------------- | :----------: | :---------------: | :-----------: | :----------------: | :-----: |`);
  results.forEach((r) => {
    const namePadded = r.requestedModelId.slice(0, 42).padEnd(42, " ");
    const conn = r.level1Connectivity === "PASS" ? "✅ PASS" : "❌ " + r.level1Connectivity;
    
    let nativeStr = "❌ FAIL";
    if (r.nativeStructuredOutput === "PASS") nativeStr = "✅ PASS";
    else if (r.nativeStructuredOutput === "NOT_SUPPORTED") nativeStr = "⚠️ NOT_SUPP";
    else if (r.nativeStructuredOutput === "NOT_TESTED") nativeStr = "⚪ NOT_TEST";

    let promptStr = "❌ FAIL";
    if (r.promptGuidedJson === "PASS") promptStr = "✅ PASS";
    else if (r.promptGuidedJson === "NOT_REQUIRED") promptStr = "➖ NOT_REQ";
    else if (r.promptGuidedJson === "NOT_TESTED") promptStr = "⚪ NOT_TEST";

    const contract = r.dreamSeoContract === "PASS" ? "✅ PASS" : "❌ " + r.dreamSeoContract;
    const stat = r.overallResult === "PASS" ? "✅ PASS" : "❌ " + r.overallResult;

    console.log(`| ${namePadded} | ${conn.padEnd(12, " ")} | ${nativeStr.padEnd(17, " ")} | ${promptStr.padEnd(13, " ")} | ${contract.padEnd(18, " ")} | ${stat} |`);
  });
  console.log(`========================================================================================================================`);
  console.log(`TOTALS: ${results.filter((r) => r.overallResult === "PASS").length} / ${results.length} Free Models Fully Verified LIVE`);
  console.log(`========================================================================================================================\n`);

  return {
    success: atLeastOneVerified,
    totalModelsTested: results.length,
    results,
  };
}

if (process.argv[1]?.includes("run-live-provider-certification")) {
  runLiveProviderCertification().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error("FATAL ERROR in live provider certification:", err);
    process.exit(1);
  });
}
