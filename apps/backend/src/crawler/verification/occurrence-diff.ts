import type { StructuredOccurrence } from "../types";

export interface OccurrenceItem {
  raw: string;
  normalizedKey: string;
  displayLabel: string;
  hint?: string;
  occurrenceId?: string;
  type?: string;
  identity?: string;
  tagName?: string;
  selector?: string;
  attributes?: Record<string, string | null | undefined>;
  snippet?: string;
  metadata?: Record<string, any>;
}

export interface OccurrenceDiffResult {
  originalCount: number;
  fixedCount: number;
  remainingCount: number;
  newCount: number;
  unverifiableCount: number;
  status: "VERIFIED_FIXED" | "PARTIALLY_FIXED" | "STILL_PRESENT" | "NEW_ISSUES_DETECTED" | "UNVERIFIABLE";
  summaryLabel: string;
  remainingOccurrences: OccurrenceItem[];
  fixedOccurrences: OccurrenceItem[];
  newOccurrences: OccurrenceItem[];
}

/**
 * Converts structured occurrence objects into normalized OccurrenceItems for diffing.
 */
export function convertStructuredToOccurrenceItems(occurrences?: StructuredOccurrence[] | null): OccurrenceItem[] {
  if (!occurrences || !Array.isArray(occurrences) || occurrences.length === 0) return [];

  return occurrences.map((occ) => {
    let normalizedKey = "";
    const tag = occ.tagName?.toLowerCase() || occ.type.toLowerCase();
    const name = occ.attributes?.name;
    const id = occ.attributes?.id;
    const src = occ.attributes?.src || occ.targetUrl;
    const href = occ.attributes?.href || occ.targetUrl;
    const typeAttr = occ.attributes?.type;

    if (name) {
      normalizedKey = `${tag}:name=${name.toLowerCase()}`;
    } else if (id) {
      normalizedKey = `${tag}:id=${id.toLowerCase()}`;
    } else if (src) {
      normalizedKey = `${tag}:src=${src.toLowerCase()}`;
    } else if (href) {
      normalizedKey = `${tag}:href=${href.toLowerCase()}`;
    } else if (typeAttr) {
      normalizedKey = `${tag}:type=${typeAttr.toLowerCase()}`;
    } else if (occ.selector) {
      normalizedKey = `${tag}:sel=${occ.selector.toLowerCase()}`;
    } else {
      normalizedKey = `${tag}:${occ.identity.toLowerCase().trim()}`;
    }

    return {
      raw: occ.snippet || occ.identity,
      normalizedKey,
      displayLabel: occ.identity || occ.label || occ.snippet || normalizedKey,
      hint: occ.label,
      occurrenceId: occ.occurrenceId,
      type: occ.type,
      identity: occ.identity,
      tagName: occ.tagName || undefined,
      selector: occ.selector || undefined,
      attributes: occ.attributes,
      snippet: occ.snippet || undefined,
      metadata: occ.metadata,
    };
  });
}

/**
 * Extracts discrete occurrence items from an HTML snippet or comma/newline separated list.
 */
export function extractOccurrencesFromSnippet(snippet?: string | null): OccurrenceItem[] {
  if (!snippet || typeof snippet !== "string") return [];
  const trimmed = snippet.trim();
  if (!trimmed) return [];

  const items: OccurrenceItem[] = [];

  // Pattern 1: HTML Tag Elements (e.g. <input name="Name">, <textarea name="Message-2">, <img src="...">)
  const tagRegex = /<([a-zA-Z0-9_-]+)([^>]*)>/g;
  let tagMatch: RegExpExecArray | null;
  let foundTags = false;

  while ((tagMatch = tagRegex.exec(trimmed)) !== null) {
    foundTags = true;
    const tagName = tagMatch[1].toLowerCase();
    const rawAttrs = tagMatch[2] || "";
    const rawTag = tagMatch[0];

    // Extract key attributes
    const nameMatch = rawAttrs.match(/\bname=["']([^"']+)["']/i);
    const idMatch = rawAttrs.match(/\bid=["']([^"']+)["']/i);
    const srcMatch = rawAttrs.match(/\bsrc=["']([^"']+)["']/i);
    const hrefMatch = rawAttrs.match(/\bhref=["']([^"']+)["']/i);
    const typeMatch = rawAttrs.match(/\btype=["']([^"']+)["']/i);
    const altMatch = rawAttrs.match(/\balt=["']([^"']+)["']/i);

    let normalizedKey = "";
    let displayLabel = "";

    if (nameMatch) {
      normalizedKey = `${tagName}:name=${nameMatch[1].toLowerCase()}`;
      displayLabel = `<${tagName} name="${nameMatch[1]}">`;
    } else if (idMatch) {
      normalizedKey = `${tagName}:id=${idMatch[1].toLowerCase()}`;
      displayLabel = `<${tagName} id="${idMatch[1]}">`;
    } else if (srcMatch) {
      normalizedKey = `${tagName}:src=${srcMatch[1].toLowerCase()}`;
      displayLabel = `<${tagName} src="${srcMatch[1]}">`;
    } else if (hrefMatch) {
      normalizedKey = `${tagName}:href=${hrefMatch[1].toLowerCase()}`;
      displayLabel = `<${tagName} href="${hrefMatch[1]}">`;
    } else if (typeMatch) {
      normalizedKey = `${tagName}:type=${typeMatch[1].toLowerCase()}`;
      displayLabel = `<${tagName} type="${typeMatch[1]}">`;
    } else {
      normalizedKey = `${tagName}:${rawAttrs.trim().toLowerCase()}`;
      displayLabel = rawTag;
    }

    items.push({
      raw: rawTag,
      normalizedKey,
      displayLabel,
    });
  }

  if (foundTags && items.length > 0) {
    return items;
  }

  // Pattern 2: Comma or Newline-separated lists of URLs or identifiers
  const linesOrCommas = trimmed.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
  for (const entry of linesOrCommas) {
    if (entry.length === 0) continue;
    items.push({
      raw: entry,
      normalizedKey: entry.toLowerCase().replace(/["']/g, ""),
      displayLabel: entry,
    });
  }

  return items;
}

/**
 * Normalizes any supported input into an array of OccurrenceItem.
 */
export function resolveOccurrenceItems(
  input?: string | StructuredOccurrence[] | OccurrenceItem[] | null
): OccurrenceItem[] {
  if (!input) return [];
  if (typeof input === "string") {
    return extractOccurrencesFromSnippet(input);
  }
  if (Array.isArray(input)) {
    if (input.length === 0) return [];
    // Check if first element is already OccurrenceItem (has normalizedKey)
    if ("normalizedKey" in input[0]) {
      return input as OccurrenceItem[];
    }
    return convertStructuredToOccurrenceItems(input as StructuredOccurrence[]);
  }
  return [];
}

/**
 * Computes generic occurrence diff between original audit evidence and live verification evidence.
 */
export function computeOccurrenceDiff(
  original?: string | StructuredOccurrence[] | OccurrenceItem[] | null,
  live?: string | StructuredOccurrence[] | OccurrenceItem[] | null,
  fallbackOriginalCount = 1,
  fallbackLiveCount = 1
): OccurrenceDiffResult {
  const originalItems = resolveOccurrenceItems(original);
  const liveItems = resolveOccurrenceItems(live);

  // If no structured items could be resolved, fallback to counts
  if (originalItems.length === 0 && liveItems.length === 0) {
    const orig = Math.max(1, fallbackOriginalCount);
    const liveCount = Math.max(0, fallbackLiveCount);
    const fixed = Math.max(0, orig - liveCount);
    const remaining = liveCount;

    let status: OccurrenceDiffResult["status"] = "STILL_PRESENT";
    if (remaining === 0) status = "VERIFIED_FIXED";
    else if (fixed > 0 && remaining > 0) status = "PARTIALLY_FIXED";

    return {
      originalCount: orig,
      fixedCount: fixed,
      remainingCount: remaining,
      newCount: 0,
      unverifiableCount: 0,
      status,
      summaryLabel: `${fixed} / ${orig} Fixed · ${remaining} Remaining`,
      remainingOccurrences: [],
      fixedOccurrences: [],
      newOccurrences: [],
    };
  }

  const liveKeysSet = new Set(liveItems.map((i) => i.normalizedKey));
  const origKeysSet = new Set(originalItems.map((i) => i.normalizedKey));

  const remainingOccurrences: OccurrenceItem[] = [];
  const fixedOccurrences: OccurrenceItem[] = [];
  const newOccurrences: OccurrenceItem[] = [];

  for (const item of originalItems) {
    if (liveKeysSet.has(item.normalizedKey)) {
      remainingOccurrences.push(item);
    } else {
      fixedOccurrences.push(item);
    }
  }

  for (const item of liveItems) {
    if (!origKeysSet.has(item.normalizedKey)) {
      newOccurrences.push(item);
    }
  }

  const originalCount = originalItems.length;
  const remainingCount = remainingOccurrences.length;
  const fixedCount = fixedOccurrences.length;
  const newCount = newOccurrences.length;

  let status: OccurrenceDiffResult["status"] = "STILL_PRESENT";
  if (remainingCount === 0 && newCount === 0) {
    status = "VERIFIED_FIXED";
  } else if (fixedCount > 0 && remainingCount > 0) {
    status = "PARTIALLY_FIXED";
  } else if (fixedCount === 0 && remainingCount === originalCount && newCount === 0) {
    status = "STILL_PRESENT";
  } else if (newCount > 0) {
    status = fixedCount > 0 ? "PARTIALLY_FIXED" : "NEW_ISSUES_DETECTED";
  }

  const summaryLabel = `${fixedCount} / ${originalCount} Fixed · ${remainingCount} Remaining${
    newCount > 0 ? ` (+${newCount} new)` : ""
  }`;

  return {
    originalCount,
    fixedCount,
    remainingCount,
    newCount,
    unverifiableCount: 0,
    status,
    summaryLabel,
    remainingOccurrences,
    fixedOccurrences,
    newOccurrences,
  };
}
