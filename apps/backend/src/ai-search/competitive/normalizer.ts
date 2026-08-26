/**
 * Phase 28J: Competitor Domain Normalizer & Identity Guard.
 * Ensures consistent canonical domain identities and prevents invalid or self-referential competitors.
 */

export function normalizeCompetitorDomain(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error("[COMPETITOR NORMALIZATION ERROR] Domain input cannot be empty.");
  }

  let cleaned = input.trim().toLowerCase();

  // Strip protocol
  cleaned = cleaned.replace(/^https?:\/\//, "");

  // Strip port, path, query, hash
  cleaned = cleaned.split("/")[0].split("?")[0].split("#")[0].split(":")[0];

  // Strip leading www.
  cleaned = cleaned.replace(/^www\./, "");

  // Strip trailing periods
  cleaned = cleaned.replace(/\.+$/, "");

  if (!cleaned || !cleaned.includes(".")) {
    throw new Error(`[COMPETITOR NORMALIZATION ERROR] Invalid domain format: "${input}"`);
  }

  return cleaned;
}

export function validateCompetitorAddition(
  clientDomain: string,
  competitorDomain: string,
  existingCompetitorDomains: string[]
): void {
  const normClient = normalizeCompetitorDomain(clientDomain);
  const normComp = normalizeCompetitorDomain(competitorDomain);

  if (normClient === normComp) {
    throw new Error(
      `[COMPETITOR VALIDATION ERROR] Cannot add client's own domain ("${normComp}") as a competitor!`
    );
  }

  const normalizedExisting = existingCompetitorDomains.map((d) => normalizeCompetitorDomain(d));
  if (normalizedExisting.includes(normComp)) {
    throw new Error(
      `[COMPETITOR VALIDATION ERROR] Competitor domain "${normComp}" is already configured for this project!`
    );
  }
}
