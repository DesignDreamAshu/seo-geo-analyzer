import * as cheerio from "cheerio";

export async function probeArBotMarketplaceLink() {
  const sourceUrl = "https://www.botconsulting.io/post/ar-bot-ai-powered-accounts-receivable-automation-on-servicenow";
  console.log(`[Direct Probe] Requesting historical URL: ${sourceUrl}`);
  
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    });

    const httpStatus = res.status;
    const finalUrl = res.url;

    if (httpStatus === 404) {
      return {
        requestedSourceUrl: sourceUrl,
        targetUrl: "https://store.servicenow.com/",
        anchorText: "Explore AR.BOT on ServiceNow Marketplace",
        status: "SOURCE_PAGE_404" as const,
        httpStatus,
        finalUrl,
        targetAnchorFound: false,
        evidence: `Direct HTTP probe returned 404 Not Found. Historical article has been permanently removed or unpublished.`,
        notes: "Historical broken link task is NOT_APPLICABLE because source page no longer exists on live site.",
      };
    }

    if (res.redirected && finalUrl !== sourceUrl) {
      return {
        requestedSourceUrl: sourceUrl,
        targetUrl: "https://store.servicenow.com/",
        anchorText: "Explore AR.BOT on ServiceNow Marketplace",
        status: "SOURCE_PAGE_REDIRECTED" as const,
        httpStatus,
        finalUrl,
        targetAnchorFound: false,
        evidence: `Direct HTTP request redirected to ${finalUrl}.`,
        notes: "Source article redirected permanently.",
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const pageTitle = $("title").text().trim();

    let foundAnchorText = "";
    let foundHref = "";

    $("a").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href") || "";
      if (
        text.toLowerCase().includes("servicenow marketplace") ||
        text.includes("Explore AR.BOT") ||
        href.includes("store.servicenow.com")
      ) {
        foundAnchorText = text;
        foundHref = href;
      }
    });

    if (!foundHref) {
      return {
        requestedSourceUrl: sourceUrl,
        targetUrl: "https://store.servicenow.com/",
        anchorText: "Explore AR.BOT on ServiceNow Marketplace",
        status: "SOURCE_PAGE_ACTIVE_LINK_NOT_PRESENT" as const,
        httpStatus,
        finalUrl,
        pageTitle,
        targetAnchorFound: false,
        evidence: `Source page ${sourceUrl} is 200 OK (Title: "${pageTitle}"), but no link matching "ServiceNow Marketplace" exists in DOM.`,
        notes: "Link was previously removed from article body.",
      };
    }

    // Probe the destination link
    try {
      const destRes = await fetch(foundHref, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        redirect: "follow",
      });

      const destStatus = destRes.status;
      const destUrl = destRes.url;

      if (destStatus >= 200 && destStatus < 400) {
        return {
          requestedSourceUrl: sourceUrl,
          targetUrl: foundHref,
          anchorText: foundAnchorText || "Explore AR.BOT on ServiceNow Marketplace",
          status: "SOURCE_PAGE_ACTIVE_LINK_VALID" as const,
          httpStatus,
          finalUrl,
          pageTitle,
          targetAnchorFound: true,
          rawHref: foundHref,
          resolvedDestination: destUrl,
          evidence: `Source page 200 OK. Outbound link to ${foundHref} resolves with HTTP ${destStatus} (${destUrl}).`,
          notes: "Link is active and valid.",
        };
      } else {
        return {
          requestedSourceUrl: sourceUrl,
          targetUrl: foundHref,
          anchorText: foundAnchorText || "Explore AR.BOT on ServiceNow Marketplace",
          status: "SOURCE_PAGE_ACTIVE_LINK_BROKEN" as const,
          httpStatus,
          finalUrl,
          pageTitle,
          targetAnchorFound: true,
          rawHref: foundHref,
          resolvedDestination: destUrl,
          evidence: `Source page 200 OK, but target link to ${foundHref} returns HTTP ${destStatus}.`,
          notes: "Target link requires fix.",
        };
      }
    } catch (targetErr: any) {
      return {
        requestedSourceUrl: sourceUrl,
        targetUrl: foundHref,
        anchorText: foundAnchorText || "Explore AR.BOT on ServiceNow Marketplace",
        status: "SOURCE_PAGE_ACTIVE_LINK_BROKEN" as const,
        httpStatus,
        finalUrl,
        pageTitle,
        targetAnchorFound: true,
        rawHref: foundHref,
        evidence: `Target link fetch error: ${targetErr.message}`,
        notes: "Target link fails network connection.",
      };
    }
  } catch (err: any) {
    return {
      requestedSourceUrl: sourceUrl,
      targetUrl: "https://store.servicenow.com/",
      anchorText: "Explore AR.BOT on ServiceNow Marketplace",
      status: "SOURCE_PAGE_INCONCLUSIVE" as const,
      targetAnchorFound: false,
      evidence: `Network error probing source URL: ${err.message}`,
      notes: "Could not establish HTTP connection to source page.",
    };
  }
}
