/**
 * Ecosystem Signals Inspector for /llms.txt and /llms-full.txt proposals.
 * Evaluates machine-readable summaries as an advisory ecosystem signal without penalizing standard SEO Health.
 */

import axios from "axios";
import { LlmsTxtReport } from "./types";

export async function inspectLlmsTxt(originUrl: URL, signal?: AbortSignal): Promise<LlmsTxtReport> {
  const llmsTxtUrl = new URL("/llms.txt", originUrl.origin).toString();
  const llmsFullTxtUrl = new URL("/llms-full.txt", originUrl.origin).toString();

  let hasLlmsTxt = false;
  let hasLlmsFullTxt = false;
  let characterCount = 0;

  try {
    const res = await axios.get(llmsTxtUrl, {
      timeout: 3000,
      signal,
      validateStatus: (status) => status === 200,
    });
    if (res.status === 200 && typeof res.data === "string" && res.data.trim().length > 10) {
      hasLlmsTxt = true;
      characterCount = res.data.length;
    }
  } catch {
    // Expected when not deployed
  }

  try {
    const resFull = await axios.get(llmsFullTxtUrl, {
      timeout: 3000,
      signal,
      validateStatus: (status) => status === 200,
    });
    if (resFull.status === 200 && typeof resFull.data === "string" && resFull.data.trim().length > 10) {
      hasLlmsFullTxt = true;
    }
  } catch {
    // Expected when not deployed
  }

  const status = hasLlmsTxt ? "PRESENT" : "NOT_PRESENT";
  const advisoryNote = hasLlmsTxt
    ? "A valid /llms.txt file is present, providing structured documentation for LLM ingestion."
    : "/llms.txt is not detected. This is an optional emerging ecosystem convention and does NOT affect traditional SEO Health or Google indexation.";

  return {
    hasLlmsTxt,
    hasLlmsFullTxt,
    llmsTxtUrl: hasLlmsTxt ? llmsTxtUrl : null,
    llmsFullTxtUrl: hasLlmsFullTxt ? llmsFullTxtUrl : null,
    characterCount,
    status,
    advisoryNote,
  };
}
