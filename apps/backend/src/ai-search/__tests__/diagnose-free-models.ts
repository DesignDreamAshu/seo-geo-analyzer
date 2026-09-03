import dotenv from "dotenv";
dotenv.config();

import { OpenRouterProviderAdapter } from "../observation/adapters/openrouter-adapter";
import { getDatabase } from "../../crawler/persistence/db";
import { SqliteProviderCertificationRepository } from "../certification/persistence";

async function main() {
  const db = getDatabase();
  const repo = new SqliteProviderCertificationRepository(db);
  const certs = repo.listCertifications("OPENROUTER", 10);
  console.log("Persisted Certifications in DB:", certs.length);
  for (const c of certs) {
    console.log(`\nModel: ${c.requestedModelId}`);
    console.log(`Resolved: ${c.resolvedModelId}`);
    console.log(`Overall: ${c.overallResult}`);
    console.log(`Failure Reason: ${c.failureReason}`);
    console.log(`Notes:`, c.verificationNotes);
    console.log(`Diagnostic Sample:`, JSON.stringify(c.diagnosticSampleResponse, null, 2));
  }

  const adapter = new OpenRouterProviderAdapter();
  if (adapter.isConfigured()) {
    console.log("\nDiscovering all models from OpenRouter...");
    const all = await adapter.discoverModels();
    const free = all.filter(m => m.pricing.isFree);
    console.log(`Discovered ${all.length} total models, ${free.length} free models:`);
    for (const m of free) {
      console.log(`- ID: ${m.modelId} | Provider: ${m.provider} | Context: ${m.contextLength} | Structured: ${m.supportsStructuredOutput} | Raw instruct_type: ${m.rawMetadata?.instruct_type || 'none'} | Top provider: ${JSON.stringify(m.rawMetadata?.top_provider)}`);
    }
  } else {
    console.log("\nOPENROUTER_API_KEY is not configured in .env yet.");
  }
}

main().catch(console.error);
