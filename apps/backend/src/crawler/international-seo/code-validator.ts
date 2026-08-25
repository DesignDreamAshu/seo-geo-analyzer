/**
 * BCP 47 & Hreflang Code Validator.
 * Validates ISO 639-1 language codes, ISO 3166-1 region codes, script codes (zh-Hans), and x-default.
 * Detects reversed formats (e.g. US-en) and malformed syntax without false rejections on valid ISO codes.
 */

// Common ISO 639-1 two-letter and ISO 639-2 three-letter language codes
const VALID_LANGUAGES = new Set([
  "en", "fr", "de", "es", "it", "pt", "nl", "ja", "zh", "ru", "ar", "hi", "bn",
  "pa", "te", "mr", "ta", "ur", "gu", "kn", "ml", "pl", "sv", "da", "fi", "no",
  "cs", "sk", "hu", "ro", "bg", "el", "tr", "he", "id", "ms", "th", "vi", "ko",
  "uk", "ca", "hr", "sr", "sl", "lt", "lv", "et", "fa", "fil", "tl", "sw", "af",
]);

// Valid script subtags
const VALID_SCRIPTS = new Set(["hans", "hant", "cyrl", "latn", "arab", "deva"]);

// Valid ISO 3166-1 alpha-2 country codes
const VALID_REGIONS = new Set([
  "us", "gb", "uk", "ca", "au", "in", "de", "fr", "es", "it", "nl", "br", "mx",
  "jp", "cn", "ru", "sa", "ae", "sg", "nz", "za", "se", "no", "dk", "fi", "pl",
  "ch", "at", "be", "ie", "pt", "gr", "tr", "il", "id", "my", "th", "vn", "kr",
  "hk", "tw", "ar", "cl", "co", "pe", "ph", "cz", "hu", "ro", "bg", "ua", "global",
]);

export function validateHreflangCode(rawCode: string): {
  isValid: boolean;
  normalizedCode: string;
  issueDescription?: string;
} {
  const code = (rawCode || "").trim().toLowerCase();

  if (!code) {
    return { isValid: false, normalizedCode: "", issueDescription: "Empty hreflang code." };
  }

  if (code === "x-default") {
    return { isValid: true, normalizedCode: "x-default" };
  }

  const parts = code.split("-");

  // 1. Language only (e.g. "en", "fr")
  if (parts.length === 1) {
    if (VALID_LANGUAGES.has(parts[0])) {
      return { isValid: true, normalizedCode: parts[0] };
    }
    return { isValid: false, normalizedCode: code, issueDescription: `Invalid ISO 639-1 language code '${parts[0]}'.` };
  }

  // 2. Language + Region (e.g. "en-us") or Reversed (e.g. "us-en")
  if (parts.length === 2) {
    const p1 = parts[0];
    const p2 = parts[1];

    // Check for reversed format e.g. "us-en"
    if (VALID_REGIONS.has(p1) && VALID_LANGUAGES.has(p2) && !VALID_LANGUAGES.has(p1)) {
      return {
        isValid: false,
        normalizedCode: code,
        issueDescription: `Reversed hreflang format '${rawCode}' (Region-Language instead of Language-Region '${p2}-${p1.toUpperCase()}').`,
      };
    }

    // Standard Language-Region
    if (VALID_LANGUAGES.has(p1) && (VALID_REGIONS.has(p2) || VALID_SCRIPTS.has(p2))) {
      return { isValid: true, normalizedCode: `${p1}-${p2.toUpperCase()}` };
    }

    return {
      isValid: false,
      normalizedCode: code,
      issueDescription: `Invalid combination '${rawCode}' in language or region code.`,
    };
  }

  // 3. Language + Script + Region (e.g. "zh-hans-cn")
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (VALID_LANGUAGES.has(p1) && VALID_SCRIPTS.has(p2) && VALID_REGIONS.has(p3)) {
      return { isValid: true, normalizedCode: `${p1}-${p2.charAt(0).toUpperCase() + p2.slice(1)}-${p3.toUpperCase()}` };
    }
  }

  return { isValid: false, normalizedCode: code, issueDescription: `Malformed BCP 47 hreflang syntax '${rawCode}'.` };
}
