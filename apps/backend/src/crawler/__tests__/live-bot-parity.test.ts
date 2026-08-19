import axios from "axios";
import { parseHtmlPage } from "../parser";
import { verifyLinkTarget } from "../fetcher";
import { normalizeUrl } from "../normalizer";
import type { CrawledPageData } from "../types";

interface LiveParityCheck {
  url: string;
  expectedStatus?: number;
  expectedResourceType?: string;
  expectedIndexable?: boolean;
  expectedH1Min?: number;
  expectedH1Max?: number;
  expectedMainLandmark?: boolean;
  expectedTitleContains?: string;
  description: string;
}

const TEST_URLS: LiveParityCheck[] = [
  {
    url: "https://www.botconsulting.io/",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 1,
    expectedH1Max: 1,
    expectedTitleContains: "BOT Consulting",
    description: "Homepage",
  },
  {
    url: "https://www.botconsulting.io/about-us",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 1,
    expectedH1Max: 1,
    expectedTitleContains: "About BOT Consulting",
    description: "About Us static marketing page",
  },
  {
    url: "https://www.botconsulting.io/solutions",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 2,
    expectedH1Max: 2,
    description: "Solutions marketing page (Multiple H1s)",
  },
  {
    url: "https://www.botconsulting.io/odyssey",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 1,
    expectedTitleContains: "Odyssey",
    description: "Odyssey OS page",
  },
  {
    url: "https://www.botconsulting.io/servicenow-at-bot",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 0,
    expectedH1Max: 0,
    description: "ServiceNow-at-bot (Missing H1)",
  },
  {
    url: "https://www.botconsulting.io/contact-us",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 1,
    expectedMainLandmark: true,
    description: "Contact Us page with forms & main landmark",
  },
  {
    url: "https://www.botconsulting.io/solution-service-now",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    description: "Solution ServiceNow page",
  },
  {
    url: "https://www.botconsulting.io/job-categories/customer-support",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 0,
    expectedH1Max: 0,
    description: "Customer Support category listing (CMS list without H1)",
  },
  {
    url: "https://www.botconsulting.io/job-categories/sales-marketing",
    expectedStatus: 404,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Sales & Marketing category listing (404 Removed on Live Site)",
  },
  {
    url: "https://www.botconsulting.io/job-openings/data-architect",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    description: "Dynamic Job Page (Data Architect)",
  },
  {
    url: "https://www.botconsulting.io/job-openings/analytic-engineer",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    description: "Dynamic Job Page (Analytics Engineer)",
  },
  {
    url: "https://www.botconsulting.io/jobopenings/790176000000574221",
    expectedStatus: 404,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Legacy CMS Job Record 1 (404 on Live Site)",
  },
  {
    url: "https://www.botconsulting.io/jobopenings/790176000000574233",
    expectedStatus: 404,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Legacy CMS Job Record 2 (404 on Live Site)",
  },
  {
    url: "https://www.botconsulting.io/jobopenings/790176000000574281",
    expectedStatus: 404,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Legacy CMS Job Record 3 (404 on Live Site)",
  },
  {
    url: "https://www.botconsulting.io/jobopenings-copy/790176000000574229",
    expectedStatus: 404,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Duplicate Job Candidate Copy 1 (404 on Live Site)",
  },
  {
    url: "https://www.botconsulting.io/jobopenings-copy/790176000000574249",
    expectedStatus: 404,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Duplicate Job Candidate Copy 2 (404 on Live Site)",
  },
  {
    url: "https://www.botconsulting.io/post/2025-year-in-review",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 1,
    description: "Blog Post: 2025 Year in Review",
  },
  {
    url: "https://www.botconsulting.io/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    expectedH1Min: 1,
    description: "Blog Post: AR.BOT on ServiceNow",
  },
  {
    url: "https://www.botconsulting.io/post/how-to-build-a-high-performing-gcc-in-india",
    expectedStatus: 404,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Blog Post: GCC in India (404 on Live Site)",
  },
  {
    url: "https://www.botconsulting.io/search",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Internal Search Utility Page (noindex)",
  },
  {
    url: "https://www.botconsulting.io/thank-you",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: false,
    description: "Thank You Confirmation Page (noindex)",
  },
  {
    url: "https://www.botconsulting.io/application",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    expectedIndexable: true,
    description: "Job Application Form Page",
  },
  {
    url: "https://www.botconsulting.io/sitemap.xml",
    expectedStatus: 200,
    expectedResourceType: "xml_sitemap",
    expectedIndexable: false,
    description: "XML Sitemap Resource",
  },
  {
    url: "https://www.botconsulting.io/cdn-cgi/l/email-protection",
    expectedStatus: 404,
    expectedResourceType: "utility_endpoint",
    expectedIndexable: false,
    description: "Cloudflare Utility Endpoint",
  },
  {
    url: "https://botconsulting.io/about-us",
    expectedStatus: 200,
    expectedResourceType: "html_page",
    description: "Domain Normalization Redirect Target (non-www -> www)",
  },
];

async function runLiveBotParity() {
  console.log("=======================================================");
  console.log("   LIVE BOT CONSULTING FACTUAL PARITY HARNESS (25+ URLs)");
  console.log("=======================================================\n");

  let factsChecked = 0;
  let factsMatched = 0;
  let factsMismatched = 0;
  const parityRecords: Array<{
    url: string;
    description: string;
    status: number;
    resourceType: string;
    indexable: boolean;
    h1Count: number;
    h1Text: string;
    title: string;
    renderMode: string;
    result: "PASS" | "MISMATCH";
    notes: string;
  }> = [];

  for (const check of TEST_URLS) {
    try {
      const response = await axios.get(check.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      const finalUrl = (response.request as any)?.res?.responseUrl || check.url;
      const normalized = normalizeUrl(check.url) || check.url;
      const parsed = parseHtmlPage(
        check.url,
        normalized,
        finalUrl,
        response.status,
        [],
        typeof response.data === "string" ? response.data : JSON.stringify(response.data),
        (response.headers || {}) as any,
        150,
        1,
        "https://www.botconsulting.io"
      );

      let isMatch = true;
      const notes: string[] = [];

      // Check HTTP Status
      factsChecked++;
      if (check.expectedStatus !== undefined) {
        if (response.status === check.expectedStatus) {
          factsMatched++;
        } else {
          factsMismatched++;
          isMatch = false;
          notes.push(`Status mismatch: expected ${check.expectedStatus}, got ${response.status}`);
        }
      } else {
        factsMatched++;
      }

      // Check Resource Type
      factsChecked++;
      if (check.expectedResourceType !== undefined) {
        if (parsed.resourceType === check.expectedResourceType) {
          factsMatched++;
        } else {
          factsMismatched++;
          isMatch = false;
          notes.push(`Resource type mismatch: expected ${check.expectedResourceType}, got ${parsed.resourceType}`);
        }
      } else {
        factsMatched++;
      }

      // Check Indexability
      factsChecked++;
      if (check.expectedIndexable !== undefined) {
        if (parsed.isIndexable === check.expectedIndexable) {
          factsMatched++;
        } else {
          factsMismatched++;
          isMatch = false;
          notes.push(`Indexability mismatch: expected ${check.expectedIndexable}, got ${parsed.isIndexable} (${parsed.indexabilityStatus})`);
        }
      } else {
        factsMatched++;
      }

      // Check H1 Count
      if (check.expectedH1Min !== undefined || check.expectedH1Max !== undefined) {
        factsChecked++;
        const minOk = check.expectedH1Min === undefined || parsed.h1Count >= check.expectedH1Min;
        const maxOk = check.expectedH1Max === undefined || parsed.h1Count <= check.expectedH1Max;
        if (minOk && maxOk) {
          factsMatched++;
        } else {
          factsMismatched++;
          isMatch = false;
          notes.push(`H1 count mismatch: got ${parsed.h1Count} (H1s: ${JSON.stringify(parsed.h1s)})`);
        }
      }

      // Check Title
      if (check.expectedTitleContains) {
        factsChecked++;
        if (parsed.title && parsed.title.toLowerCase().includes(check.expectedTitleContains.toLowerCase())) {
          factsMatched++;
        } else {
          factsMismatched++;
          isMatch = false;
          notes.push(`Title missing '${check.expectedTitleContains}': got "${parsed.title}"`);
        }
      }

      // Check Main Landmark
      if (check.expectedMainLandmark !== undefined) {
        factsChecked++;
        if (parsed.landmarks.hasMain === check.expectedMainLandmark) {
          factsMatched++;
        } else {
          factsMismatched++;
          isMatch = false;
          notes.push(`Main landmark mismatch: expected ${check.expectedMainLandmark}, got ${parsed.landmarks.hasMain}`);
        }
      }

      parityRecords.push({
        url: check.url,
        description: check.description,
        status: response.status,
        resourceType: parsed.resourceType,
        indexable: parsed.isIndexable,
        h1Count: parsed.h1Count,
        h1Text: parsed.h1s[0] || "[None]",
        title: parsed.title || "[None]",
        renderMode: parsed.renderMode,
        result: isMatch ? "PASS" : "MISMATCH",
        notes: notes.join("; ") || "All assertions verified",
      });

      console.log(`[${isMatch ? "PASS" : "MISMATCH"}] ${check.description}`);
      console.log(`       URL: ${check.url}`);
      console.log(`       Status: ${response.status} | Resource: ${parsed.resourceType} | Indexable: ${parsed.isIndexable} (${parsed.indexabilityStatus})`);
      console.log(`       H1 Count: ${parsed.h1Count} ("${parsed.h1s[0] || ""}") | Title: "${parsed.title?.slice(0, 45)}..."`);
      console.log(`       RenderMode: ${parsed.renderMode} | Words: ${parsed.wordCount} | Notes: ${notes.join("; ") || "OK"}\n`);
    } catch (err: any) {
      factsChecked += 3;
      factsMismatched += 3;
      parityRecords.push({
        url: check.url,
        description: check.description,
        status: 0,
        resourceType: "error",
        indexable: false,
        h1Count: 0,
        h1Text: "ERROR",
        title: "ERROR",
        renderMode: "manual_review",
        result: "MISMATCH",
        notes: `Network/Fetch Error: ${err.message}`,
      });
      console.log(`[FAIL] ${check.description}: ${err.message}\n`);
    }
  }

  // Re-test AR.BOT ServiceNow External Link
  console.log("-------------------------------------------------------");
  console.log("   RE-TESTING AR.BOT SERVICENOW MARKETPLACE LINK");
  console.log("-------------------------------------------------------");

  const arBotPostUrl = "https://www.botconsulting.io/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow";
  try {
    const postRes = await axios.get(arBotPostUrl, { timeout: 8000 });
    const postParsed = parseHtmlPage(
      arBotPostUrl,
      arBotPostUrl,
      arBotPostUrl,
      postRes.status,
      [],
      typeof postRes.data === "string" ? postRes.data : JSON.stringify(postRes.data),
      (postRes.headers || {}) as any,
      150,
      1,
      "https://www.botconsulting.io"
    );
    const serviceNowLink = postParsed.outlinks.find((l) => l.targetUrl.includes("store.servicenow.com") || l.anchorText.toLowerCase().includes("servicenow") || l.targetUrl.includes("servicenow"));

    if (serviceNowLink) {
      console.log(`Found Outbound Link: targetUrl="${serviceNowLink.targetUrl}", anchorText="${serviceNowLink.anchorText}"`);
      const extEvidence = await verifyLinkTarget(serviceNowLink.resolvedAbsoluteHref || serviceNowLink.targetUrl, arBotPostUrl, serviceNowLink.rawHref);
      console.log(`Verification Evidence:`);
      console.log(`  - HTTP Status: ${extEvidence.httpStatus}`);
      console.log(`  - Outcome: ${extEvidence.outcome}`);
      console.log(`  - Reason: ${extEvidence.reason}`);
      console.log(`  - Final URL: ${extEvidence.finalUrl}`);
      console.log(`  - Factual Verification Classification: ${extEvidence.outcome} (HTTP ${extEvidence.httpStatus})\n`);
    } else {
      console.log("ServiceNow outbound link not found in blog post outlinks.\n");
    }
  } catch (err: any) {
    console.log(`Error checking AR.BOT ServiceNow post: ${err.message}\n`);
  }

  const accuracyRate = Math.round((factsMatched / Math.max(1, factsChecked)) * 1000) / 10;

  console.log("=======================================================");
  console.log("   LIVE PARITY VERIFICATION SUMMARY");
  console.log("=======================================================");
  console.log(`Total URLs Tested: ${TEST_URLS.length}`);
  console.log(`Facts Checked: ${factsChecked}`);
  console.log(`Facts Matched: ${factsMatched}`);
  console.log(`Facts Mismatched: ${factsMismatched}`);
  console.log(`Live Parity Accuracy Rate: ${accuracyRate}%\n`);
}

runLiveBotParity().catch(console.error);
