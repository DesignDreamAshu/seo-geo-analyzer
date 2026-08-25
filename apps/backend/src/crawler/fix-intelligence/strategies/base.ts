/**
 * Fix Strategy Registry and Context Types.
 */

import type { DiagnosticIssue, CrawledPageData } from "../../types";
import type { SeoFixIntelligence, SupportedPlatform } from "../types";

export interface FixContext {
  platform: SupportedPlatform;
  allPages?: CrawledPageData[];
  targetSite?: string;
  isCmsPage?: boolean;
  templateName?: string;
}

export interface RuleFixStrategy {
  canHandle(ruleCode: string): boolean;
  buildFixIntelligence(issue: DiagnosticIssue, context: FixContext): SeoFixIntelligence;
}
