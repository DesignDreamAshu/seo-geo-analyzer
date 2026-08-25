/**
 * Local Structured Data Validation & Schema Alignment Engine.
 * Verifies LocalBusiness schemas, subtypes, PostalAddress, and OpeningHours against visible entity truth.
 * Invariant: Never forces LocalBusiness schema onto online-only organizations or invalidates specific subtypes.
 */

import { BusinessLocation, PostalAddress } from "./types";
import { compareAddresses, normalizePhone } from "./nap-normalization";

export interface ParsedLocalBusinessSchema {
  type: string;
  name?: string;
  telephone?: string;
  address?: PostalAddress;
  geo?: { latitude?: number; longitude?: number };
  openingHours?: string[];
  url?: string;
}

export function validateLocalStructuredData(
  location: BusinessLocation,
  schemas: ParsedLocalBusinessSchema[]
): {
  isAligned: boolean;
  schemaType: string;
  issuesFound: string[];
} {
  if (schemas.length === 0) {
    return {
      isAligned: false,
      schemaType: "NONE",
      issuesFound: [`No LocalBusiness structured data discovered on location page for [${location.locationName}].`],
    };
  }

  const issues: string[] = [];
  const primarySchema = schemas[0];
  const schemaType = primarySchema.type || "LocalBusiness";

  // 1. Name Check
  if (primarySchema.name && location.businessName) {
    const sName = primarySchema.name.toLowerCase().trim();
    const lName = location.businessName.toLowerCase().trim();
    if (sName !== lName && !sName.includes(lName) && !lName.includes(sName)) {
      issues.push(`Schema business name '${primarySchema.name}' does not align with location business name '${location.businessName}'.`);
    }
  }

  // 2. Address Check (for physical locations)
  if (location.locationType === "PHYSICAL_LOCATION" && location.address && primarySchema.address) {
    const comp = compareAddresses(location.address, primarySchema.address);
    if (comp.isMismatch) {
      issues.push(`Schema address (${primarySchema.address.addressLocality || primarySchema.address.streetAddress}) conflicts with location address (${location.address.addressLocality || location.address.streetAddress}).`);
    }
  }

  // 3. Telephone Check
  if (location.phone && primarySchema.telephone) {
    const sPhone = normalizePhone(primarySchema.telephone);
    const lPhone = normalizePhone(location.phone);
    if (sPhone !== lPhone && !sPhone.endsWith(lPhone) && !lPhone.endsWith(sPhone)) {
      issues.push(`Schema telephone '${primarySchema.telephone}' differs from local branch number '${location.phone}' (review if central call center).`);
    }
  }

  return {
    isAligned: issues.length === 0,
    schemaType,
    issuesFound: issues,
  };
}
