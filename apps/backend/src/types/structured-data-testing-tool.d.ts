declare module "structured-data-testing-tool" {
  export interface StructuredDataTestResult {
    passed?: unknown[];
    failed?: Array<Record<string, unknown>>;
    warnings?: Array<Record<string, unknown>>;
    optional?: Array<Record<string, unknown>>;
    schemas?: string[];
    metatags?: Record<string, string>;
  }

  export interface StructuredDataOptions {
    auto?: boolean;
    schemas?: string[];
    presets?: unknown[];
    tests?: unknown[];
  }

  export function structuredDataTest(
    input: string | Buffer,
    options?: StructuredDataOptions,
  ): Promise<StructuredDataTestResult>;
}
