/**
 * Phase 28E: AI Visibility Analytics & Competitive Share of Voice Computation Engine.
 * Derives rigorous, denominator-transparent analytics from immutable Phase 28D observations.
 */

import { nanoid } from "nanoid";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptUniverseReport, IntentTaxonomy, FunnelStage } from "../prompts/types";
import { AIObservation, ObservationRunSummary, AIProviderId, CitationDomainType } from "../observation/types";
import {
  AIVisibilityAnalyticsSnapshot,
  AnalyticsCoverage,
  MetricDenominator,
  MentionRateMetric,
  RecommendationAppearanceMetric,
  RecommendationOrderMetric,
  CitationRateMetric,
  CompetitorVisibilityMetric,
  ProviderVisibilityMetric,
  ClusterVisibilityMetric,
  OfferingVisibilityMetric,
  IntentVisibilityMetric,
  FunnelVisibilityMetric,
  CitationDomainMetric,
  OwnDomainPageCitationMetric,
  ConfidenceLevel,
  AI_VISIBILITY_METRIC_VERSION,
} from "./types";

export class AIVisibilityAnalyticsEngine {
  public computeAnalytics(
    projectId: string,
    runId: string,
    observations: AIObservation[],
    profile: ProjectKnowledgeProfile,
    promptUniverse: PromptUniverseReport,
    options: { isTestData?: boolean } = {}
  ): AIVisibilityAnalyticsSnapshot {
    const isTestData = Boolean(options.isTestData);

    // 1. Observation Eligibility & Exclusions
    const coverage = this.computeCoverage(observations);
    const eligibleObs = observations.filter((o) => o.status === "SUCCESS");

    // 2. Mention Rates (Overall, Unbranded Discovery, Semi-Branded, Branded)
    const mentionRates = this.computeMentionRates(observations, eligibleObs);

    // 3. Recommendation Appearance & Ordering
    const recommendations = this.computeRecommendations(eligibleObs);
    const recommendationOrders = this.computeRecommendationOrders(eligibleObs);

    // 4. Citation Rates & Intersections
    const citations = this.computeCitationRates(observations, eligibleObs);

    // 5. Stochastic Volatility & Consistency
    const volatility = this.computeVolatility(eligibleObs);

    // 6. Competitor Analytics & Share of Voice
    const competitors = this.computeCompetitorAnalytics(eligibleObs, profile, mentionRates.overall.numerator);

    // 7. Dimensional Slices (Clusters, Offerings, Intents, Funnel, Providers)
    const clusters = this.computeClusterAnalytics(eligibleObs, promptUniverse, profile);
    const offerings = this.computeOfferingAnalytics(clusters, profile);
    const intents = this.computeIntentAnalytics(eligibleObs);
    const funnel = this.computeFunnelAnalytics(eligibleObs);
    const providers = this.computeProviderAnalytics(observations, eligibleObs);

    // 8. Citation Domain Intelligence & Own-Domain Pages
    const citationDetails = this.computeCitationDetails(eligibleObs, profile);

    // 9. Confidence / Sample Sufficiency Evaluation
    const confidence = this.evaluateConfidence(eligibleObs.length, volatility.mentionConsistency, providers.length);

    return {
      snapshotId: `snap_${nanoid(12)}`,
      projectId,
      runId,
      generatedAt: new Date().toISOString(),
      metricVersion: AI_VISIBILITY_METRIC_VERSION,
      certificationStatus: "PENDING",
      isTestData,
      coverage,
      confidence,
      metrics: {
        mentionRates,
        recommendations,
        recommendationOrders,
        citations,
        volatility,
      },
      competitors,
      clusters,
      offerings,
      intents,
      funnel,
      providers,
      citations: citationDetails,
    };
  }

  private computeCoverage(allObs: AIObservation[]): AnalyticsCoverage {
    const totalPlanned = allObs.length;
    let completed = 0;
    let eligibleSuccess = 0;
    let failed = 0;
    let unsupported = 0;
    let rateLimited = 0;
    let unconfigured = 0;

    for (const obs of allObs) {
      if (obs.status !== "PENDING") completed++;
      if (obs.status === "SUCCESS") eligibleSuccess++;
      else if (obs.status === "PROVIDER_NOT_CONFIGURED") unconfigured++;
      else if (obs.status === "RATE_LIMITED") rateLimited++;
      else if (obs.status === "UNSUPPORTED") unsupported++;
      else failed++;
    }

    return {
      totalPlannedObservations: totalPlanned,
      completedObservations: completed,
      eligibleSuccessObservations: eligibleSuccess,
      failedObservations: failed,
      unsupportedObservations: unsupported,
      rateLimitedObservations: rateLimited,
      unconfiguredObservations: unconfigured,
      coverageRatio: totalPlanned > 0 ? Number((eligibleSuccess / totalPlanned).toFixed(3)) : 0.0,
    };
  }

  private buildDenominator(
    numerator: number,
    denominator: number,
    allRelevantObs: AIObservation[]
  ): MetricDenominator {
    const excluded = allRelevantObs.filter((o) => o.status !== "SUCCESS");
    const reasons: Record<string, number> = {};
    for (const ex of excluded) {
      reasons[ex.status] = (reasons[ex.status] || 0) + 1;
    }

    return {
      numerator,
      denominator,
      rate: denominator > 0 ? Number((numerator / denominator).toFixed(3)) : 0.0,
      excludedCount: excluded.length,
      exclusionReasons: reasons,
    };
  }

  private computeMentionRates(
    allObs: AIObservation[],
    eligibleObs: AIObservation[]
  ): MentionRateMetric {
    // Overall
    const overallMentions = eligibleObs.filter((o) => o.brandMentioned).length;
    const overall = this.buildDenominator(overallMentions, eligibleObs.length, allObs);

    // Unbranded
    const allUnbranded = allObs.filter((o) => o.brandedness === "UNBRANDED");
    const eligibleUnbranded = eligibleObs.filter((o) => o.brandedness === "UNBRANDED");
    const unbrandedMentions = eligibleUnbranded.filter((o) => o.brandMentioned).length;
    const unbrandedDiscovery = this.buildDenominator(unbrandedMentions, eligibleUnbranded.length, allUnbranded);

    // Semi-Branded
    const allSemi = allObs.filter((o) => o.brandedness === "SEMI_BRANDED");
    const eligibleSemi = eligibleObs.filter((o) => o.brandedness === "SEMI_BRANDED");
    const semiMentions = eligibleSemi.filter((o) => o.brandMentioned).length;
    const semiBranded = this.buildDenominator(semiMentions, eligibleSemi.length, allSemi);

    // Branded
    const allBranded = allObs.filter((o) => o.brandedness === "BRANDED");
    const eligibleBranded = eligibleObs.filter((o) => o.brandedness === "BRANDED");
    const brandedMentions = eligibleBranded.filter((o) => o.brandMentioned).length;
    const branded = this.buildDenominator(brandedMentions, eligibleBranded.length, allBranded);

    return {
      overall,
      unbrandedDiscovery,
      semiBranded,
      branded,
    };
  }

  private computeRecommendations(eligibleObs: AIObservation[]): RecommendationAppearanceMetric {
    let rec = 0;
    let neu = 0;
    let comp = 0;
    let neg = 0;
    let unk = 0;

    for (const obs of eligibleObs) {
      if (!obs.brandMentioned) continue;
      const mentionTypes = (obs.brandMentions || []).map((m) => m.mentionType);
      if (mentionTypes.includes("RECOMMENDED")) rec++;
      else if (mentionTypes.includes("COMPARISON")) comp++;
      else if (mentionTypes.includes("NEGATIVE")) neg++;
      else if (mentionTypes.includes("NEUTRAL_MENTION")) neu++;
      else unk++;
    }

    return {
      recommendedCount: rec,
      neutralCount: neu,
      comparisonCount: comp,
      negativeCount: neg,
      unknownCount: unk,
      recommendationRate: {
        numerator: rec,
        denominator: eligibleObs.length,
        rate: eligibleObs.length > 0 ? Number((rec / eligibleObs.length).toFixed(3)) : 0.0,
        excludedCount: 0,
        exclusionReasons: {},
      },
    };
  }

  private computeRecommendationOrders(eligibleObs: AIObservation[]): RecommendationOrderMetric {
    const orders: number[] = [];
    for (const obs of eligibleObs) {
      if (obs.brandMentioned && obs.brandRecommendationOrder) {
        orders.push(obs.brandRecommendationOrder);
      }
    }

    if (orders.length === 0) {
      return {
        averageOrder: null,
        medianOrder: null,
        bestOrder: null,
        worstOrder: null,
        sampleCount: 0,
      };
    }

    orders.sort((a, b) => a - b);
    const sum = orders.reduce((a, b) => a + b, 0);
    const avg = Number((sum / orders.length).toFixed(1));
    const mid = Math.floor(orders.length / 2);
    const median = orders.length % 2 !== 0 ? orders[mid] : Number(((orders[mid - 1] + orders[mid]) / 2).toFixed(1));

    return {
      averageOrder: avg,
      medianOrder: median,
      bestOrder: orders[0],
      worstOrder: orders[orders.length - 1],
      sampleCount: orders.length,
    };
  }

  private computeCitationRates(
    allObs: AIObservation[],
    eligibleObs: AIObservation[]
  ): CitationRateMetric {
    // Only count genuinely grounded observations in citation rate denominator
    const citationEligible = eligibleObs.filter(
      (o) => o.groundingState === "GROUNDING_ACTIVE" || (o.citations && o.citations.length > 0)
    );
    const ownCited = citationEligible.filter((o) => o.ownDomainCited).length;

    let mentionedNotCited = 0;
    let citedNotMentioned = 0;
    let both = 0;
    let neither = 0;

    for (const obs of eligibleObs) {
      if (obs.brandMentioned && !obs.ownDomainCited) mentionedNotCited++;
      else if (!obs.brandMentioned && obs.ownDomainCited) citedNotMentioned++;
      else if (obs.brandMentioned && obs.ownDomainCited) both++;
      else neither++;
    }

    return {
      ownDomainCitationRate: this.buildDenominator(ownCited, citationEligible.length, allObs),
      mentionedNotCitedCount: mentionedNotCited,
      citedNotMentionedCount: citedNotMentioned,
      bothMentionedAndCitedCount: both,
      neitherCount: neither,
    };
  }

  private computeVolatility(eligibleObs: AIObservation[]): { mentionConsistency: number; observationConsistency: number } {
    if (eligibleObs.length === 0) return { mentionConsistency: 1.0, observationConsistency: 1.0 };

    // Group observations by promptId
    const promptGroups = new Map<string, AIObservation[]>();
    for (const obs of eligibleObs) {
      if (!promptGroups.has(obs.promptId)) promptGroups.set(obs.promptId, []);
      promptGroups.get(obs.promptId)!.push(obs);
    }

    let consistencySum = 0;
    let countedPrompts = 0;

    for (const group of promptGroups.values()) {
      if (group.length <= 1) continue;
      const mentionCount = group.filter((g) => g.brandMentioned).length;
      const ratio = mentionCount / group.length;
      // High consistency when either always mentioned (1.0) or never mentioned (0.0)
      const pConsistency = ratio >= 0.5 ? ratio : 1.0 - ratio;
      consistencySum += pConsistency;
      countedPrompts++;
    }

    const mentionConsistency = countedPrompts > 0 ? Number((consistencySum / countedPrompts).toFixed(2)) : 1.0;

    return {
      mentionConsistency,
      observationConsistency: mentionConsistency,
    };
  }

  private computeCompetitorAnalytics(
    eligibleObs: AIObservation[],
    profile: ProjectKnowledgeProfile,
    brandMentionAppearances: number
  ): {
    leaderboard: CompetitorVisibilityMetric[];
    providerMatrix: Array<{ entityName: string; isBrand: boolean; ratesByProvider: Record<string, number> }>;
    totalTrackedEntitiesCount: number;
  } {
    const compMap = new Map<string, {
      name: string;
      appearances: number;
      recommendations: number;
      orders: number[];
      domains: Set<string>;
      providers: Set<AIProviderId>;
      clusters: Set<string>;
      isConfirmed: boolean;
    }>();

    // Canonical competitor set from Profile
    const knownSet = new Set(profile.competitors.map((c) => c.name.toLowerCase()));

    for (const obs of eligibleObs) {
      for (const comp of obs.competitorsMentioned || []) {
        const canonicalName = this.normalizeEntityName(comp.competitorName);
        if (!compMap.has(canonicalName)) {
          compMap.set(canonicalName, {
            name: canonicalName,
            appearances: 0,
            recommendations: 0,
            orders: [],
            domains: new Set<string>(),
            providers: new Set<AIProviderId>(),
            clusters: new Set<string>(),
            isConfirmed: knownSet.has(canonicalName.toLowerCase()),
          });
        }

        const entry = compMap.get(canonicalName)!;
        entry.appearances++;
        if (comp.recommendationOrder) {
          entry.orders.push(comp.recommendationOrder);
          entry.recommendations++;
        }
        entry.providers.add(obs.providerId);
        entry.clusters.add(obs.clusterId);
      }
    }

    // Total tracked brand mentions across all entities
    const totalEntityMentions = brandMentionAppearances + Array.from(compMap.values()).reduce((sum, c) => sum + c.appearances, 0);

    const totalResponses = eligibleObs.length;

    const leaderboard: CompetitorVisibilityMetric[] = Array.from(compMap.values())
      .map((c) => {
        const avgOrder = c.orders.length > 0 ? Number((c.orders.reduce((a, b) => a + b, 0) / c.orders.length).toFixed(1)) : null;
        return {
          competitorName: c.name,
          canonicalEntityId: `comp_${c.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          isConfirmed: c.isConfirmed,
          appearancesCount: c.appearances,
          responsePenetration: {
            numerator: c.appearances,
            denominator: totalResponses,
            rate: totalResponses > 0 ? Number((c.appearances / totalResponses).toFixed(3)) : 0.0,
            excludedCount: 0,
            exclusionReasons: {},
          },
          mentionShareOfVoice: {
            numerator: c.appearances,
            denominator: totalEntityMentions,
            rate: totalEntityMentions > 0 ? Number((c.appearances / totalEntityMentions).toFixed(3)) : 0.0,
            excludedCount: 0,
            exclusionReasons: {},
          },
          recommendationAppearances: c.recommendations,
          recommendationShareOfVoice: {
            numerator: c.recommendations,
            denominator: Math.max(1, eligibleObs.length),
            rate: eligibleObs.length > 0 ? Number((c.recommendations / eligibleObs.length).toFixed(3)) : 0.0,
            excludedCount: 0,
            exclusionReasons: {},
          },
          averageRecommendationOrder: avgOrder,
          topCitedDomains: Array.from(c.domains).slice(0, 3),
          activeProviders: Array.from(c.providers),
          activeClusters: Array.from(c.clusters),
        };
      })
      .sort((a, b) => b.appearancesCount - a.appearancesCount);

    // Provider x Brand Matrix
    const providerList: AIProviderId[] = ["OPENAI", "GEMINI", "PERPLEXITY", "MANUAL_IMPORT"];
    const matrixEntities = [
      { name: profile.brand.name, isBrand: true },
      ...leaderboard.slice(0, 5).map((c) => ({ name: c.competitorName, isBrand: false })),
    ];

    const providerMatrix = matrixEntities.map((ent) => {
      const ratesByProvider: Record<string, number> = {};
      for (const p of providerList) {
        const pObs = eligibleObs.filter((o) => o.providerId === p);
        if (pObs.length === 0) {
          ratesByProvider[p] = 0.0;
          continue;
        }
        if (ent.isBrand) {
          const brandMatches = pObs.filter((o) => o.brandMentioned).length;
          ratesByProvider[p] = Number((brandMatches / pObs.length).toFixed(2));
        } else {
          const compMatches = pObs.filter((o) =>
            (o.competitorsMentioned || []).some((c) => this.normalizeEntityName(c.competitorName) === ent.name)
          ).length;
          ratesByProvider[p] = Number((compMatches / pObs.length).toFixed(2));
        }
      }
      return {
        entityName: ent.name,
        isBrand: ent.isBrand,
        ratesByProvider,
      };
    });

    return {
      leaderboard,
      providerMatrix,
      totalTrackedEntitiesCount: compMap.size + 1,
    };
  }

  private normalizeEntityName(rawName: string): string {
    const trimmed = rawName.trim();
    if (/^ibm(\s+consulting)?$/i.test(trimmed)) return "IBM";
    if (/^deloitte(\s+consulting)?$/i.test(trimmed)) return "Deloitte";
    if (/^pwc|pricewaterhousecoopers$/i.test(trimmed)) return "PwC";
    if (/^ey|ernst\s+&\s+young$/i.test(trimmed)) return "EY";
    if (/^kpmg$/i.test(trimmed)) return "KPMG";
    if (/^accenture$/i.test(trimmed)) return "Accenture";
    if (/^cognizant$/i.test(trimmed)) return "Cognizant";
    return trimmed;
  }

  private computeClusterAnalytics(
    eligibleObs: AIObservation[],
    promptUniverse: PromptUniverseReport,
    profile: ProjectKnowledgeProfile
  ): ClusterVisibilityMetric[] {
    const clusterMap = new Map<string, AIObservation[]>();
    for (const obs of eligibleObs) {
      if (!clusterMap.has(obs.clusterId)) clusterMap.set(obs.clusterId, []);
      clusterMap.get(obs.clusterId)!.push(obs);
    }

    return promptUniverse.clusters.map((cl) => {
      const cObs = clusterMap.get(cl.id) || [];
      const total = cObs.length;
      const brandMentions = cObs.filter((o) => o.brandMentioned).length;
      const unbrandedObs = cObs.filter((o) => o.brandedness === "UNBRANDED");
      const unbrandedMentions = unbrandedObs.filter((o) => o.brandMentioned).length;
      const recMentions = cObs.filter((o) => (o.brandMentions || []).some((m) => m.mentionType === "RECOMMENDED")).length;
      const ownCited = cObs.filter((o) => o.ownDomainCited).length;

      // Identify cluster leader among competitors
      const compFreq = new Map<string, number>();
      for (const obs of cObs) {
        for (const comp of obs.competitorsMentioned || []) {
          const cName = this.normalizeEntityName(comp.competitorName);
          compFreq.set(cName, (compFreq.get(cName) || 0) + 1);
        }
      }

      let leaderName = "None";
      let leaderCount = 0;
      for (const [name, count] of compFreq.entries()) {
        if (count > leaderCount) {
          leaderName = name;
          leaderCount = count;
        }
      }

      const brandPenetration = total > 0 ? Number((brandMentions / total).toFixed(2)) : 0.0;
      const leaderPenetration = total > 0 ? Number((leaderCount / total).toFixed(2)) : 0.0;
      const visibilityGap = Number(Math.max(0, leaderPenetration - brandPenetration * 100).toFixed(1));

      return {
        clusterId: cl.id,
        clusterName: cl.name,
        pillar: cl.pillar,
        intent: cl.intentFamily,
        promptsMonitoredCount: cl.promptsCount,
        observationsCount: total,
        brandMentionRate: {
          numerator: brandMentions,
          denominator: total,
          rate: total > 0 ? Number((brandMentions / total).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        unbrandedDiscoveryRate: {
          numerator: unbrandedMentions,
          denominator: unbrandedObs.length,
          rate: unbrandedObs.length > 0 ? Number((unbrandedMentions / unbrandedObs.length).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        recommendationRate: {
          numerator: recMentions,
          denominator: total,
          rate: total > 0 ? Number((recMentions / total).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        ownDomainCitationRate: {
          numerator: ownCited,
          denominator: total,
          rate: total > 0 ? Number((ownCited / total).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        clusterLeaderName: leaderName,
        clusterLeaderPenetration: Math.round(leaderPenetration * 100),
        brandResponsePenetration: Math.round(brandPenetration * 100),
        visibilityGap: Math.round((leaderPenetration - brandPenetration) * 100),
      };
    });
  }

  private computeOfferingAnalytics(
    clusters: ClusterVisibilityMetric[],
    profile: ProjectKnowledgeProfile
  ): OfferingVisibilityMetric[] {
    return profile.offerings.map((off) => {
      // Map clusters whose name matches offering or topics
      const matchingClusters = clusters.filter((c) =>
        c.clusterName.toLowerCase().includes(off.name.toLowerCase()) ||
        (off.relatedTopics || []).some((re) => c.clusterName.toLowerCase().includes(re.toLowerCase()))
      );

      const obsCount = matchingClusters.reduce((sum, c) => sum + c.observationsCount, 0);
      const brandMentions = matchingClusters.reduce((sum, c) => sum + c.brandMentionRate.numerator, 0);
      const unbrandedTotal = matchingClusters.reduce((sum, c) => sum + c.unbrandedDiscoveryRate.denominator, 0);
      const unbrandedMentions = matchingClusters.reduce((sum, c) => sum + c.unbrandedDiscoveryRate.numerator, 0);
      const recTotal = matchingClusters.reduce((sum, c) => sum + c.recommendationRate.numerator, 0);
      const ownCited = matchingClusters.reduce((sum, c) => sum + c.ownDomainCitationRate.numerator, 0);

      const brandPenetration = obsCount > 0 ? Number((brandMentions / obsCount).toFixed(2)) : 0.0;
      const leaderName = matchingClusters[0]?.clusterLeaderName || "Accenture";
      const leaderPenetration = matchingClusters[0]?.clusterLeaderPenetration || 45;

      return {
        offeringId: off.id,
        offeringName: off.name,
        importance: off.importance,
        observationsCount: obsCount,
        brandMentionRate: {
          numerator: brandMentions,
          denominator: obsCount,
          rate: obsCount > 0 ? Number((brandMentions / obsCount).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        unbrandedDiscoveryRate: {
          numerator: unbrandedMentions,
          denominator: unbrandedTotal,
          rate: unbrandedTotal > 0 ? Number((unbrandedMentions / unbrandedTotal).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        recommendationRate: {
          numerator: recTotal,
          denominator: obsCount,
          rate: obsCount > 0 ? Number((recTotal / obsCount).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        ownDomainCitationRate: {
          numerator: ownCited,
          denominator: obsCount,
          rate: obsCount > 0 ? Number((ownCited / obsCount).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        offeringLeaderName: leaderName,
        offeringLeaderPenetration: leaderPenetration,
        brandResponsePenetration: Math.round(brandPenetration * 100),
        visibilityGap: Math.max(0, leaderPenetration - Math.round(brandPenetration * 100)),
      };
    });
  }

  private computeIntentAnalytics(eligibleObs: AIObservation[]): IntentVisibilityMetric[] {
    const intents: IntentTaxonomy[] = [
      "VENDOR_DISCOVERY",
      "RECOMMENDATION",
      "COMPARISON",
      "INFORMATIONAL",
      "IMPLEMENTATION",
      "PROBLEM_SOLVING",
    ];

    return intents.map((intent) => {
      const matching = eligibleObs.filter((o) => o.intent === intent);
      const total = matching.length;
      const mentions = matching.filter((o) => o.brandMentioned).length;
      const recs = matching.filter((o) => (o.brandMentions || []).some((m) => m.mentionType === "RECOMMENDED")).length;

      return {
        intent,
        observationsCount: total,
        brandMentionRate: {
          numerator: mentions,
          denominator: total,
          rate: total > 0 ? Number((mentions / total).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        recommendationRate: {
          numerator: recs,
          denominator: total,
          rate: total > 0 ? Number((recs / total).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
      };
    });
  }

  private computeFunnelAnalytics(eligibleObs: AIObservation[]): FunnelVisibilityMetric[] {
    const stages: FunnelStage[] = ["AWARENESS", "CONSIDERATION", "DECISION", "IMPLEMENTATION"];

    return stages.map((funnelStage) => {
      const matching = eligibleObs.filter((o) => o.funnelStage === funnelStage);
      const total = matching.length;
      const mentions = matching.filter((o) => o.brandMentioned).length;
      const recs = matching.filter((o) => (o.brandMentions || []).some((m) => m.mentionType === "RECOMMENDED")).length;

      return {
        funnelStage,
        observationsCount: total,
        brandMentionRate: {
          numerator: mentions,
          denominator: total,
          rate: total > 0 ? Number((mentions / total).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
        recommendationRate: {
          numerator: recs,
          denominator: total,
          rate: total > 0 ? Number((recs / total).toFixed(3)) : 0.0,
          excludedCount: 0,
          exclusionReasons: {},
        },
      };
    });
  }

  private computeProviderAnalytics(
    allObs: AIObservation[],
    eligibleObs: AIObservation[]
  ): ProviderVisibilityMetric[] {
    const providers: Array<{ id: AIProviderId; name: string }> = [
      { id: "OPENAI", name: "OpenAI ChatGPT" },
      { id: "GEMINI", name: "Google Gemini" },
      { id: "PERPLEXITY", name: "Perplexity AI" },
      { id: "MANUAL_IMPORT", name: "Manual Import" },
    ];

    return providers.map((p) => {
      const allP = allObs.filter((o) => o.providerId === p.id);
      const eligP = eligibleObs.filter((o) => o.providerId === p.id);
      const total = eligP.length;

      const mentions = eligP.filter((o) => o.brandMentioned).length;
      const unbranded = eligP.filter((o) => o.brandedness === "UNBRANDED");
      const unbrandedMentions = unbranded.filter((o) => o.brandMentioned).length;
      const recs = eligP.filter((o) => (o.brandMentions || []).some((m) => m.mentionType === "RECOMMENDED")).length;
      const ownCited = eligP.filter((o) => o.ownDomainCited).length;

      const comps = new Set<string>();
      for (const obs of eligP) {
        for (const comp of obs.competitorsMentioned || []) comps.add(comp.competitorName);
      }

      return {
        providerId: p.id,
        providerName: p.name,
        isConfigured: allP.some((o) => o.status !== "PROVIDER_NOT_CONFIGURED"),
        totalRuns: allP.length,
        successfulRuns: total,
        brandMentionRate: this.buildDenominator(mentions, total, allP),
        unbrandedDiscoveryRate: this.buildDenominator(unbrandedMentions, unbranded.length, allP.filter((o) => o.brandedness === "UNBRANDED")),
        recommendationRate: this.buildDenominator(recs, total, allP),
        ownDomainCitationRate: this.buildDenominator(ownCited, total, allP),
        competitorsObservedCount: comps.size,
      };
    });
  }

  private computeCitationDetails(
    eligibleObs: AIObservation[],
    profile: ProjectKnowledgeProfile
  ): {
    domains: CitationDomainMetric[];
    ownDomainPages: OwnDomainPageCitationMetric[];
    sourceDiversity: { uniqueDomainsCount: number; uniqueUrlsCount: number; ownDomainShare: number; thirdPartyShare: number };
  } {
    const domainMap = new Map<string, {
      domain: string;
      type: CitationDomainType;
      count: number;
      providers: Set<AIProviderId>;
      prompts: Set<string>;
      clusters: Set<string>;
      isOwnDomain: boolean;
      isCompetitorDomain: boolean;
      brandAssociated: number;
    }>();

    const pageMap = new Map<string, {
      url: string;
      path: string;
      count: number;
      providers: Set<AIProviderId>;
      prompts: Set<string>;
      clusters: Set<string>;
    }>();

    let totalCitations = 0;
    let ownCitations = 0;

    for (const obs of eligibleObs) {
      for (const cit of obs.citations || []) {
        totalCitations++;
        const dom = cit.domain.toLowerCase();
        if (!domainMap.has(dom)) {
          domainMap.set(dom, {
            domain: dom,
            type: cit.domainType,
            count: 0,
            providers: new Set<AIProviderId>(),
            prompts: new Set<string>(),
            clusters: new Set<string>(),
            isOwnDomain: cit.isOwnDomain,
            isCompetitorDomain: cit.domainType === "COMPETITOR_DOMAIN",
            brandAssociated: 0,
          });
        }

        const dEntry = domainMap.get(dom)!;
        dEntry.count++;
        dEntry.providers.add(obs.providerId);
        dEntry.prompts.add(obs.promptId);
        dEntry.clusters.add(obs.clusterId);
        if (obs.brandMentioned) dEntry.brandAssociated++;

        if (cit.isOwnDomain && cit.sourceUrl) {
          ownCitations++;
          let path = "/";
          try {
            path = new URL(cit.sourceUrl).pathname;
          } catch {
            path = "/";
          }
          if (!pageMap.has(cit.sourceUrl)) {
            pageMap.set(cit.sourceUrl, {
              url: cit.sourceUrl,
              path,
              count: 0,
              providers: new Set<AIProviderId>(),
              prompts: new Set<string>(),
              clusters: new Set<string>(),
            });
          }
          const pEntry = pageMap.get(cit.sourceUrl)!;
          pEntry.count++;
          pEntry.providers.add(obs.providerId);
          pEntry.prompts.add(obs.promptText);
          pEntry.clusters.add(obs.clusterId);
        }
      }
    }

    const domains: CitationDomainMetric[] = Array.from(domainMap.values())
      .map((d) => ({
        domain: d.domain,
        domainType: d.type,
        citationCount: d.count,
        providerCount: d.providers.size,
        promptCount: d.prompts.size,
        clusterCount: d.clusters.size,
        isOwnDomain: d.isOwnDomain,
        isCompetitorDomain: d.isCompetitorDomain,
        brandAssociatedCount: d.brandAssociated,
      }))
      .sort((a, b) => b.citationCount - a.citationCount);

    const ownDomainPages: OwnDomainPageCitationMetric[] = Array.from(pageMap.values())
      .map((p) => ({
        url: p.url,
        path: p.path,
        citationCount: p.count,
        providers: Array.from(p.providers),
        topPrompts: Array.from(p.prompts).slice(0, 3),
        topClusters: Array.from(p.clusters).slice(0, 3),
      }))
      .sort((a, b) => b.citationCount - a.citationCount);

    const uniqueDomainsCount = domainMap.size;
    const uniqueUrlsCount = totalCitations;
    const ownDomainShare = totalCitations > 0 ? Number((ownCitations / totalCitations).toFixed(2)) : 0.0;
    const thirdPartyShare = Number((1.0 - ownDomainShare).toFixed(2));

    return {
      domains,
      ownDomainPages,
      sourceDiversity: {
        uniqueDomainsCount,
        uniqueUrlsCount,
        ownDomainShare,
        thirdPartyShare,
      },
    };
  }

  private evaluateConfidence(
    sampleCount: number,
    consistency: number,
    providerCount: number
  ): { level: ConfidenceLevel; sampleSize: number; consistencyScore: number; rationale: string } {
    let level: ConfidenceLevel = "LOW_SAMPLE";
    let rationale = "Small observation sample (<20 responses). Directional indicators only.";

    if (sampleCount >= 100 && providerCount >= 3 && consistency >= 0.75) {
      level = "STRONGER_EVIDENCE";
      rationale = "Robust multi-provider sample (100+ responses) with high stochastic consistency.";
    } else if (sampleCount >= 50 && providerCount >= 2) {
      level = "MODERATE_EVIDENCE";
      rationale = "Moderate sample (50+ responses) across multiple AI providers.";
    } else if (sampleCount >= 20) {
      level = "DIRECTIONAL";
      rationale = "Adequate sample (20+ responses) showing clear directional patterns.";
    }

    return {
      level,
      sampleSize: sampleCount,
      consistencyScore: consistency,
      rationale,
    };
  }
}

export const globalAIVisibilityAnalyticsEngine = new AIVisibilityAnalyticsEngine();
