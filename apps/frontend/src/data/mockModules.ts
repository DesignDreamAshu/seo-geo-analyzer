import { ModuleData } from "@/components/ModuleCard";

export const generateMockModules = (): ModuleData[] => [
  {
    id: "meta-titles",
    name: "Meta & Titles",
    score: 7.5,
    weight: 10,
    issues: {
      critical: 1,
      warning: 2,
      info: 3,
    },
    recommendations: [
      "Title tag exceeds 60 characters on 3 pages",
      "Missing meta description on /about page",
      "Duplicate meta descriptions found on 2 pages",
    ],
    lastChecked: new Date(),
  },
  {
    id: "content-readability",
    name: "Content & Readability",
    score: 8.2,
    weight: 15,
    issues: {
      critical: 0,
      warning: 1,
      info: 2,
    },
    recommendations: [
      "Improve keyword density on homepage",
      "Add more H2 headings for better structure",
    ],
    lastChecked: new Date(),
  },
  {
    id: "schema-structured",
    name: "Schema & Structured Data",
    score: 6.0,
    weight: 15,
    issues: {
      critical: 2,
      warning: 1,
      info: 0,
    },
    recommendations: [
      "Missing Organization schema markup",
      "Product schema incomplete on /products",
      "Add breadcrumb schema for better navigation",
    ],
    lastChecked: new Date(),
  },
  {
    id: "image-alt",
    name: "Image Alt & Accessibility",
    score: 9.0,
    weight: 10,
    issues: {
      critical: 0,
      warning: 0,
      info: 1,
    },
    recommendations: [
      "All images have proper alt text",
      "Consider adding more descriptive alt text for hero images",
    ],
    lastChecked: new Date(),
  },
  {
    id: "links-navigation",
    name: "Links & Navigation",
    score: 8.5,
    weight: 10,
    issues: {
      critical: 0,
      warning: 1,
      info: 2,
    },
    recommendations: [
      "Fix 1 broken internal link on /blog",
      "Add canonical tags to avoid duplicate content",
    ],
    lastChecked: new Date(),
  },
  {
    id: "sitemap-indexing",
    name: "Sitemap & Indexing",
    score: 9.5,
    weight: 10,
    issues: {
      critical: 0,
      warning: 0,
      info: 1,
    },
    recommendations: [
      "XML sitemap is properly configured",
      "All pages are indexed correctly",
    ],
    lastChecked: new Date(),
  },
  {
    id: "performance",
    name: "Performance & Core Web Vitals",
    score: 7.0,
    weight: 15,
    issues: {
      critical: 1,
      warning: 3,
      info: 1,
    },
    recommendations: [
      "Optimize images to improve LCP",
      "Reduce JavaScript bundle size",
      "Enable browser caching",
    ],
    lastChecked: new Date(),
  },
  {
    id: "geo-localization",
    name: "GEO Localization & Hreflang",
    score: 6.5,
    weight: 10,
    issues: {
      critical: 1,
      warning: 2,
      info: 0,
    },
    recommendations: [
      "Add hreflang tags for international targeting",
      "Set correct language and region tags",
      "Add country-specific schema markup",
    ],
    lastChecked: new Date(),
  },
  {
    id: "security",
    name: "Security & HTTPS",
    score: 10.0,
    weight: 10,
    issues: {
      critical: 0,
      warning: 0,
      info: 0,
    },
    recommendations: [
      "SSL certificate is valid and properly configured",
      "All content loads over HTTPS",
    ],
    lastChecked: new Date(),
  },
  {
    id: "social-opengraph",
    name: "Social & Open Graph",
    score: 7.8,
    weight: 5,
    issues: {
      critical: 0,
      warning: 1,
      info: 2,
    },
    recommendations: [
      "Add Twitter card metadata",
      "Optimize Open Graph images for better sharing",
    ],
    lastChecked: new Date(),
  },
];

export const calculateOverallScore = (modules: ModuleData[]): number => {
  if (!modules.length) {
    return 0;
  }

  const { weightedSum, totalWeight } = modules.reduce(
    (acc, module) => {
      acc.weightedSum += module.score * module.weight;
      acc.totalWeight += module.weight;
      return acc;
    },
    { weightedSum: 0, totalWeight: 0 },
  );

  if (totalWeight === 0) {
    return 0;
  }

  const normalizedScore = weightedSum / totalWeight;
  return Math.min(10, Math.max(0, Math.round(normalizedScore * 10) / 10));
};
