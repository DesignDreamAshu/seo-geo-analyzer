/**
 * SECURITY S6 — Advanced Coverage Gap Analysis & Defensible Intelligence Test Suite.
 * Certifies security.txt parsing, advisory provider abstraction, per-rule critical guardrails,
 * and graceful provider failure isolation.
 */

import { parseSecurityTxtContent } from "../extractors/security-txt-inspector";
import { NullSecurityAdvisoryProvider } from "../advisories/advisory-types";
import { DEFAULT_CRITICAL_GUARDRAILS } from "../scoring/score-engine";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${msg}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function runS6Tests() {
  console.log("=======================================================");
  console.log("RUNNING SECURITY S6 (ADVANCED GAP ANALYSIS) TEST SUITE");
  console.log("=======================================================\n");

  // 1. RFC 9116 security.txt Parsing
  console.log("1. RFC 9116 security.txt Parsing");
  {
    const validRaw = `
# Security Policy for Example Corp
Contact: mailto:security@example.com
Contact: https://example.com/security-form
Expires: 2030-12-31T23:59:59.000Z
Canonical: https://example.com/.well-known/security.txt
Policy: https://example.com/disclosure-policy
Preferred-Languages: en, es
`;
    const facts = parseSecurityTxtContent(validRaw, "https://example.com/.well-known/security.txt", 200, true);

    assert(facts.hasSecurityTxt === true, "Valid security.txt detected");
    assert(facts.contact.length === 2, "Both Contact directives parsed (2)");
    assert(facts.contact[0] === "mailto:security@example.com", "Email contact parsed");
    assert(facts.contact[1] === "https://example.com/security-form", "Web form contact parsed");
    assert(facts.isExpired === false, "Future expiry date is marked not expired");
    assert(facts.canonical === "https://example.com/.well-known/security.txt", "Canonical directive parsed");
    assert(facts.preferredLanguages === "en, es", "Preferred-Languages parsed");

    // Expired security.txt
    const expiredRaw = `
Contact: mailto:security@example.com
Expires: 2021-01-01T00:00:00.000Z
`;
    const expiredFacts = parseSecurityTxtContent(expiredRaw, "https://example.com/.well-known/security.txt", 200, true);
    assert(expiredFacts.hasSecurityTxt === true, "Security.txt detected");
    assert(expiredFacts.isExpired === true, "Past expiry date is marked expired");
  }

  // 2. Security Advisory Provider SPI & Null Standby Provider
  console.log("\n2. Security Advisory Provider SPI & Isolation");
  {
    const nullProvider = new NullSecurityAdvisoryProvider();
    assert(nullProvider.isAvailable() === false, "Standby provider is marked unavailable");
    const lookup = await nullProvider.lookupPackageVersion("jquery", "3.4.1");
    assert(lookup === null, "Standby provider returns null for package lookup without throwing");
    assert(nullProvider.getLastUpdated() === null, "Standby provider returns null for last updated");
  }

  // 3. Per-Rule Critical Score Guardrail Policy
  console.log("\n3. Per-Rule Critical Score Guardrail Policy");
  {
    assert(Boolean(DEFAULT_CRITICAL_GUARDRAILS.SEC_ENV_FILE_EXPOSED), "SEC_ENV_FILE_EXPOSED has guardrail policy");
    assert(DEFAULT_CRITICAL_GUARDRAILS.SEC_ENV_FILE_EXPOSED.maxPosture === "Weak", "Confirmed .env exposure policy restricts max posture to Weak");

    assert(Boolean(DEFAULT_CRITICAL_GUARDRAILS.SEC_CERT_EXPIRED), "SEC_CERT_EXPIRED has guardrail policy");
    assert(DEFAULT_CRITICAL_GUARDRAILS.SEC_CERT_EXPIRED.maxPosture === "Moderate", "Expired certificate policy restricts max posture to Moderate");

    assert(Boolean(DEFAULT_CRITICAL_GUARDRAILS.SEC_FORM_PASSWORD_INSECURE_TRANSPORT), "SEC_FORM_PASSWORD_INSECURE_TRANSPORT has guardrail policy");
    assert(DEFAULT_CRITICAL_GUARDRAILS.SEC_FORM_PASSWORD_INSECURE_TRANSPORT.maxPosture === "Moderate", "Insecure password transport restricts max posture to Moderate");
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log("=======================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runS6Tests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
