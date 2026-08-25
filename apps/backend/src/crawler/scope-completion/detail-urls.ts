import fs from "fs";
import path from "path";

const auditPath = path.resolve(process.cwd(), "../../artifacts/verification/run-1787169408774/audit.json");
const audit = JSON.parse(fs.readFileSync(auditPath, "utf-8"));

function getUrlsFor(code: string) {
  const issues = audit.issues.filter((i: any) => i.code === code);
  const set = new Set<string>();
  issues.forEach((i: any) => i.affectedPages.forEach((p: any) => set.add(p.url)));
  return Array.from(set);
}

console.log("1. Missing H1 URLs (12):", getUrlsFor("CONTENT_MISSING_H1"));
console.log("\n2. Multiple H1 URLs (9):", getUrlsFor("CONTENT_MULTIPLE_H1"));
console.log("\n3. Skipped Headings URL Clusters (97):");
const skipped = getUrlsFor("CONTENT_SKIPPED_HEADINGS");
const skippedClusters: Record<string, number> = {};
skipped.forEach(u => {
  const seg = new URL(u).pathname.split("/")[1] || "root";
  skippedClusters[seg] = (skippedClusters[seg] || 0) + 1;
});
console.log(skippedClusters);

console.log("\n4. Missing <main> Landmark URL Clusters (56):");
const missingMain = getUrlsFor("A11Y_MISSING_MAIN_LANDMARK");
const mainClusters: Record<string, number> = {};
missingMain.forEach(u => {
  const seg = new URL(u).pathname.split("/")[1] || "root";
  mainClusters[seg] = (mainClusters[seg] || 0) + 1;
});
console.log(mainClusters);

console.log("\n5. Unlabelled Form Controls URLs (20):", getUrlsFor("A11Y_UNLABELLED_FORM_CONTROL"));
console.log("\n6. Non-descriptive anchor URL (1):", getUrlsFor("LINKS_NON_DESCRIPTIVE_ANCHOR"));
console.log("\n7. Malformed JSON-LD URLs (13):", getUrlsFor("SCHEMA_MALFORMED_JSON"));
console.log("\n8. Duplicate Titles URLs (17):", getUrlsFor("DUP_IDENTICAL_TITLE"));
console.log("\n9. Missing Meta Description URLs (15):", getUrlsFor("CONTENT_MISSING_META_DESC"));
