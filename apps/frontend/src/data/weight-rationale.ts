export const weightRationale: Record<string, string> = {
  "meta-titles": "Meta titles influence SERP snippets directly, so we keep them at 10% to ensure copy accuracy without overweighting editorial work.",
  "content-readability": "Content quality remains a primary ranking factor; 15% reflects long-form impact on engagement and rankings.",
  "schema-structured": "Structured data unlocks rich results and disambiguates entities, so its weight is increased to 15%.",
  "image-alt": "Accessibility and descriptive media provide both UX wins and compliance, justifying a full 10%.",
  "links-navigation": "Internal link architecture determines crawl depth; 10% keeps it on parity with other technical modules.",
  "sitemap-indexing": "Search engines still depend on crawl directives, so sitemap/indexing retains a 10% share.",
  performance: "Core Web Vitals are mandatory for search eligibility, so they now carry 15% of the score.",
  "geo-localization": "Regional hreflang hygiene matters for multinational SERPs, so GEO receives a dedicated 10%.",
  security: "Security & HTTPS signals now include accessibility safeguards, elevating the combined weight to 10%.",
  "social-opengraph": "Awareness channels still matter, but we cap them at 5% to prioritize on-site fixes.",
};

export const getWeightRationale = (moduleId: string) => weightRationale[moduleId] ?? null;
