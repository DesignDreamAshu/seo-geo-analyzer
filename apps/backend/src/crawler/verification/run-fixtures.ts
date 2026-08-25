import { evaluateAllRuleFixtures } from "./fixture-library";

function main() {
  const report = evaluateAllRuleFixtures();
  console.log("Total rules tested:", report.totalRulesTested);
  console.log("Total fixtures evaluated:", report.totalFixturesEvaluated);
  console.log(
    "Global TP:",
    report.globalTruePositives,
    "TN:",
    report.globalTrueNegatives,
    "FP:",
    report.globalFalsePositives,
    "FN:",
    report.globalFalseNegatives
  );
  console.log("All rules passed:", report.allRulesPassed);
  for (const r of report.ruleResults) {
    console.log(
      r.ruleCode.padEnd(30),
      "Fixtures:",
      String(r.totalFixtures).padEnd(3),
      "TP:",
      String(r.truePositives).padEnd(2),
      "TN:",
      String(r.trueNegatives).padEnd(2),
      "FP:",
      String(r.falsePositives).padEnd(2),
      "FN:",
      String(r.falseNegatives).padEnd(2),
      "Pass:",
      r.pass
    );
    if (!r.pass) {
      console.log("  Failed test cases:", JSON.stringify(r.testCases.filter((t) => !t.pass), null, 2));
    }
  }
}

main();
