export interface LighthouseMetricSummary {
  score: number | null;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  tbt: number | null;
  fcp: number | null;
  rawCategoryScores: Record<string, number | null>;
}

export interface LighthouseRunRecord {
  id: string;
  url: string;
  createdAt: string;
  mobile: LighthouseMetricSummary;
  desktop: LighthouseMetricSummary;
  raw: {
    mobile: unknown;
    desktop: unknown;
  };
  reports?: {
    mobile: string;
    desktop: string;
  };
}
