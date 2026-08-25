/**
 * Hardened Topic Coverage & Differentiation Comparison Engine.
 * Enforces rigorous sample-size safeguards (1/1 != COMMONLY_OBSERVED_TOPIC)
 * and preserves exact provenance for all observed topic opportunities.
 */

import { TopicComparisonItem, TopicObservationState, CompetitorPageObservation } from "./types";
import { SerpIntelligenceConfig, DEFAULT_SERP_CONFIG } from "./config";

export interface TopicComparisonParams {
  clusterId: string;
  snapshotId: string;
  ownPageTopics: string[];
  competitorObservations: CompetitorPageObservation[];
  config?: SerpIntelligenceConfig;
}

export interface TopicComparisonResult {
  topics: TopicComparisonItem[];
  ownDifferentiationSignals: string[];
  serpCoverageGaps: string[];
}

export function compareSerpTopics(params: TopicComparisonParams): TopicComparisonResult {
  const { clusterId, snapshotId, ownPageTopics, competitorObservations } = params;
  const config = params.config || DEFAULT_SERP_CONFIG;

  const validCompetitors = competitorObservations.filter((c) => c.fetchStatus === "SUCCESS");
  const totalCompetitors = validCompetitors.length;

  const ownTopicsSet = new Set(ownPageTopics.map((t) => t.toLowerCase()));

  if (totalCompetitors === 0) {
    const fallbackTopics: TopicComparisonItem[] = Array.from(ownTopicsSet).map((topic) => ({
      topic,
      observationState: "OWN_SITE_ONLY_TOPIC",
      analyzedCompetitorCount: 0,
      occurrenceCount: 0,
      competitorPrevalenceRatio: 0,
      competitorPrevalenceFraction: "0 of 0",
      observedOnOwnPage: true,
      provenance: {
        sourceSerpSnapshotIds: [snapshotId],
        competitorUrls: [],
        phase12ClusterId: clusterId,
      },
      interpretation: "Covered on own site. No competitor pages were successfully fetchable for comparison.",
    }));

    return {
      topics: fallbackTopics,
      ownDifferentiationSignals: Array.from(ownTopicsSet),
      serpCoverageGaps: [],
    };
  }

  // Count competitor occurrences per topic
  const topicCompetitorMap = new Map<string, string[]>(); // topic -> competitor URLs

  for (const comp of validCompetitors) {
    for (const topic of comp.observedEntitiesAndTopics) {
      const norm = topic.toLowerCase();
      const urls = topicCompetitorMap.get(norm) || [];
      if (!urls.includes(comp.url)) {
        urls.push(comp.url);
      }
      topicCompetitorMap.set(norm, urls);
    }
  }

  const allEncounteredTopics = new Set([...Array.from(topicCompetitorMap.keys()), ...Array.from(ownTopicsSet)]);

  const items: TopicComparisonItem[] = [];
  const ownDifferentiationSignals: string[] = [];
  const serpCoverageGaps: string[] = [];

  for (const topic of allEncounteredTopics) {
    const matchingUrls = topicCompetitorMap.get(topic) || [];
    const count = matchingUrls.length;
    const ratio = Math.round((count / totalCompetitors) * 100) / 100;
    const observedOnOwn = ownTopicsSet.has(topic);

    let state: TopicObservationState;
    let interpretation = "";

    if (observedOnOwn && count === 0) {
      state = "OWN_SITE_ONLY_TOPIC";
      interpretation = `Unique proprietary topic covered by own site; not observed on any of the ${totalCompetitors} analyzed competitor pages.`;
      ownDifferentiationSignals.push(topic);
    } else if (!observedOnOwn) {
      // Competitor-only observed topics
      if (totalCompetitors === 1) {
        state = "OBSERVED_SINGLE_SOURCE";
        interpretation = `Observed on a single competitor page (1 of 1). Requires broader competitor sampling to confirm industry consensus.`;
      } else if (totalCompetitors === 2 && ratio >= config.topicCommonPrevalenceThreshold) {
        state = "OBSERVED_LIMITED_SAMPLE";
        interpretation = `Observed on ${count} of 2 analyzed competitor pages. Promising candidate under limited sample size.`;
        serpCoverageGaps.push(topic);
      } else if (totalCompetitors >= config.minCompetitorSourcesForCommonTopic && ratio >= config.topicCommonPrevalenceThreshold) {
        state = "COMMONLY_OBSERVED_TOPIC";
        interpretation = `Commonly observed among ${count} of ${totalCompetitors} ranking competitor pages in the evaluated SERP sample.`;
        serpCoverageGaps.push(topic);
      } else if (ratio >= config.topicSometimesPrevalenceThreshold) {
        state = "SOMETIMES_OBSERVED_TOPIC";
        interpretation = `Observed on ${count} of ${totalCompetitors} ranking competitor pages.`;
      } else {
        state = "COMPETITOR_ONLY_OBSERVED_TOPIC";
        interpretation = `Observed on ${count} of ${totalCompetitors} ranking competitor pages.`;
      }
    } else {
      // Topic covered on own page AND competitors
      if (totalCompetitors >= config.minCompetitorSourcesForCommonTopic && ratio >= config.topicCommonPrevalenceThreshold) {
        state = "COMMONLY_OBSERVED_TOPIC";
        interpretation = `Strongly covered on own page and commonly observed on ${count} of ${totalCompetitors} competitor pages.`;
      } else if (totalCompetitors < 3 && ratio >= config.topicCommonPrevalenceThreshold) {
        state = "OBSERVED_LIMITED_SAMPLE";
        interpretation = `Covered on own page and on ${count} of ${totalCompetitors} analyzed competitor pages.`;
      } else {
        state = "SOMETIMES_OBSERVED_TOPIC";
        interpretation = `Covered on own page and on ${count} of ${totalCompetitors} competitor pages.`;
      }
    }

    items.push({
      topic,
      observationState: state,
      analyzedCompetitorCount: totalCompetitors,
      occurrenceCount: count,
      competitorPrevalenceRatio: ratio,
      competitorPrevalenceFraction: `${count} of ${totalCompetitors}`,
      observedOnOwnPage: observedOnOwn,
      provenance: {
        sourceSerpSnapshotIds: [snapshotId],
        competitorUrls: matchingUrls,
        phase12ClusterId: clusterId,
      },
      interpretation,
    });
  }

  // Sort: highest occurrence ratio first
  items.sort((a, b) => b.competitorPrevalenceRatio - a.competitorPrevalenceRatio || b.occurrenceCount - a.occurrenceCount);

  return {
    topics: items,
    ownDifferentiationSignals,
    serpCoverageGaps,
  };
}
