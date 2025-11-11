import type { ModuleDefinition } from "./types";

const DEFAULT_ANALYSIS_TIMEOUT_MS = 90_000;
const parsedTimeout = Number(process.env.ANALYSIS_TIMEOUT_MS);

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "performance",
    label: "Performance & Core Web Vitals",
    weight: 15,
    description: "Lab data from PageSpeed Insights for LCP, CLS, INP, and blocking time.",
  },
  {
    key: "schema",
    label: "Schema & Structured Data",
    weight: 15,
    description: "Structured data coverage across JSON-LD, microdata, and RDFa.",
  },
  {
    key: "geo",
    label: "GEO Localization & Hreflang",
    weight: 15,
    description: "Hreflang hygiene, ccTLD alignment, sitemap alternates, and server geolocation.",
  },
  {
    key: "seo_basics",
    label: "SEO Basics",
    weight: 20,
    description: "Title, meta description, canonical tags, robots directives, and sitemap reachability.",
  },
  {
    key: "social",
    label: "Social Preview",
    weight: 10,
    description: "Open Graph, Twitter cards, and preview asset health.",
  },
  {
    key: "security",
    label: "Security & Headers",
    weight: 10,
    description: "HTTPS enforcement, HSTS, anti-sniff, framing protections, and mixed content checks.",
  },
  {
    key: "accessibility",
    label: "Accessibility Lite",
    weight: 10,
    description: "Alt text coverage and landmark elements for basic assistive compliance.",
  },
  {
    key: "links",
    label: "Links & Indexability",
    weight: 5,
    description: "Broken link sampling, rel attributes, and index blocking directives.",
  },
];

export const MODULE_DEFINITION_MAP = new Map(MODULE_DEFINITIONS.map((definition) => [definition.key, definition]));

export const CACHE_TTL_MS = 60_000;
export const ANALYSIS_TIMEOUT_MS =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_ANALYSIS_TIMEOUT_MS;
export const LINK_SAMPLE_LIMIT = 50;
export const USER_AGENT = "DreamSEO Analyzer/1.0 (+https://dreamseo.dev)";
