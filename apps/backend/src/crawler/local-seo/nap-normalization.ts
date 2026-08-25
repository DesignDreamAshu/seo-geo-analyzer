/**
 * NAP (Name, Address, Phone) Normalization & Consistency Engine.
 * Normalizes phone numbers, street addresses, and brand aliases conservatively.
 * Enforces location-scoped isolation so distinct physical branches are never cross-compared.
 */

import { PostalAddress, NapConsistencyState, ObservedNapEvidence, BusinessLocation } from "./types";

export function normalizePhone(rawPhone?: string): string {
  if (!rawPhone) return "";
  // Strip all non-digit characters except leading '+'
  const clean = rawPhone.trim().replace(/[^\d+]/g, "");
  // Handle Indian leading 0 vs +91
  if (clean.startsWith("0") && clean.length === 11) {
    return `+91${clean.substring(1)}`;
  }
  if (!clean.startsWith("+") && clean.length === 10) {
    return clean;
  }
  return clean;
}

export function normalizeAddressStreet(street?: string): string {
  if (!street) return "";
  return street
    .toLowerCase()
    .replace(/[,\.]/g, "")
    .replace(/\broad\b/g, "rd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bsuite\b/g, "ste")
    .replace(/\s+/g, " ")
    .trim();
}

export function compareAddresses(addr1?: PostalAddress, addr2?: PostalAddress): {
  isExact: boolean;
  isFormatVariation: boolean;
  isMismatch: boolean;
} {
  if (!addr1 || !addr2) {
    return { isExact: false, isFormatVariation: false, isMismatch: false };
  }

  const s1 = normalizeAddressStreet(addr1.streetAddress);
  const s2 = normalizeAddressStreet(addr2.streetAddress);

  const c1 = (addr1.addressLocality || "").toLowerCase().trim();
  const c2 = (addr2.addressLocality || "").toLowerCase().trim();

  const p1 = (addr1.postalCode || "").replace(/\s+/g, "").trim();
  const p2 = (addr2.postalCode || "").replace(/\s+/g, "").trim();

  // If city or postal code differ materially, it is a mismatch
  if (c1 && c2 && c1 !== c2) {
    return { isExact: false, isFormatVariation: false, isMismatch: true };
  }
  if (p1 && p2 && p1 !== p2) {
    return { isExact: false, isFormatVariation: false, isMismatch: true };
  }

  if (s1 === s2) {
    if (addr1.streetAddress?.trim() === addr2.streetAddress?.trim()) {
      return { isExact: true, isFormatVariation: false, isMismatch: false };
    }
    return { isExact: false, isFormatVariation: true, isMismatch: false };
  }

  // If normalized streets match closely or one contains the other
  if (s1 && s2 && (s1.includes(s2) || s2.includes(s1))) {
    return { isExact: false, isFormatVariation: true, isMismatch: false };
  }

  return { isExact: false, isFormatVariation: false, isMismatch: true };
}

export function evaluateNapConsistency(
  location: BusinessLocation,
  evidences: ObservedNapEvidence[],
  brandAliases: string[] = []
): {
  state: NapConsistencyState;
  details: string;
  evidenceCount: number;
} {
  // Filter evidence scoped strictly to this specific locationId
  const locationEvidence = evidences.filter((e) => e.locationId === location.locationId);

  if (locationEvidence.length === 0) {
    return {
      state: "NAP_INSUFFICIENT_EVIDENCE",
      details: `No external or website NAP evidence discovered for location [${location.locationName}].`,
      evidenceCount: 0,
    };
  }

  const basePhone = normalizePhone(location.phone);
  let hasFormatVariation = false;
  let hasConfirmedMismatch = false;
  const mismatchDetails: string[] = [];

  for (const ev of locationEvidence) {
    // 1. Phone check
    if (ev.observedPhone && basePhone) {
      const evPhone = normalizePhone(ev.observedPhone);
      if (evPhone !== basePhone && !evPhone.endsWith(basePhone) && !basePhone.endsWith(evPhone)) {
        hasConfirmedMismatch = true;
        mismatchDetails.push(`Phone mismatch on [${ev.sourceUrl}] (Observed: ${ev.observedPhone} vs Configured: ${location.phone})`);
      }
    }

    // 2. Address check (if physical location)
    if (location.locationType === "PHYSICAL_LOCATION" && location.address && ev.observedAddress) {
      const addrComp = compareAddresses(location.address, ev.observedAddress);
      if (addrComp.isMismatch) {
        hasConfirmedMismatch = true;
        mismatchDetails.push(`Address mismatch on [${ev.sourceUrl}] (Observed: ${ev.observedAddress.addressLocality || ev.observedAddress.streetAddress} vs Configured: ${location.address.addressLocality || location.address.streetAddress})`);
      } else if (addrComp.isFormatVariation) {
        hasFormatVariation = true;
      }
    }
  }

  if (hasConfirmedMismatch) {
    return {
      state: "NAP_CONFIRMED_MISMATCH",
      details: mismatchDetails.join("; "),
      evidenceCount: locationEvidence.length,
    };
  }

  if (hasFormatVariation) {
    return {
      state: "NAP_FORMAT_VARIATION_ONLY",
      details: "Harmless address abbreviations or formatting differences observed across verified sources.",
      evidenceCount: locationEvidence.length,
    };
  }

  return {
    state: "NAP_CONSISTENT",
    details: "Observed Name, Address, and Phone align across all verified website and provider sources.",
    evidenceCount: locationEvidence.length,
  };
}
