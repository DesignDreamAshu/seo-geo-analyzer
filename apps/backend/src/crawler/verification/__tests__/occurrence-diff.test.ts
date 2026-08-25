import { describe, it, expect } from "vitest";
import {
  extractOccurrencesFromSnippet,
  computeOccurrenceDiff,
} from "../occurrence-diff";

describe("Generic Evidence Occurrence Diff Engine", () => {
  it("computes ARIA form control diff (7 original -> 6 fixed, 1 remaining)", () => {
    const originalSnippet = `<input name="Name">, <input name="Last-Name">, <input name="Email">, <input name="Contact-Number">, <input name="Organization">, <input name="Location">, <textarea name="Message-2">`;
    const liveSnippet = `<textarea name="Message-2">`;

    const diff = computeOccurrenceDiff(originalSnippet, liveSnippet);

    expect(diff.originalCount).toBe(7);
    expect(diff.fixedCount).toBe(6);
    expect(diff.remainingCount).toBe(1);
    expect(diff.newCount).toBe(0);
    expect(diff.status).toBe("PARTIALLY_FIXED");
    expect(diff.summaryLabel).toBe("6 / 7 Fixed · 1 Remaining");
    expect(diff.remainingOccurrences[0].normalizedKey).toBe("textarea:name=message-2");
    expect(diff.fixedOccurrences.length).toBe(6);
  });

  it("handles all items fixed (7 -> 0)", () => {
    const originalSnippet = `<input name="Name">, <input name="Last-Name">, <input name="Email">, <input name="Contact-Number">, <input name="Organization">, <input name="Location">, <textarea name="Message-2">`;
    const liveSnippet = null;

    const diff = computeOccurrenceDiff(originalSnippet, liveSnippet);

    expect(diff.originalCount).toBe(7);
    expect(diff.fixedCount).toBe(7);
    expect(diff.remainingCount).toBe(0);
    expect(diff.status).toBe("VERIFIED_FIXED");
    expect(diff.summaryLabel).toBe("7 / 7 Fixed · 0 Remaining");
  });

  it("handles none fixed (7 -> 7)", () => {
    const originalSnippet = `<input name="Name">, <input name="Last-Name">, <input name="Email">, <input name="Contact-Number">, <input name="Organization">, <input name="Location">, <textarea name="Message-2">`;
    const liveSnippet = `<input name="Name">, <input name="Last-Name">, <input name="Email">, <input name="Contact-Number">, <input name="Organization">, <input name="Location">, <textarea name="Message-2">`;

    const diff = computeOccurrenceDiff(originalSnippet, liveSnippet);

    expect(diff.originalCount).toBe(7);
    expect(diff.fixedCount).toBe(0);
    expect(diff.remainingCount).toBe(7);
    expect(diff.status).toBe("STILL_PRESENT");
    expect(diff.summaryLabel).toBe("0 / 7 Fixed · 7 Remaining");
  });

  it("handles newly introduced issues alongside partial fixes", () => {
    const originalSnippet = `<input name="Name">, <input name="Email">, <input name="Phone">`;
    const liveSnippet = `<input name="Phone">, <input name="TaxId">`;

    const diff = computeOccurrenceDiff(originalSnippet, liveSnippet);

    expect(diff.originalCount).toBe(3);
    expect(diff.fixedCount).toBe(2); // Name and Email fixed
    expect(diff.remainingCount).toBe(1); // Phone still present
    expect(diff.newCount).toBe(1); // TaxId is new
    expect(diff.status).toBe("PARTIALLY_FIXED");
    expect(diff.summaryLabel).toBe("2 / 3 Fixed · 1 Remaining (+1 new)");
  });

  it("handles broken links occurrence diffs", () => {
    const originalSnippet = `https://example.com/broken-1, https://example.com/broken-2, https://example.com/broken-3`;
    const liveSnippet = `https://example.com/broken-3`;

    const diff = computeOccurrenceDiff(originalSnippet, liveSnippet);

    expect(diff.originalCount).toBe(3);
    expect(diff.fixedCount).toBe(2);
    expect(diff.remainingCount).toBe(1);
    expect(diff.status).toBe("PARTIALLY_FIXED");
    expect(diff.remainingOccurrences[0].displayLabel).toBe("https://example.com/broken-3");
  });

  it("handles image assets missing alt or dimensions", () => {
    const originalSnippet = `<img src="/images/hero.webp">, <img src="/images/team.jpg">, <img src="/images/logo.png">`;
    const liveSnippet = `<img src="/images/team.jpg">`;

    const diff = computeOccurrenceDiff(originalSnippet, liveSnippet);

    expect(diff.originalCount).toBe(3);
    expect(diff.fixedCount).toBe(2);
    expect(diff.remainingCount).toBe(1);
    expect(diff.remainingOccurrences[0].normalizedKey).toBe("img:src=/images/team.jpg");
  });
});
