import fs from "fs";
import path from "path";

const auditPath = path.resolve(process.cwd(), "../../artifacts/verification/run-1787169408774/audit.json");
const audit = JSON.parse(fs.readFileSync(auditPath, "utf-8"));

console.log("==========================================================================");
console.log("  DETAILED CLUSTERING OF REAL BOT PRODUCTION CRAWL FINDINGS");
console.log("==========================================================================\n");

function printCluster(title: string, issueCode: string) {
  const matching = audit.issues.filter((i: any) => i.code === issueCode);
  console.log(`\n--------------------------------------------------------------------------`);
  console.log(`>>> ${title} [Rule: ${issueCode}] (Total Findings: ${matching.length})`);
  console.log(`--------------------------------------------------------------------------`);

  if (matching.length === 0) {
    console.log("  No occurrences found.");
    return;
  }

  for (const issue of matching) {
    const urls = issue.affectedPages.map((p: any) => p.url);
    console.log(`Issue Title: "${issue.title}" | Unique Pages: ${urls.length} | Occurrences: ${issue.affectedPages.length}`);
    
    // Cluster URLs by path prefix
    const pathClusters = new Map<string, string[]>();
    for (const u of urls) {
      const parsed = new URL(u);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const prefix = segments.length > 0 ? `/${segments[0]}` : "/ (homepage)";
      if (!pathClusters.has(prefix)) pathClusters.set(prefix, []);
      pathClusters.get(prefix)!.push(u);
    }

    console.log(`URL Path Clusters:`);
    for (const [prefix, list] of pathClusters.entries()) {
      console.log(`  - Cluster [${prefix}]: ${list.length} URLs`);
      list.slice(0, 5).forEach((u) => console.log(`      * ${u}`));
      if (list.length > 5) console.log(`      * ... and ${list.length - 5} more`);
    }

    // Sample Evidence
    console.log(`Sample Evidence:`);
    issue.affectedPages.slice(0, 3).forEach((p: any, idx: number) => {
      console.log(`  [Sample ${idx + 1}] URL: ${p.url}`);
      console.log(`    Observed: ${JSON.stringify(p.evidence?.observed || p.evidence)}`);
      if (p.evidence?.domSelector) console.log(`    DOM Selector: ${p.evidence.domSelector}`);
    });
  }
}

// 1. Core Basic Headings
printCluster("1. Missing H1 Heading", "CONTENT_MISSING_H1");
printCluster("2. Multiple H1 Headings", "CONTENT_MULTIPLE_H1");
printCluster("3. Skipped Heading Hierarchy", "CONTENT_SKIPPED_HEADINGS");

// 2. Quick Technical
printCluster("4. Missing <main> Semantic Landmark", "A11Y_MISSING_MAIN_LANDMARK");
printCluster("5. Unlabelled Form Controls", "A11Y_UNLABELLED_FORM_CONTROL");
printCluster("6. Non-Descriptive Anchor Text", "LINKS_NON_DESCRIPTIVE_ANCHOR");
printCluster("7. Missing Image Dimensions (CLS)", "ASSET_MISSING_DIMENSIONS");

// 3. Complimentary Advanced
printCluster("8. Duplicate Title Tags", "DUP_IDENTICAL_TITLE");
printCluster("9. Missing Meta Descriptions", "CONTENT_MISSING_META_DESC");
printCluster("10. Malformed JSON-LD Structured Data", "SCHEMA_MALFORMED_JSON");
printCluster("11. Placeholder Hash Controls (href='#')", "CODE_PLACEHOLDER_ANCHOR");
