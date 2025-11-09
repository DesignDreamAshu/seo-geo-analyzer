declare module "lighthouse/report/generator/report-generator.js" {
  import type { Result } from "lighthouse";

  export class ReportGenerator {
    static generateReport(lhr: Result, format: "json" | "html" | "csv"): string;
  }
}
