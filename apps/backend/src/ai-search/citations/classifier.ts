/**
 * Phase 28F: Evidence-Based Source Ownership and Page-Type Classifier.
 */

import { SourceOwnershipType, SourcePageType } from "./types";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";

export function classifySourceOwnership(
  domain: string,
  profile: ProjectKnowledgeProfile
): { ownershipType: SourceOwnershipType; associatedEntityName: string | null } {
  const normDomain = (domain || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
  const projectDomain = (profile.domain || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();

  // 1. Own Domain Detection
  if (normDomain && (normDomain === projectDomain || normDomain.endsWith(`.${projectDomain}`))) {
    return { ownershipType: "OWN_DOMAIN", associatedEntityName: profile.brand.name };
  }

  // 2. Confirmed Competitor Domain Detection
  for (const comp of profile.competitors || []) {
    const compDomain = (comp.domain || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
    if (compDomain && (normDomain === compDomain || normDomain.endsWith(`.${compDomain}`))) {
      return { ownershipType: "CONFIRMED_COMPETITOR", associatedEntityName: comp.name };
    }
  }

  // 3. Observed Competitor Candidates
  const knownCandidateDomains: Record<string, string> = {
    "accenture.com": "Accenture",
    "deloitte.com": "Deloitte",
    "pwc.com": "PwC",
    "kpmg.com": "KPMG",
    "ey.com": "EY",
    "cognizant.com": "Cognizant",
    "infosys.com": "Infosys",
    "wipro.com": "Wipro",
    "slalom.com": "Slalom",
    "thirdera.com": "Thirdera",
    "glidefast.com": "GlideFast",
    "acorio.com": "Acorio",
  };
  if (knownCandidateDomains[normDomain]) {
    return { ownershipType: "OBSERVED_COMPETITOR_CANDIDATE", associatedEntityName: knownCandidateDomains[normDomain] };
  }

  // 4. Directory Sites
  if (
    normDomain.includes("g2.com") ||
    normDomain.includes("clutch.co") ||
    normDomain.includes("trustradius.com") ||
    normDomain.includes("capterra.com") ||
    normDomain.includes("gartner.com") ||
    normDomain.includes("forrester.com")
  ) {
    return { ownershipType: "DIRECTORY", associatedEntityName: null };
  }

  // 5. News & Editorial
  if (
    normDomain.includes("forbes.com") ||
    normDomain.includes("bloomberg.com") ||
    normDomain.includes("reuters.com") ||
    normDomain.includes("techcrunch.com") ||
    normDomain.includes("wsj.com") ||
    normDomain.includes("businessinsider.com")
  ) {
    return { ownershipType: "NEWS", associatedEntityName: null };
  }

  // 6. Documentation Sites
  if (
    normDomain.startsWith("docs.") ||
    normDomain.includes("developer.") ||
    normDomain.includes("learn.microsoft.com") ||
    normDomain.includes("docs.servicenow.com") ||
    normDomain.includes("docs.snowflake.com")
  ) {
    return { ownershipType: "DOCUMENTATION", associatedEntityName: null };
  }

  // 7. Community Sites
  if (
    normDomain.includes("reddit.com") ||
    normDomain.includes("quora.com") ||
    normDomain.includes("stackoverflow.com") ||
    normDomain.includes("github.com")
  ) {
    return { ownershipType: "COMMUNITY", associatedEntityName: null };
  }

  // 8. Social
  if (
    normDomain.includes("linkedin.com") ||
    normDomain.includes("twitter.com") ||
    normDomain.includes("x.com") ||
    normDomain.includes("youtube.com")
  ) {
    return { ownershipType: "SOCIAL", associatedEntityName: null };
  }

  // 9. Government & Educational
  if (normDomain.endsWith(".gov") || normDomain.endsWith(".gov.uk")) {
    return { ownershipType: "GOVERNMENT", associatedEntityName: null };
  }
  if (normDomain.endsWith(".edu") || normDomain.endsWith(".ac.uk")) {
    return { ownershipType: "EDUCATIONAL", associatedEntityName: null };
  }

  // 10. Third-Party Tech Authority
  if (
    normDomain.includes("servicenow.com") ||
    normDomain.includes("snowflake.com") ||
    normDomain.includes("microsoft.com") ||
    normDomain.includes("aws.amazon.com") ||
    normDomain.includes("google.com")
  ) {
    return { ownershipType: "THIRD_PARTY_AUTHORITY", associatedEntityName: null };
  }

  return { ownershipType: "OTHER", associatedEntityName: null };
}

export function classifySourcePageType(path: string): SourcePageType {
  const normPath = (path || "/").toLowerCase().trim();
  if (normPath === "/" || normPath === "") return "HOME";

  if (
    normPath.includes("/service") ||
    normPath.includes("/solution") ||
    normPath.includes("/consulting") ||
    normPath.includes("/implementation") ||
    normPath.includes("/advisory")
  ) {
    return "SERVICE";
  }

  if (normPath.includes("/case-stud") || normPath.includes("/customer-stor") || normPath.includes("/success-stor")) {
    return "CASE_STUDY";
  }

  if (normPath.includes("/product") || normPath.includes("/platform") || normPath.includes("/software")) {
    return "PRODUCT";
  }

  if (normPath.includes("/blog") || normPath.includes("/insight") || normPath.includes("/article")) {
    return "BLOG";
  }

  if (normPath.includes("/guide") || normPath.includes("/whitepaper") || normPath.includes("/ebook")) {
    return "GUIDE";
  }

  if (normPath.includes("/doc") || normPath.includes("/api") || normPath.includes("/developer")) {
    return "DOCUMENTATION";
  }

  if (normPath.includes("/partner") || normPath.includes("/alliance")) {
    return "PARTNER_PAGE";
  }

  if (normPath.includes("/profile") || normPath.includes("/vendor") || normPath.includes("/compan")) {
    return "DIRECTORY_PROFILE";
  }

  return "UNKNOWN";
}
