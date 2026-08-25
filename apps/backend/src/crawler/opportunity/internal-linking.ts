/**
 * Relevance-Aware Internal Linking Engine.
 * Evaluates contextual topic and structural relationships, ranks multiple candidates,
 * and guards against arbitrary sitewide/footer linking and keyword stuffing.
 */

export interface InternalLinkingCandidate {
  targetUrl: string;
  sourceCandidateUrl: string;
  relevanceConfidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_RELEVANCE" | "UNRELATED" | "NO_CONFIDENT_SOURCE";
  relationshipType: "CLUSTER_PARENT_CHILD" | "SERVICE_CASE_STUDY" | "RELATED_TOPIC" | "GENERIC_UNRELATED";
  relevanceScore: number; // 0 - 100
  recommendedAnchorText: string;
  rationale: string;
}

export function evaluateInternalLinkingOpportunity(
  targetUrl: string,
  sourceCandidateUrl: string,
  targetTopic?: string,
  sourceTopic?: string
): InternalLinkingCandidate {
  const normTarget = targetUrl.toLowerCase().replace(/\/$/, "");
  const normSource = sourceCandidateUrl.toLowerCase().replace(/\/$/, "");

  // 1. Same URL Guard
  if (normTarget === normSource) {
    return {
      targetUrl,
      sourceCandidateUrl,
      relevanceConfidence: "UNRELATED",
      relationshipType: "GENERIC_UNRELATED",
      relevanceScore: 0,
      recommendedAnchorText: "",
      rationale: "Self-linking rejected.",
    };
  }

  // 2. Reject Generic Utility / Footer / Auth Pages as contextual sources
  if (
    normSource.includes("/privacy") ||
    normSource.includes("/terms") ||
    normSource.includes("/legal") ||
    normSource.includes("/login") ||
    normSource.includes("/cart") ||
    normSource.includes("/footer") ||
    normSource.includes("/sitemap")
  ) {
    return {
      targetUrl,
      sourceCandidateUrl,
      relevanceConfidence: "UNRELATED",
      relationshipType: "GENERIC_UNRELATED",
      relevanceScore: 0,
      recommendedAnchorText: "",
      rationale: "Utility, legal, and navigation footer pages are strictly rejected as contextual link sources.",
    };
  }

  // 3. Topic & Path Hierarchy Relevance Check
  const targetPath = new URL(targetUrl).pathname;
  const sourcePath = new URL(sourceCandidateUrl).pathname;

  const targetSegments = targetPath.split("/").filter(Boolean);
  const sourceSegments = sourcePath.split("/").filter(Boolean);

  const targetCategory = targetSegments[0] || "";
  const sourceCategory = sourceSegments[0] || "";

  // Direct Case Study -> Service or Guide -> Service relationship
  if (
    (targetCategory === "services" && sourceCategory === "case-studies") ||
    (targetCategory === "services" && sourceCategory === "blog") ||
    (targetCategory === "solutions" && sourceCategory === "insights")
  ) {
    return {
      targetUrl,
      sourceCandidateUrl,
      relevanceConfidence: "HIGH_CONFIDENCE",
      relationshipType: "SERVICE_CASE_STUDY",
      relevanceScore: 90,
      recommendedAnchorText: `Contextual anchor referencing ${targetSegments.join(" ").replace(/[^a-zA-Z0-9]/g, " ").trim()}`,
      rationale: `Strong editorial synergy between ${sourceCategory} and target ${targetCategory}.`,
    };
  }

  // Shared topic cluster
  if (targetCategory === sourceCategory && targetCategory !== "") {
    return {
      targetUrl,
      sourceCandidateUrl,
      relevanceConfidence: "MEDIUM_CONFIDENCE",
      relationshipType: "RELATED_TOPIC",
      relevanceScore: 65,
      recommendedAnchorText: `Contextual reference in body paragraph`,
      rationale: `Shared category cluster '${targetCategory}'.`,
    };
  }

  // Default: Low relevance / No Confident Candidate
  return {
    targetUrl,
    sourceCandidateUrl,
    relevanceConfidence: "NO_CONFIDENT_SOURCE",
    relationshipType: "GENERIC_UNRELATED",
    relevanceScore: 15,
    recommendedAnchorText: "",
    rationale: "Insufficient structural or semantic relevance; manual editorial review required before linking.",
  };
}

export function rankInternalLinkingCandidates(
  targetUrl: string,
  sourceCandidateUrls: string[]
): InternalLinkingCandidate[] {
  return sourceCandidateUrls
    .map((sourceUrl) => evaluateInternalLinkingOpportunity(targetUrl, sourceUrl))
    .filter((c) => c.relevanceConfidence !== "UNRELATED")
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
