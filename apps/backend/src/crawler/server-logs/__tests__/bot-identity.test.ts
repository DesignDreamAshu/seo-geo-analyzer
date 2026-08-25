/**
 * Authoritative Bot Identity & Verification Safety Test Matrix.
 * Proves provider-authoritative CIDR matching, reverse/forward DNS, stale dataset degradation,
 * distinct OpenAI crawler purposes (GPTBot, OAI-SearchBot, ChatGPT-User), and IPv6 support.
 */

import { classifyBotRequest } from "../bot-classifier";
import { GOOGLEBOT_OFFICIAL_DATASET } from "../bot-ranges";

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res && typeof (res as any).then === "function") {
      return (res as any)
        .then(() => {
          console.log(`  ✓ ${testName}`);
        })
        .catch((err: any) => {
          console.error(`  ❌ FAIL: ${testName}`);
          console.error(`     ${err.message}`);
          throw err;
        });
    }
    console.log(`  ✓ ${testName}`);
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
  };
}

describe("2. Authoritative Bot Identity & Verification Safety", () => {
  it("2.1. Googlebot Smartphone with published CIDR is VERIFIED_PROVIDER_RANGE", () => {
    const ua = "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const res = classifyBotRequest(ua, "66.249.66.1"); // In 66.249.64.0/19

    expect(res.name).toBe("Googlebot Smartphone");
    expect(res.family).toBe("GOOGLEBOT");
    expect(res.deviceType).toBe("SMARTPHONE");
    expect(res.verificationState).toBe("VERIFIED_PROVIDER_RANGE");
    expect(res.isVerifiedSearchBot).toBe(true);
  });

  it("2.2. Googlebot with authoritative forward/reverse DNS is VERIFIED_FORWARD_REVERSE_DNS", () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const res = classifyBotRequest(ua, "66.249.99.99", {
      dnsLookupFn: (ip, fam) => fam === "GOOGLEBOT",
    });

    expect(res.verificationState).toBe("VERIFIED_FORWARD_REVERSE_DNS");
    expect(res.isVerifiedSearchBot).toBe(true);
  });

  it("2.3. Googlebot UA with non-authoritative IP outside CIDRs is strictly USER_AGENT_ONLY", () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    // 66.249.200.5 is outside Google's published 66.249.64.0/19 and 66.249.80.0/20 ranges
    const res = classifyBotRequest(ua, "66.249.200.5");

    expect(res.verificationState).toBe("USER_AGENT_ONLY");
    expect(res.isVerifiedSearchBot).toBe(false);
  });

  it("2.4. Stale range dataset degrades verification confidence to PROVIDER_RANGE_STALE", () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const staleDataset = {
      ...GOOGLEBOT_OFFICIAL_DATASET,
      freshness: "STALE" as const,
    };

    const res = classifyBotRequest(ua, "66.249.66.1", {
      customGooglebotDataset: staleDataset,
    });

    expect(res.verificationState).toBe("PROVIDER_RANGE_STALE");
    expect(res.isVerifiedSearchBot).toBe(false);
  });

  it("2.5. OpenAI crawlers verify by distinct published CIDR and purpose (GPTBot, OAI-SearchBot, ChatGPT-User)", () => {
    const gpt = classifyBotRequest("Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)", "20.171.206.5");
    expect(gpt.family).toBe("GPTBOT");
    expect(gpt.aiPurpose).toBe("AI_TRAINING");
    expect(gpt.verificationState).toBe("VERIFIED_PROVIDER_RANGE");

    const oaiSearch = classifyBotRequest("Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)", "20.150.180.10");
    expect(oaiSearch.family).toBe("OAI_SEARCHBOT");
    expect(oaiSearch.aiPurpose).toBe("SEARCH_INDEXING");
    expect(oaiSearch.verificationState).toBe("VERIFIED_PROVIDER_RANGE");

    const chatGptUser = classifyBotRequest("Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", "23.102.140.15");
    expect(chatGptUser.family).toBe("CHATGPT_USER");
    expect(chatGptUser.aiPurpose).toBe("USER_TRIGGERED_FETCH");
    expect(chatGptUser.verificationState).toBe("VERIFIED_PROVIDER_RANGE");
  });

  it("2.6. Normal browser client IP from crawler range without crawler UA remains HUMAN_OR_NON_BOT", () => {
    const browserUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const res = classifyBotRequest(browserUa, "66.249.66.1");

    expect(res.family).toBe("HUMAN_OR_NON_BOT");
    expect(res.isVerifiedSearchBot).toBe(false);
  });

  it("2.7. Validates IPv6 CIDR prefix matching accurately", () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const res = classifyBotRequest(ua, "2001:4860:4801:100::1");

    expect(res.verificationState).toBe("VERIFIED_PROVIDER_RANGE");
    expect(res.isVerifiedSearchBot).toBe(true);
  });
});
