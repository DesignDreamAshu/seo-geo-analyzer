import type { Document } from "linkedom";

export type IssueSeverity = keyof IssueBuckets;

export interface DetectorIssue {
  summary: string;
  details?: Record<string, unknown>;
}

export interface IssueBuckets {
  critical: DetectorIssue[];
  warnings: DetectorIssue[];
  improvements: DetectorIssue[];
}

export interface DetectorResult<Checks extends Record<string, unknown>> {
  module: string;
  checks: Checks;
  issues: IssueBuckets;
}

export interface FetchContext {
  url: URL;
  html: string;
  document: Document;
}

export interface DetectorRuntimeContext extends FetchContext {
  robotsTxt?: string | null;
}
