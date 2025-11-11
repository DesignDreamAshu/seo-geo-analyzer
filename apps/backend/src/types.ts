export type FormFactor = "mobile" | "desktop";

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

export interface ModuleSnapshot {
  id: string;
  name: string;
  score: number;
  weight: number;
  recommendations: string[];
  issues: {
    critical: number;
    warning: number;
    info: number;
  };
  lastChecked?: string | null;
}

export interface HistorySnapshot {
  timestamp: string;
  overallScore: number;
}

export interface ExportPayload {
  url: string;
  country: string;
  modules: ModuleSnapshot[];
  historySnapshots?: HistorySnapshot[];
  groupedRecommendations?: Record<"critical" | "warnings" | "improvements", string[]>;
}

export interface ShareRecord {
  token: string;
  createdAt: string;
  expiresAt: string;
  payload: ExportPayload;
}
