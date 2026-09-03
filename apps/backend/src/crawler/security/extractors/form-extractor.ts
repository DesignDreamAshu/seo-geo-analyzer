/**
 * Form Security Fact Extractor (SECURITY S1).
 * Extracts form action endpoints, transport protocols, sensitive input types, and cross-origin destinations.
 */

import * as cheerio from "cheerio";
import type { CrawledPageData } from "../../types";
import type { FormSecurityFact } from "../types";

const CSRF_INPUT_NAME_PATTERN = /(csrf|xsrf|authenticity_token|__requestverificationtoken|nonce|_token)/i;
const SENSITIVE_INPUT_NAME_PATTERN = /(password|passwd|pwd|card|cvv|cvc|ssn|secret|apikey|api_key|token)/i;

function resolveAbsoluteUrl(rawUrl: string, baseUrl: string): string {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

export function extractPageForms(page: CrawledPageData): FormSecurityFact[] {
  const facts: FormSecurityFact[] = [];
  const sourcePageUrl = page.url;

  let sourcePageOrigin = "";
  let sourcePageIsHttps = false;
  try {
    const parsed = new URL(sourcePageUrl);
    sourcePageOrigin = parsed.origin;
    sourcePageIsHttps = parsed.protocol === "https:";
  } catch {
    return facts;
  }

  const html = page.html || "";
  if (!html) return facts;

  const $ = cheerio.load(html);

  $("form").each((_, formEl) => {
    const $form = $(formEl);
    const formId = $form.attr("id") || null;
    const rawAction = $form.attr("action") || "";
    const rawMethod = ($form.attr("method") || "GET").trim().toUpperCase();

    let method: FormSecurityFact["method"] = "UNKNOWN";
    if (rawMethod === "GET") method = "GET";
    else if (rawMethod === "POST") method = "POST";
    else if (rawMethod === "PUT") method = "PUT";
    else if (rawMethod === "DELETE") method = "DELETE";
    else if (rawMethod === "DIALOG") method = "DIALOG";

    // If action is empty, browser submits to current page URL
    const resolvedAbsoluteActionUrl = rawAction.trim()
      ? resolveAbsoluteUrl(rawAction.trim(), sourcePageUrl)
      : sourcePageUrl;

    let actionOrigin = "";
    let actionIsHttps = false;
    let actionIsInsecureHttp = false;

    try {
      const parsedAction = new URL(resolvedAbsoluteActionUrl);
      actionOrigin = parsedAction.origin;
      actionIsHttps = parsedAction.protocol === "https:";
      actionIsInsecureHttp = parsedAction.protocol === "http:";
    } catch {
      actionOrigin = "";
    }

    const isCrossDomainAction = Boolean(actionOrigin && actionOrigin !== sourcePageOrigin);

    const inputs: FormSecurityFact["inputs"] = [];
    let passwordInputCount = 0;
    let fileInputCount = 0;
    let hasVisibleCsrfTokenCandidate = false;
    let csrfTokenNameCandidate: string | null = null;

    $form.find("input, select, textarea").each((_, inputEl) => {
      const $input = $(inputEl);
      const tagName = inputEl.tagName.toLowerCase();
      const rawType = ($input.attr("type") || (tagName === "textarea" ? "textarea" : "text")).toLowerCase();
      const name = $input.attr("name") || null;
      const id = $input.attr("id") || null;
      const autocomplete = $input.attr("autocomplete") || null;

      const isPassword = rawType === "password";
      if (isPassword) passwordInputCount++;

      const isFile = rawType === "file";
      if (isFile) fileInputCount++;

      const isSensitive = isPassword || Boolean(name && SENSITIVE_INPUT_NAME_PATTERN.test(name));

      if (name && CSRF_INPUT_NAME_PATTERN.test(name)) {
        hasVisibleCsrfTokenCandidate = true;
        csrfTokenNameCandidate = name;
      }

      inputs.push({
        type: rawType,
        name,
        id,
        autocomplete,
        isPassword,
        isSensitive,
      });
    });

    const hasPasswordInput = passwordInputCount > 0;
    const hasFileInput = fileInputCount > 0;
    const hasSensitiveInputInGetForm = method === "GET" && inputs.some((i) => i.isSensitive);

    facts.push({
      sourcePageUrl,
      sourcePageIsHttps,
      formId,
      rawAction: rawAction || null,
      resolvedAbsoluteActionUrl,
      actionOrigin,
      actionIsHttps,
      actionIsInsecureHttp,
      isCrossDomainAction,
      method,
      hasPasswordInput,
      passwordInputCount,
      hasFileInput,
      fileInputCount,
      hasSensitiveInputInGetForm,
      inputs,
      hasVisibleCsrfTokenCandidate,
      csrfTokenNameCandidate,
    });
  });

  return facts;
}
