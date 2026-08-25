/**
 * Strategy Registry for Fix Intelligence.
 */

import type { RuleFixStrategy } from "./base";
import { IndexabilityRobotsStrategy } from "./indexability-robots-strategy";
import { CanonicalRedirectsStrategy } from "./canonical-redirects-strategy";
import { LinksArchitectureStrategy } from "./links-architecture-strategy";
import { ContentHeadingsStrategy } from "./content-headings-strategy";
import { DuplicateContentStrategy } from "./duplicate-content-strategy";
import { AssetsImagesStrategy } from "./assets-images-strategy";
import { StructuredDataSocialStrategy } from "./structured-data-social-strategy";
import { InternationalHreflangStrategy } from "./international-hreflang-strategy";
import { MobileTechnicalStrategy } from "./mobile-technical-strategy";
import { AccessibilityLiteStrategy } from "./accessibility-lite-strategy";
import { PerformanceCwvStrategy } from "./performance-cwv-strategy";

export const ALL_FIX_STRATEGIES: RuleFixStrategy[] = [
  new IndexabilityRobotsStrategy(),
  new CanonicalRedirectsStrategy(),
  new LinksArchitectureStrategy(),
  new ContentHeadingsStrategy(),
  new DuplicateContentStrategy(),
  new AssetsImagesStrategy(),
  new StructuredDataSocialStrategy(),
  new InternationalHreflangStrategy(),
  new MobileTechnicalStrategy(),
  new AccessibilityLiteStrategy(),
  new PerformanceCwvStrategy(),
];

export function findFixStrategyForRule(ruleCode: string): RuleFixStrategy | undefined {
  return ALL_FIX_STRATEGIES.find((s) => s.canHandle(ruleCode));
}
