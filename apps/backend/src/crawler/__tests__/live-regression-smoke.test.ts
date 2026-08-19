import axios from "axios";
import { parseHtmlPage } from "../parser";
import { normalizeUrl } from "../normalizer";

interface SmokeUrlCheck {
  url: string;
  description: string;
}

const SMOKE_URLS: SmokeUrlCheck[] = [
  { url: "https://www.botconsulting.io/", description: "Homepage" },
  { url: "https://www.botconsulting.io/about-us", description: "About Us static marketing page" },
  { url: "https://www.botconsulting.io/solutions", description: "Solutions marketing page" },
  { url: "https://www.botconsulting.io/odyssey", description: "Odyssey OS page" },
  { url: "https://www.botconsulting.io/servicenow-at-bot", description: "ServiceNow-at-bot" },
  { url: "https://www.botconsulting.io/contact-us", description: "Contact Us page" },
  { url: "https://www.botconsulting.io/solution-service-now", description: "Solution ServiceNow page" },
  { url: "https://www.botconsulting.io/job-categories/customer-support", description: "Customer Support category listing" },
  { url: "https://www.botconsulting.io/job-categories/sales-marketing", description: "Sales & Marketing category listing" },
  { url: "https://www.botconsulting.io/job-openings/data-architect", description: "Dynamic Job Page (Data Architect)" },
  { url: "https://www.botconsulting.io/job-openings/analytic-engineer", description: "Dynamic Job Page (Analytics Engineer)" },
  { url: "https://www.botconsulting.io/jobopenings/790176000000574221", description: "Legacy CMS Job Record 1" },
  { url: "https://www.botconsulting.io/jobopenings-copy/790176000000574229", description: "Duplicate Job Candidate Copy 1" },
  { url: "https://www.botconsulting.io/post/2025-year-in-review", description: "Blog Post: 2025 Year in Review" },
  { url: "https://www.botconsulting.io/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow", description: "Blog Post: AR.BOT on ServiceNow" },
  { url: "https://www.botconsulting.io/search", description: "Internal Search Utility Page" },
  { url: "https://www.botconsulting.io/thank-you", description: "Thank You Confirmation Page" },
  { url: "https://www.botconsulting.io/application", description: "Job Application Form Page" },
  { url: "https://www.botconsulting.io/sitemap.xml", description: "XML Sitemap Resource" },
  { url: "https://www.botconsulting.io/cdn-cgi/l/email-protection", description: "Cloudflare Utility Endpoint" },
  { url: "https://botconsulting.io/about-us", description: "Domain Normalization Redirect Target" },
];

async function runLiveRegressionSmoke() {
  console.log("=======================================================");
  console.log("   LIVE REGRESSION SMOKE TEST RUNNER");
  console.log("   (Checks live URL reachability & parser execution)");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  for (const check of SMOKE_URLS) {
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

      passed++;
      console.log(`[PASS] ${check.description} -> HTTP ${response.status} | Resource: ${parsed.resourceType} | Title: "${parsed.title?.slice(0, 35)}..."`);
    } catch (err: any) {
      failed++;
      console.log(`[FAIL] ${check.description} -> ${err.message}`);
    }
  }

  console.log("\n=======================================================");
  console.log(`SMOKE SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");
}

runLiveRegressionSmoke().catch(console.error);
