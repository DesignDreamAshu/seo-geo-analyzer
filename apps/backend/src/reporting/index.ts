/**
 * Phase 28K: Client Reporting & Executive Intelligence Module Exports.
 */

export * from "./types";
export * from "./engine";
export * from "./pdf-generator";
export * from "./csv-exporter";
export * from "./persistence/sqlite-report-repo";

import { ClientReportEngine } from "./engine";

export const globalClientReportEngine = new ClientReportEngine();
