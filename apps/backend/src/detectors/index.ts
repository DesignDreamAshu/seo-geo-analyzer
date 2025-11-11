import { DetectorResult, DetectorRuntimeContext } from "./types";
import {
  absoluteUrl,
  collectJsonLdByType,
  computeSimHash,
  createIssueBuckets,
  extractJsonLdPayloads,
  fetchDocument,
  pushIssue,
  simHashSimilarity,
  tokenize,
} from "./utils";

interface Detector {
  (context: DetectorRuntimeContext): Promise<DetectorResult<Record<string, unknown>>>;
}

const USER_AGENT = "DreamSEO-AuditBot/1.0 (+https://dreamseo.dev)";

async function fetchRobotsTxt(url: URL): Promise<string | null> {
  try {
    const response = await fetch(new URL("/robots.txt", url.origin), {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

const detectFavicon: Detector = async ({ document, url }) => {
  const buckets = createIssueBuckets();
  const iconNodes = Array.from(
    document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'),
  );

  const icons = iconNodes
    .map((node) => ({
      href: absoluteUrl(node.getAttribute("href"), url),
      rel: node.getAttribute("rel") ?? "",
      sizes: node.getAttribute("sizes") ?? "",
      type: node.getAttribute("type") ?? "",
    }))
    .filter((icon) => Boolean(icon.href));

  if (!icons.length) {
    pushIssue(buckets, "critical", {
      summary: "No favicon declared",
      details: {
        recommendation: "Add at least one <link rel=\"icon\" ...> that points to a 32x32 or SVG icon.",
      },
    });
  }

  const fallbackUrl = new URL("/favicon.ico", url.origin).toString();
  let fallbackReachable = false;
  try {
    const response = await fetch(fallbackUrl, { method: "HEAD", headers: { "User-Agent": USER_AGENT } });
    fallbackReachable = response.ok;
    if (!response.ok) {
      throw new Error("bad status");
    }
  } catch {
    if (!icons.length) {
      pushIssue(buckets, "warnings", {
        summary: "favicon.ico not reachable",
        details: {
          recommendation: "Host a fallback favicon.ico at the site root to satisfy legacy agents.",
        },
      });
    }
  }

  return {
    module: "metadata",
    checks: {
      declaredIcons: icons,
      fallbackUrl,
      fallbackReachable,
    },
    issues: buckets,
  };
};

const detectCanonical: Detector = async ({ document, url }) => {
  const buckets = createIssueBuckets();
  const canonicalNode = document.querySelector('link[rel="canonical"]');
  const canonicalHref = absoluteUrl(canonicalNode?.getAttribute("href"), url);

  if (!canonicalHref) {
    pushIssue(buckets, "warnings", {
      summary: "Missing canonical tag",
      details: {
        recommendation: "Add <link rel=\"canonical\" href=\"...\" /> within <head>.",
      },
    });
  } else {
    const normalizedRequested = url.toString().replace(/\/$/, "");
    const normalizedCanonical = canonicalHref.replace(/\/$/, "");
    if (normalizedCanonical !== normalizedRequested) {
      pushIssue(buckets, "warnings", {
        summary: "Canonical URL does not match crawled URL",
        details: {
          canonicalHref,
          requestedUrl: url.toString(),
        },
      });
    }
  }

  return {
    module: "metadata",
    checks: {
      canonicalHref,
    },
    issues: buckets,
  };
};

const detectRobotsMeta: Detector = async ({ document }) => {
  const buckets = createIssueBuckets();
  const meta = document.querySelector('meta[name="robots" i]');
  const content = meta?.getAttribute("content") ?? "";
  const directives = content
    .split(/[;,]/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (directives.includes("noindex")) {
    pushIssue(buckets, "critical", {
      summary: "Robots meta is set to noindex",
      details: {
        directives,
        recommendation: "Remove noindex unless the page must be excluded from search results.",
      },
    });
  }
  if (directives.includes("nofollow")) {
    pushIssue(buckets, "warnings", {
      summary: "nofollow directive detected",
      details: {
        directives,
        recommendation: "Ensure this is intentional as it blocks link equity from flowing outward.",
      },
    });
  }

  return {
    module: "metadata",
    checks: {
      hasMetaRobots: Boolean(meta),
      directives,
    },
    issues: buckets,
  };
};

const detectRobotsTxt: Detector = async (context) => {
  const buckets = createIssueBuckets();
  const robotsTxt = context.robotsTxt ?? (await fetchRobotsTxt(context.url));

  if (!robotsTxt) {
    pushIssue(buckets, "warnings", {
      summary: "robots.txt missing or not reachable",
      details: {
        recommendation: "Provide a robots.txt file even if it is empty to clarify crawl policy.",
      },
    });
    return {
      module: "sitemap_indexing",
      checks: {
        reachable: false,
      },
      issues: buckets,
    };
  }

  const lines = robotsTxt
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);

  const userAgents: Record<string, { allow: string[]; disallow: string[] }> = {};
  const sitemaps: string[] = [];
  let currentAgent: string | null = null;

  lines.forEach((line) => {
    const [directiveRaw, valueRaw] = line.split(":").map((chunk) => chunk.trim());
    if (!directiveRaw || !valueRaw) return;

    const directive = directiveRaw.toLowerCase();

    switch (directive) {
      case "user-agent":
        currentAgent = valueRaw.toLowerCase();
        if (!userAgents[currentAgent]) {
          userAgents[currentAgent] = { allow: [], disallow: [] };
        }
        break;
      case "allow":
        if (currentAgent) {
          userAgents[currentAgent].allow.push(valueRaw);
        }
        break;
      case "disallow":
        if (currentAgent) {
          userAgents[currentAgent].disallow.push(valueRaw);
        }
        break;
      case "sitemap":
        sitemaps.push(valueRaw);
        break;
      default:
        break;
    }
  });

  const universal = userAgents["*"];
  if (universal?.disallow.includes("/")) {
    pushIssue(buckets, "critical", {
      summary: "robots.txt blocks all crawling",
      details: {
        directive: "Disallow: /",
        userAgent: "*",
      },
    });
  }

  if (!sitemaps.length) {
    pushIssue(buckets, "improvements", {
      summary: "No sitemap declared in robots.txt",
      details: {
        recommendation: "Add Sitemap: https://example.com/sitemap.xml so crawlers can find it faster.",
      },
    });
  }

  return {
    module: "sitemap_indexing",
    checks: {
      reachable: true,
      userAgents,
      sitemaps,
    },
    issues: buckets,
  };
};

const detectAmpLink: Detector = async ({ document, url }) => {
  const buckets = createIssueBuckets();

  const ampLink = document.querySelector('link[rel="amphtml"]');
  const ampHref = absoluteUrl(ampLink?.getAttribute("href"), url);
  const isAmpPage =
    document.documentElement.hasAttribute("amp") || document.documentElement.hasAttribute("⚡") || Boolean(ampHref);

  if (!isAmpPage) {
    pushIssue(buckets, "improvements", {
      summary: "AMP version not detected",
      details: {
        recommendation: "Consider serving an AMP variant for news or content-heavy pages where applicable.",
      },
    });
  }

  return {
    module: "amp_mobile",
    checks: {
      hasAmpAttribute:
        document.documentElement.hasAttribute("amp") || document.documentElement.hasAttribute("⚡"),
      ampHref,
    },
    issues: buckets,
  };
};

const detectMobileViewport: Detector = async ({ document }) => {
  const buckets = createIssueBuckets();
  const viewportMeta = document.querySelector('meta[name="viewport" i]');
  const viewportContent = viewportMeta?.getAttribute("content") ?? "";

  if (!viewportMeta) {
    pushIssue(buckets, "critical", {
      summary: "Viewport meta missing",
      details: {
        recommendation: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />.",
      },
    });
  } else {
    if (!/width\s*=\s*device-width/i.test(viewportContent)) {
      pushIssue(buckets, "warnings", {
        summary: "Viewport missing width=device-width",
        details: {
          viewportContent,
        },
      });
    }
    if (!/initial-scale\s*=\s*1/i.test(viewportContent)) {
      pushIssue(buckets, "improvements", {
        summary: "Viewport missing initial-scale=1",
        details: {
          viewportContent,
        },
      });
    }
  }

  return {
    module: "performance",
    checks: {
      viewportContent: viewportContent || null,
      hasViewport: Boolean(viewportMeta),
    },
    issues: buckets,
  };
};

async function safeHeadRequest(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT },
    });
    if (response.status === 405) {
      const fallback = await fetch(url, { method: "GET", redirect: "manual", headers: { "User-Agent": USER_AGENT } });
      return fallback;
    }
    return response;
  } catch (error) {
    return { ok: false, status: 0, statusText: (error as Error).message } as Response;
  }
}

const detectExternalLinkHealth: Detector = async ({ document, url }) => {
  const buckets = createIssueBuckets();
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const origin = url.origin;
  const seen = new Set<string>();
  const externalLinks: string[] = [];

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    const absolute = absoluteUrl(href, url);
    if (!absolute) continue;
    if (absolute.startsWith(origin)) continue;
    const normalized = absolute.replace(/#.*$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    externalLinks.push(normalized);
    if (externalLinks.length >= 10) break;
  }

  const linkResults = await Promise.all(
    externalLinks.map(async (link) => {
      const response = await safeHeadRequest(link);
      return {
        url: link,
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      };
    }),
  );

  linkResults.forEach((result) => {
    if (!result.ok) {
      const severity = result.status >= 500 || result.status === 0 ? "critical" : "warnings";
      pushIssue(buckets, severity as "critical" | "warnings", {
        summary: `External link fails with status ${result.status || "N/A"}`,
        details: {
          url: result.url,
          status: result.status,
          statusText: result.statusText,
        },
      });
    }
  });

  return {
    module: "links_navigation",
    checks: {
      sampledLinks: linkResults,
    },
    issues: buckets,
  };
};

const detectGeoLocalization: Detector = async ({ document, url }) => {
  const buckets = createIssueBuckets();
  const payloads = extractJsonLdPayloads(document);

  const localBusinessNodes = collectJsonLdByType(payloads, (types) => types.includes("localbusiness"));
  const postalAddressNodes = collectJsonLdByType(payloads, (types) => types.includes("postaladdress"));

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  const sanitizeAddress = (node: Record<string, unknown>) => {
    const countryNode = node["addressCountry"];
    let addressCountry: string | null = null;
    if (typeof countryNode === "string") {
      addressCountry = countryNode;
    } else if (countryNode && typeof countryNode === "object") {
      const name = (countryNode as Record<string, unknown>)["name"];
      addressCountry = typeof name === "string" ? name : null;
    }

    return {
      streetAddress: typeof node["streetAddress"] === "string" ? node["streetAddress"] : null,
      addressLocality: typeof node["addressLocality"] === "string" ? node["addressLocality"] : null,
      addressRegion: typeof node["addressRegion"] === "string" ? node["addressRegion"] : null,
      postalCode: typeof node["postalCode"] === "string" ? node["postalCode"] : null,
      addressCountry,
    };
  };

  const parseCoordinate = (value: unknown) => {
    const parsed = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };

  const geoCoordinates: { latitude: number | null; longitude: number | null; sourceId?: string }[] = [];
  const localBusinessSchemas = localBusinessNodes.map((node) => {
    const geoNode = asRecord(node["geo"]);
    const latitude = geoNode ? parseCoordinate(geoNode["latitude"]) : null;
    const longitude = geoNode ? parseCoordinate(geoNode["longitude"]) : null;
    if (latitude !== null || longitude !== null) {
      geoCoordinates.push({
        latitude,
        longitude,
        sourceId: (node["@id"] as string) ?? (node["name"] as string) ?? undefined,
      });
    }

    const sameAsRaw = Array.isArray(node["sameAs"]) ? node["sameAs"] : node["sameAs"] ? [node["sameAs"]] : [];
    const sameAs = sameAsRaw.filter((value): value is string => typeof value === "string");

    return {
      id: (node["@id"] as string) ?? null,
      name: typeof node["name"] === "string" ? node["name"] : null,
      url: typeof node["url"] === "string" ? node["url"] : null,
      address: asRecord(node["address"]) ? sanitizeAddress(asRecord(node["address"])!) : null,
      geo: latitude !== null || longitude !== null ? { latitude, longitude } : null,
      sameAs,
    };
  });

  const postalAddresses = postalAddressNodes.map((node) => sanitizeAddress(node));

  const anchorLinks = Array.from(document.querySelectorAll("a[href]")).map((anchor) =>
    absoluteUrl(anchor.getAttribute("href"), url),
  );

  const googleLinkPatterns = [/google\.com\/maps/i, /goo\.gl\/maps/i, /g\.page/i, /google\.com\/maps\/place/i];

  const googleBusinessLinks = new Set<string>();
  anchorLinks.forEach((link) => {
    if (!link) return;
    if (googleLinkPatterns.some((pattern) => pattern.test(link))) {
      googleBusinessLinks.add(link);
    }
  });

  localBusinessSchemas.forEach((schema) => {
    schema.sameAs?.forEach((link) => {
      if (typeof link !== "string") return;
      if (googleLinkPatterns.some((pattern) => pattern.test(link))) {
        googleBusinessLinks.add(link);
      }
    });
  });

  const normalizeLang = (value: string | null | undefined) => value?.toLowerCase().replace("_", "-") ?? null;
  const htmlLang = normalizeLang(document.documentElement.getAttribute("lang"));

  const hreflangSet = new Set(
    Array.from(document.querySelectorAll('link[rel="alternate" i][hreflang]'))
      .map((link) => normalizeLang(link.getAttribute("hreflang")))
      .filter((value): value is string => Boolean(value)),
  );

  const base = htmlLang?.split("-")[0] ?? null;
  const hreflangValues = Array.from(hreflangSet);
  const hasBaseMatch =
    Boolean(base) && hreflangValues.some((value) => value.split("-")[0] === base || value === base);
  const hasExactMatch = htmlLang ? hreflangSet.has(htmlLang) : false;

  if (!localBusinessSchemas.length) {
    pushIssue(buckets, "improvements", {
      summary: "LocalBusiness schema not detected",
      details: {
        recommendation: "Add JSON-LD LocalBusiness markup with address, contact, and geo coordinates.",
      },
    });
  }

  if (!postalAddresses.length) {
    pushIssue(buckets, "improvements", {
      summary: "PostalAddress schema missing",
      details: {
        recommendation: "Embed PostalAddress inside LocalBusiness or appropriate schema for GEO targeting.",
      },
    });
  }

  if (!geoCoordinates.length) {
    pushIssue(buckets, "warnings", {
      summary: "Geo coordinates not found in schema",
      details: {
        recommendation: "Provide geo.latitude and geo.longitude to improve map visibility.",
      },
    });
  }

  if (!googleBusinessLinks.size) {
    pushIssue(buckets, "improvements", {
      summary: "Google Business Profile link not detected",
      details: {
        recommendation: "Link to your Google Business Profile (Google Maps) from the page or schema.",
      },
    });
  }

  if (!htmlLang) {
    pushIssue(buckets, "warnings", {
      summary: "<html lang> attribute missing",
      details: {
        recommendation: "Set <html lang=\"en\"> (or relevant locale) to aid hreflang validation.",
      },
    });
  } else if (!hreflangSet.size) {
    pushIssue(buckets, "improvements", {
      summary: "hreflang references missing",
      details: {
        recommendation: "Add <link rel=\"alternate\" hreflang=\"...\" href=\"...\"> for localized variants.",
      },
    });
  } else if (!hasBaseMatch) {
    pushIssue(buckets, "warnings", {
      summary: "hreflang values do not match <html lang>",
      details: {
        htmlLang,
        hreflangValues,
      },
    });
  } else if (!hasExactMatch) {
    pushIssue(buckets, "improvements", {
      summary: "Exact hreflang for <html lang> missing",
      details: {
        htmlLang,
        hreflangValues,
      },
    });
  }

  return {
    module: "geo_localization",
    checks: {
      localBusinessSchemas,
      postalAddresses,
      geoCoordinates,
      googleBusinessLinks: Array.from(googleBusinessLinks),
      htmlLang,
      hreflangValues,
      langParity: {
        hasHreflang: hreflangSet.size > 0,
        hasExactMatch,
        hasBaseMatch,
      },
    },
    issues: buckets,
  };
};

const detectDuplicateContent: Detector = async ({ document }) => {
  const buckets = createIssueBuckets();
  const nodes = Array.from(document.querySelectorAll("main, article, section, p, li, h1, h2, h3"));
  const chunks = nodes
    .map((node) => node.textContent?.trim() ?? "")
    .filter((text) => text.length >= 120)
    .slice(0, 40);

  const fingerprints = chunks.map((text, index) => ({
    index,
    preview: text.slice(0, 140),
    tokens: tokenize(text).length,
    hash: computeSimHash(text),
  }));

  const duplicates: { a: number; b: number; similarity: number }[] = [];
  for (let i = 0; i < fingerprints.length; i += 1) {
    for (let j = i + 1; j < fingerprints.length; j += 1) {
      const similarity = simHashSimilarity(fingerprints[i].hash, fingerprints[j].hash);
      if (similarity >= 0.92) {
        duplicates.push({ a: i, b: j, similarity: Number(similarity.toFixed(3)) });
      }
    }
  }

  if (duplicates.length >= 3) {
    pushIssue(buckets, "warnings", {
      summary: "Multiple sections of the page appear near-identical",
      details: {
        duplicates,
      },
    });
  } else if (duplicates.length) {
    pushIssue(buckets, "improvements", {
      summary: "Some sections repeat similar content",
      details: {
        duplicates,
      },
    });
  }

  return {
    module: "duplicate_content",
    checks: {
      fingerprintCount: fingerprints.length,
      duplicates,
      samples: fingerprints.slice(0, 5),
    },
    issues: buckets,
  };
};

const detectStructuredData: Detector = async ({ document, url }) => {
  const buckets = createIssueBuckets();
  const payloads = extractJsonLdPayloads(document);

  const getSchemas = (type: string) => collectJsonLdByType(payloads, (types) => types.includes(type.toLowerCase()));

  const faqSchemas = getSchemas("faqpage");
  const breadcrumbSchemas = getSchemas("breadcrumblist");
  const websiteSchemas = getSchemas("website");
  const webPageSchemas = getSchemas("webpage");

  if (!faqSchemas.length) {
    pushIssue(buckets, "improvements", {
      summary: "FAQPage schema not detected",
      details: {
        recommendation: "Add FAQPage JSON-LD when you provide Q&A style content to unlock FAQ rich results.",
      },
    });
  } else {
    const faqWithQuestions = faqSchemas.filter((schema) => {
      const mainEntity = schema["mainEntity"];
      if (!mainEntity) return false;
      if (Array.isArray(mainEntity)) {
        return mainEntity.every((entity) => entity && typeof entity === "object" && "name" in entity && "acceptedAnswer" in entity);
      }
      return false;
    });
    if (faqWithQuestions.length !== faqSchemas.length) {
      pushIssue(buckets, "warnings", {
        summary: "Some FAQPage schemas lack valid questions/answers",
        details: {
          totalFaqSchemas: faqSchemas.length,
        },
      });
    }
  }

  if (!breadcrumbSchemas.length) {
    pushIssue(buckets, "improvements", {
      summary: "BreadcrumbList schema missing",
      details: {
        recommendation: "Add BreadcrumbList JSON-LD to help Google understand navigation hierarchy.",
      },
    });
  }

  let hasWebsiteSearchAction = false;
  websiteSchemas.forEach((schema) => {
    const potentialAction = schema["potentialAction"];
    const actions = Array.isArray(potentialAction) ? potentialAction : potentialAction ? [potentialAction] : [];
    actions.forEach((action) => {
      if (!action || typeof action !== "object") return;
      const types = Array.isArray(action["@type"]) ? action["@type"] : [action["@type"]];
      if (types?.some((type) => String(type).toLowerCase() === "searchaction")) {
        const target = action["target"];
        const hasTargetVariable =
          typeof target === "string"
            ? target.includes("{search_term_string}")
            : typeof target === "object" && target && "urlTemplate" in target
              ? String((target as Record<string, unknown>).urlTemplate).includes("{search_term_string}")
              : false;
        const queryInput = action["query-input"] ?? action["queryInput"];
        const hasQueryInput = typeof queryInput === "string" ? queryInput.includes("required") : false;
        if (hasTargetVariable && hasQueryInput) {
          hasWebsiteSearchAction = true;
        }
      }
    });
  });

  if (!websiteSchemas.length) {
    pushIssue(buckets, "warnings", {
      summary: "WebSite schema not detected",
      details: {
        recommendation: "Include WebSite JSON-LD with SearchAction so sitelinks search box can appear in SERPs.",
      },
    });
  } else if (!hasWebsiteSearchAction) {
    pushIssue(buckets, "improvements", {
      summary: "WebSite schema missing SearchAction",
      details: {
        recommendation: "Define potentialAction SearchAction with target containing {search_term_string}.",
      },
    });
  }

  if (!webPageSchemas.length) {
    pushIssue(buckets, "warnings", {
      summary: "WebPage schema not detected",
      details: {
        recommendation: "Declare WebPage JSON-LD describing the current page to reinforce context.",
      },
    });
  }

  const richResultsPreviewUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(url.toString())}`;

  return {
    module: "schema_structured",
    checks: {
      faqCount: faqSchemas.length,
      breadcrumbCount: breadcrumbSchemas.length,
      websiteCount: websiteSchemas.length,
      webPageCount: webPageSchemas.length,
      hasWebsiteSearchAction,
      richResultsPreviewUrl,
    },
    issues: buckets,
  };
};

const detectors: Detector[] = [
  detectFavicon,
  detectCanonical,
  detectRobotsMeta,
  detectRobotsTxt,
  detectAmpLink,
  detectMobileViewport,
  detectExternalLinkHealth,
  detectGeoLocalization,
  detectStructuredData,
  detectDuplicateContent,
];

export async function runTechnicalDetectors(targetUrl: string): Promise<DetectorResult<Record<string, unknown>>[]> {
  const normalized = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
  const url = new URL(normalized);
  const { document, html } = await fetchDocument(url.toString());
  const robotsTxt = await fetchRobotsTxt(url);

  const context: DetectorRuntimeContext = {
    url,
    document,
    html,
    robotsTxt,
  };

  const results: DetectorResult<Record<string, unknown>>[] = [];
  for (const detector of detectors) {
    try {
      const result = await detector(context);
      results.push(result);
    } catch (error) {
      results.push({
        module: "internal_error",
        checks: {
          detector: detector.name || "anonymous",
        },
        issues: {
          critical: [
            {
              summary: "Detector failed",
              details: {
                message: (error as Error).message,
              },
            },
          ],
          warnings: [],
          improvements: [],
        },
      });
    }
  }

  return results;
}

export * from "./types";
