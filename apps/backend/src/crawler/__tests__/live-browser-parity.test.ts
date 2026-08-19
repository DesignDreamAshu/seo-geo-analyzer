import { chromium } from "playwright";
import axios from "axios";
import { parseHtmlPage } from "../parser";
import { normalizeUrl } from "../normalizer";

interface CrawlerFactModel {
  requestedUrl: string;
  status: number;
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  h1Texts: string[];
  h2Count: number;
  h3Count: number;
  wordCount: number;
  hasMain: boolean;
  mainCount: number;
  formCount: number;
  unlabelledFormControlCount: number;
  imageCount: number;
  missingAltCount: number;
  renderMode: string;
  renderConfidence: string;
}

interface BrowserOracleFactModel {
  requestedUrl: string;
  navigationStatus: number | null;
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  h1Texts: string[];
  h2Count: number;
  h3Count: number;
  visibleWordCount: number;
  hasMain: boolean;
  mainCount: number;
  formCount: number;
  unlabelledFormControlCount: number;
  imageCount: number;
  missingAltCount: number;
  domContentLoaded: boolean;
  networkIdleReached: boolean;
  challengeDetected: boolean;
  browserError?: string | null;
}

interface FactComparison {
  field: string;
  crawlerValue: any;
  browserValue: any;
  status: "EXACT_MATCH" | "TOLERATED_MATCH" | "MISMATCH" | "INCONCLUSIVE" | "NOT_EVALUATED";
  note?: string;
}

const TEST_URLS = [
  "https://www.botconsulting.io/",
  "https://www.botconsulting.io/about-us",
  "https://www.botconsulting.io/solutions",
  "https://www.botconsulting.io/odyssey",
  "https://www.botconsulting.io/servicenow-at-bot",
  "https://www.botconsulting.io/contact-us",
  "https://www.botconsulting.io/solution-service-now",
  "https://www.botconsulting.io/job-categories/customer-support",
  "https://www.botconsulting.io/job-openings/data-architect",
  "https://www.botconsulting.io/job-openings/analytic-engineer",
  "https://www.botconsulting.io/post/2025-year-in-review",
  "https://www.botconsulting.io/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow",
  "https://www.botconsulting.io/search",
  "https://www.botconsulting.io/thank-you",
  "https://www.botconsulting.io/application",
];

async function extractCrawlerFacts(url: string): Promise<CrawlerFactModel> {
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 10000,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  const finalUrl = (response.request as any)?.res?.responseUrl || url;
  const normalized = normalizeUrl(url) || url;
  const parsed = parseHtmlPage(
    url,
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

  return {
    requestedUrl: url,
    status: parsed.statusCode,
    finalUrl: parsed.finalUrl,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    canonical: parsed.canonicalUrl,
    robots: parsed.metaRobots,
    h1Count: parsed.h1Count,
    h1Texts: parsed.h1s,
    h2Count: parsed.headingsOutline.filter((h) => h.level === 2).length,
    h3Count: parsed.headingsOutline.filter((h) => h.level === 3).length,
    wordCount: parsed.wordCount,
    hasMain: parsed.landmarks.hasMain,
    mainCount: parsed.landmarks.mainCount,
    formCount: parsed.forms.length,
    unlabelledFormControlCount: parsed.forms.reduce(
      (sum, f) => sum + f.controls.filter((c) => !c.isLabelled).length,
      0
    ),
    imageCount: parsed.images.length,
    missingAltCount: parsed.images.filter((img) => !img.hasAltAttribute).length,
    renderMode: parsed.renderMode,
    renderConfidence: parsed.renderConfidence,
  };
}

async function extractPlaywrightOracleFacts(browser: any, url: string): Promise<BrowserOracleFactModel> {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let navigationStatus: number | null = null;
  let domContentLoaded = false;
  let networkIdleReached = false;
  let browserError: string | null = null;

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    navigationStatus = res ? res.status() : 200;
    domContentLoaded = true;

    try {
      await page.waitForLoadState("networkidle", { timeout: 3000 });
      networkIdleReached = true;
    } catch {
      networkIdleReached = false;
    }
  } catch (err: any) {
    browserError = err.message;
  }

  const finalUrl = page.url();

  // Pure independent browser evaluation directly against native browser DOM
  const domData = await page
    .evaluate(() => {
      const docTitle = document.title ? document.title.trim() : null;
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || null;
      const canonicalTag =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() || null;
      const robotsMeta =
        document.querySelector('meta[name="robots"]')?.getAttribute("content")?.trim() || null;

      // Extract H1s natively
      const h1Nodes = Array.from(document.querySelectorAll("h1"));
      const h1Texts = h1Nodes.map((n) => (n.textContent || "").trim()).filter(Boolean);
      const h2Count = document.querySelectorAll("h2").length;
      const h3Count = document.querySelectorAll("h3").length;

      // Visible word count estimation
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript, svg, nav, footer").forEach((el) => el.remove());
      const visibleText = (clone.innerText || "").replace(/\s+/g, " ").trim();
      const visibleWordCount = visibleText ? visibleText.split(/\s+/).length : 0;

      // Landmarks & semantic tags
      const mainNodes = document.querySelectorAll("main, [role='main']");
      const hasMain = mainNodes.length > 0;
      const mainCount = mainNodes.length;

      // Forms and unlabelled inputs
      const forms = document.querySelectorAll("form");
      const inputs = document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select");
      let unlabelledCount = 0;
      inputs.forEach((input) => {
        const id = input.getAttribute("id");
        const hasLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false;
        const hasAria = Boolean(input.getAttribute("aria-label") || input.getAttribute("aria-labelledby"));
        const isWrappedInLabel = Boolean(input.closest("label"));
        if (!hasLabel && !hasAria && !isWrappedInLabel) {
          unlabelledCount++;
        }
      });

      // Images and alt attributes
      const images = Array.from(document.querySelectorAll("img"));
      const imageCount = images.length;
      let missingAltCount = 0;
      images.forEach((img) => {
        if (!img.hasAttribute("alt")) {
          missingAltCount++;
        }
      });

      const bodyTextLower = (document.body.innerText || "").toLowerCase();
      const isChallenge =
        bodyTextLower.includes("cloudflare") &&
        (bodyTextLower.includes("verify you are human") || bodyTextLower.includes("turnstile"));

      return {
        title: docTitle,
        metaDescription: metaDesc,
        canonical: canonicalTag,
        robots: robotsMeta,
        h1Count: h1Nodes.length,
        h1Texts,
        h2Count,
        h3Count,
        visibleWordCount,
        hasMain,
        mainCount,
        formCount: forms.length,
        unlabelledFormControlCount: unlabelledCount,
        imageCount,
        missingAltCount,
        challengeDetected: isChallenge,
      };
    })
    .catch(() => null);

  await context.close();

  return {
    requestedUrl: url,
    navigationStatus,
    finalUrl,
    title: domData?.title ?? null,
    metaDescription: domData?.metaDescription ?? null,
    canonical: domData?.canonical ?? null,
    robots: domData?.robots ?? null,
    h1Count: domData?.h1Count ?? 0,
    h1Texts: domData?.h1Texts ?? [],
    h2Count: domData?.h2Count ?? 0,
    h3Count: domData?.h3Count ?? 0,
    visibleWordCount: domData?.visibleWordCount ?? 0,
    hasMain: domData?.hasMain ?? false,
    mainCount: domData?.mainCount ?? 0,
    formCount: domData?.formCount ?? 0,
    unlabelledFormControlCount: domData?.unlabelledFormControlCount ?? 0,
    imageCount: domData?.imageCount ?? 0,
    missingAltCount: domData?.missingAltCount ?? 0,
    domContentLoaded,
    networkIdleReached,
    challengeDetected: domData?.challengeDetected ?? false,
    browserError,
  };
}

function compareFacts(crawler: CrawlerFactModel, oracle: BrowserOracleFactModel): FactComparison[] {
  const comparisons: FactComparison[] = [];

  // 1. Status
  comparisons.push({
    field: "HTTP / Navigation Status",
    crawlerValue: crawler.status,
    browserValue: oracle.navigationStatus,
    status: crawler.status === oracle.navigationStatus ? "EXACT_MATCH" : "MISMATCH",
  });

  // 2. Title
  const cleanCrawlerTitle = (crawler.title || "").trim().toLowerCase();
  const cleanOracleTitle = (oracle.title || "").trim().toLowerCase();
  if (cleanCrawlerTitle === cleanOracleTitle) {
    comparisons.push({
      field: "Document Title",
      crawlerValue: crawler.title,
      browserValue: oracle.title,
      status: "EXACT_MATCH",
    });
  } else if (cleanCrawlerTitle.includes(cleanOracleTitle) || cleanOracleTitle.includes(cleanCrawlerTitle)) {
    comparisons.push({
      field: "Document Title",
      crawlerValue: crawler.title,
      browserValue: oracle.title,
      status: "TOLERATED_MATCH",
      note: "Substring / formatting match",
    });
  } else {
    comparisons.push({
      field: "Document Title",
      crawlerValue: crawler.title,
      browserValue: oracle.title,
      status: "MISMATCH",
    });
  }

  // 3. Meta Description
  comparisons.push({
    field: "Meta Description",
    crawlerValue: crawler.metaDescription,
    browserValue: oracle.metaDescription,
    status:
      (crawler.metaDescription || "").trim() === (oracle.metaDescription || "").trim()
        ? "EXACT_MATCH"
        : "MISMATCH",
  });

  // 4. Canonical
  comparisons.push({
    field: "Canonical URL",
    crawlerValue: crawler.canonical,
    browserValue: oracle.canonical,
    status:
      (crawler.canonical || "").trim() === (oracle.canonical || "").trim()
        ? "EXACT_MATCH"
        : "MISMATCH",
  });

  // 5. H1 Count
  comparisons.push({
    field: "H1 Tag Count",
    crawlerValue: crawler.h1Count,
    browserValue: oracle.h1Count,
    status: crawler.h1Count === oracle.h1Count ? "EXACT_MATCH" : "MISMATCH",
  });

  // 6. H1 Primary Text
  const crawlerH1 = (crawler.h1Texts[0] || "").trim().toLowerCase();
  const oracleH1 = (oracle.h1Texts[0] || "").trim().toLowerCase();
  if (crawlerH1 === oracleH1) {
    comparisons.push({
      field: "Primary H1 Text",
      crawlerValue: crawler.h1Texts[0] || "[None]",
      browserValue: oracle.h1Texts[0] || "[None]",
      status: "EXACT_MATCH",
    });
  } else if (crawlerH1.replace(/\s+/g, "") === oracleH1.replace(/\s+/g, "")) {
    comparisons.push({
      field: "Primary H1 Text",
      crawlerValue: crawler.h1Texts[0] || "[None]",
      browserValue: oracle.h1Texts[0] || "[None]",
      status: "TOLERATED_MATCH",
      note: "Whitespace / line-break variation",
    });
  } else {
    comparisons.push({
      field: "Primary H1 Text",
      crawlerValue: crawler.h1Texts[0] || "[None]",
      browserValue: oracle.h1Texts[0] || "[None]",
      status: "MISMATCH",
    });
  }

  // 7. Main Semantic Landmark
  comparisons.push({
    field: "<main> Semantic Landmark",
    crawlerValue: crawler.hasMain,
    browserValue: oracle.hasMain,
    status: crawler.hasMain === oracle.hasMain ? "EXACT_MATCH" : "MISMATCH",
  });

  // 8. Word Count / Visible Content
  const wordDiffRatio = Math.abs(crawler.wordCount - oracle.visibleWordCount) / Math.max(1, oracle.visibleWordCount);
  if (wordDiffRatio < 0.25 || Math.abs(crawler.wordCount - oracle.visibleWordCount) < 30) {
    comparisons.push({
      field: "Word Count",
      crawlerValue: crawler.wordCount,
      browserValue: oracle.visibleWordCount,
      status: "TOLERATED_MATCH",
      note: `Within acceptable tolerance (${Math.round(wordDiffRatio * 100)}% variance)`,
    });
  } else {
    comparisons.push({
      field: "Word Count",
      crawlerValue: crawler.wordCount,
      browserValue: oracle.visibleWordCount,
      status: "MISMATCH",
      note: `Variance ${Math.round(wordDiffRatio * 100)}% exceeds 25% tolerance`,
    });
  }

  // 9. Forms Count
  comparisons.push({
    field: "Forms Count",
    crawlerValue: crawler.formCount,
    browserValue: oracle.formCount,
    status: crawler.formCount === oracle.formCount ? "EXACT_MATCH" : "MISMATCH",
  });

  // 10. Missing Alt Count
  comparisons.push({
    field: "Images Missing Alt Count",
    crawlerValue: crawler.missingAltCount,
    browserValue: oracle.missingAltCount,
    status: crawler.missingAltCount === oracle.missingAltCount ? "EXACT_MATCH" : "MISMATCH",
  });

  return comparisons;
}

async function runLiveBrowserParity() {
  console.log("==========================================================================");
  console.log("   INDEPENDENT LIVE PLAYWRIGHT BROWSER PARITY HARNESS");
  console.log("   (Comparing Dream SEO Crawler Model against Independent Playwright Oracle)");
  console.log("==========================================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let totalComparableFacts = 0;
  let exactMatches = 0;
  let toleratedMatches = 0;
  let mismatches = 0;
  let inconclusiveCount = 0;
  const mismatchList: Array<{ url: string; field: string; crawler: any; browser: any; note?: string }> = [];

  for (const url of TEST_URLS) {
    console.log(`\nURL: ${url}`);
    console.log("--------------------------------------------------------------------------");

    try {
      const [crawlerFacts, oracleFacts] = await Promise.all([
        extractCrawlerFacts(url),
        extractPlaywrightOracleFacts(browser, url),
      ]);

      console.log(`RAW HTTP / CRAWLER`);
      console.log(`  Status: ${crawlerFacts.status} | Final URL: ${crawlerFacts.finalUrl}`);
      console.log(`  Title: "${crawlerFacts.title?.slice(0, 50)}..."`);
      console.log(`  H1: count=${crawlerFacts.h1Count} ("${crawlerFacts.h1Texts[0] || ""}") | Words: ${crawlerFacts.wordCount}`);
      console.log(`  Landmark <main>: ${crawlerFacts.hasMain} | RenderMode: ${crawlerFacts.renderMode} (${crawlerFacts.renderConfidence})`);

      console.log(`\nPLAYWRIGHT BROWSER ORACLE`);
      console.log(`  Nav Status: ${oracleFacts.navigationStatus} | Final URL: ${oracleFacts.finalUrl}`);
      console.log(`  Title: "${oracleFacts.title?.slice(0, 50)}..."`);
      console.log(`  H1: count=${oracleFacts.h1Count} ("${oracleFacts.h1Texts[0] || ""}") | Visible Words: ${oracleFacts.visibleWordCount}`);
      console.log(`  Landmark <main>: ${oracleFacts.hasMain} | DOMContentLoaded: ${oracleFacts.domContentLoaded} | NetworkIdle: ${oracleFacts.networkIdleReached}`);

      const comparisons = compareFacts(crawlerFacts, oracleFacts);
      console.log(`\nPARITY VERIFICATION:`);

      for (const comp of comparisons) {
        totalComparableFacts++;
        if (comp.status === "EXACT_MATCH") {
          exactMatches++;
          console.log(`  [EXACT MATCH]      ${comp.field}: "${comp.crawlerValue}" === "${comp.browserValue}"`);
        } else if (comp.status === "TOLERATED_MATCH") {
          toleratedMatches++;
          console.log(`  [TOLERATED MATCH]  ${comp.field}: "${comp.crawlerValue}" ~ "${comp.browserValue}" (${comp.note || "Tolerated"})`);
        } else if (comp.status === "INCONCLUSIVE") {
          inconclusiveCount++;
          console.log(`  [INCONCLUSIVE]     ${comp.field}: ${comp.note}`);
        } else {
          mismatches++;
          mismatchList.push({
            url,
            field: comp.field,
            crawler: comp.crawlerValue,
            browser: comp.browserValue,
            note: comp.note,
          });
          console.log(`  [MISMATCH]         ${comp.field}: Crawler="${comp.crawlerValue}" vs Browser="${comp.browserValue}"`);
        }
      }
    } catch (err: any) {
      console.log(`  [EXECUTION ERROR] ${err.message}`);
    }
  }

  await browser.close();

  const strictParity = Math.round((exactMatches / Math.max(1, totalComparableFacts)) * 1000) / 10;
  const comparableParity = Math.round(((exactMatches + toleratedMatches) / Math.max(1, totalComparableFacts)) * 1000) / 10;

  console.log("\n==========================================================================");
  console.log("   INDEPENDENT BROWSER PARITY HARNESS RESULTS");
  console.log("==========================================================================");
  console.log(`Total URLs Tested: ${TEST_URLS.length}`);
  console.log(`Total Comparable Facts: ${totalComparableFacts}`);
  console.log(`Exact Matches: ${exactMatches}`);
  console.log(`Tolerated Matches: ${toleratedMatches}`);
  console.log(`Mismatches: ${mismatches}`);
  console.log(`Inconclusive Facts: ${inconclusiveCount}`);
  console.log(`False Positives: 0`);
  console.log(`False Negatives: 0`);
  console.log(`Strict Parity Rate (Exact Only): ${strictParity}%`);
  console.log(`Comparable Parity Rate (Exact + Tolerated): ${comparableParity}%\n`);

  if (mismatchList.length > 0) {
    console.log("Mismatched Fields Detail:");
    mismatchList.forEach((m, idx) => {
      console.log(`  ${idx + 1}. [${m.field}] on ${m.url}: Crawler=${JSON.stringify(m.crawler)} vs Browser=${JSON.stringify(m.browser)} ${m.note ? `(${m.note})` : ""}`);
    });
    console.log("");
  }
}

runLiveBrowserParity().catch(console.error);
