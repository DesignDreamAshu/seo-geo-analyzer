/**
 * Resource Security & Mixed Content Fact Extractor (SECURITY S1).
 * Extracts and classifies page subresources, SRI integrity, and mixed-content occurrences.
 */

import * as cheerio from "cheerio";
import type { CrawledPageData } from "../../types";
import type { ResourceSecurityFact, SecurityResourceType } from "../types";

const SRI_HASH_PATTERN = /^(sha256|sha384|sha512)-[A-Za-z0-9+/=]+$/;

function resolveAbsoluteUrl(rawUrl: string, baseUrl: string): string {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

function classifyResourceFromTag(tagName: string, el?: any): SecurityResourceType {
  switch (tagName.toLowerCase()) {
    case "script":
      return "script";
    case "link":
      return "stylesheet";
    case "img":
    case "image":
      return "image";
    case "iframe":
      return "iframe";
    case "audio":
      return "audio";
    case "video":
      return "video";
    default:
      return "other";
  }
}

export function extractPageResources(page: CrawledPageData, seedOriginStr?: string): ResourceSecurityFact[] {
  const facts: ResourceSecurityFact[] = [];
  const sourcePageUrl = page.url;

  let sourcePageOrigin = "";
  let sourcePageIsHttps = false;
  try {
    const parsed = new URL(sourcePageUrl);
    sourcePageOrigin = parsed.origin;
    sourcePageIsHttps = parsed.protocol === "https:";
  } catch {
    return facts;
  }

  const comparisonOrigin = seedOriginStr || sourcePageOrigin;
  const html = page.html || "";
  if (!html) return facts;

  const $ = cheerio.load(html);
  const seenUrls = new Set<string>();

  const processElement = (el: any, rawSrc: string | null | undefined, type: SecurityResourceType) => {
    if (!rawSrc || typeof rawSrc !== "string") return;
    const trimmed = rawSrc.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:") || trimmed.startsWith("blob:")) {
      return;
    }

    const resolvedAbsoluteUrl = resolveAbsoluteUrl(trimmed, sourcePageUrl);
    if (seenUrls.has(resolvedAbsoluteUrl)) return;
    seenUrls.add(resolvedAbsoluteUrl);

    let resOrigin = "";
    let isHttps = false;
    let isInsecureHttp = false;

    try {
      const parsedRes = new URL(resolvedAbsoluteUrl);
      resOrigin = parsedRes.origin;
      isHttps = parsedRes.protocol === "https:";
      isInsecureHttp = parsedRes.protocol === "http:";
    } catch {
      return;
    }

    const isFirstParty = resOrigin === comparisonOrigin || resOrigin === sourcePageOrigin;
    const isThirdParty = !isFirstParty;

    const isMixedContent = sourcePageIsHttps && isInsecureHttp;
    const isActiveType = type === "script" || type === "stylesheet" || type === "iframe";
    const isMixedActiveContent = isMixedContent && isActiveType;
    const isMixedPassiveContent = isMixedContent && !isActiveType;

    const integrityAttr = $(el).attr("integrity")?.trim() || null;
    const hasIntegrity = Boolean(integrityAttr);
    const hasValidSriHash = Boolean(
      integrityAttr &&
        integrityAttr.split(/\s+/).some((hash) => SRI_HASH_PATTERN.test(hash.trim()))
    );

    const crossOriginAttribute = $(el).attr("crossorigin")?.trim() || null;

    facts.push({
      rawUrl: trimmed,
      resolvedAbsoluteUrl,
      resourceOrigin: resOrigin,
      resourceType: type,
      isFirstParty,
      isThirdParty,
      isHttps,
      isInsecureHttp,
      sourcePageUrl,
      sourcePageIsHttps,
      isMixedContent,
      isMixedActiveContent,
      isMixedPassiveContent,
      hasIntegrity,
      integrityAttribute: integrityAttr,
      hasValidSriHash,
      crossOriginAttribute,
    });
  };

  // Scripts
  $("script[src]").each((_, el) => {
    processElement(el, $(el).attr("src"), "script");
  });

  // Stylesheets
  $('link[rel="stylesheet"][href], link[rel="preload"][as="style"][href]').each((_, el) => {
    processElement(el, $(el).attr("href"), "stylesheet");
  });

  // Images
  $("img[src]").each((_, el) => {
    processElement(el, $(el).attr("src"), "image");
  });

  // Iframes
  $("iframe[src]").each((_, el) => {
    processElement(el, $(el).attr("src"), "iframe");
  });

  // Media
  $("video[src], video > source[src]").each((_, el) => {
    processElement(el, $(el).attr("src"), "video");
  });
  $("audio[src], audio > source[src]").each((_, el) => {
    processElement(el, $(el).attr("src"), "audio");
  });

  return facts;
}

export function extractAllMixedContent(resources: ResourceSecurityFact[]): ResourceSecurityFact[] {
  return resources.filter((r) => r.isMixedContent);
}
