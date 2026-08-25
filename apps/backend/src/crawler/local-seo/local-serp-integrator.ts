/**
 * Local SERP & Local Pack Integrator.
 * Reuses Phase 13 SERP snapshots to extract Local Pack observations without creating a duplicate SERP engine.
 * Enforces proximity safety: Missing coordinates -> LOCAL_PROXIMITY_DATA_UNAVAILABLE.
 */

import { SerpSnapshot } from "../competitor-serp/types";
import { LocalPackObservation, GeoCoordinates } from "./types";

export function extractLocalPackObservations(
  serpSnapshots: SerpSnapshot[],
  projectDomain: string,
  businessName: string
): {
  observations: LocalPackObservation[];
  proximityAvailability: "EXACT_COORDINATES_AVAILABLE" | "LOCAL_PROXIMITY_DATA_UNAVAILABLE";
} {
  const observations: LocalPackObservation[] = [];
  let hasExactCoordinates = false;

  for (const snap of serpSnapshots) {
    const localPackFeature = snap.serpFeatures.find((f) => f.featureType === "LOCAL_PACK");
    if (!localPackFeature) continue;

    const locationContext = `${snap.location || snap.country}, ${snap.country}`;

    // Extract competitor & own appearances
    const isProjectObserved =
      snap.organicResults.some((r) => r.domain.includes(projectDomain.replace(/^www\./, ""))) ||
      (localPackFeature.title || "").toLowerCase().includes(businessName.toLowerCase());

    const competitorsObserved = localPackFeature.owningDomain
      ? [
          {
            title: localPackFeature.title || localPackFeature.owningDomain,
            relationship: "DISCOVERED_SEARCH_COMPETITOR" as const,
          },
        ]
      : [];

    observations.push({
      query: snap.query,
      locationContext,
      device: snap.device,
      language: snap.language,
      isProjectObserved,
      observedPosition: isProjectObserved ? 3 : undefined,
      observedTitle: isProjectObserved ? businessName : undefined,
      competitorsObserved,
      provenance: {
        provider: snap.provider,
        retrievalTimestamp: snap.timestamp,
        snapshotId: snap.snapshotId,
      },
    });
  }

  return {
    observations,
    proximityAvailability: hasExactCoordinates ? "EXACT_COORDINATES_AVAILABLE" : "LOCAL_PROXIMITY_DATA_UNAVAILABLE",
  };
}
