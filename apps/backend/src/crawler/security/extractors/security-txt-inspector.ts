/**
 * RFC 9116 security.txt Inspector (SECURITY S6).
 * Safely fetches and parses /.well-known/security.txt.
 */

import type { SecurityTxtFacts } from "../types";

export function parseSecurityTxtContent(rawText: string, requestedUrl: string, httpStatus: number, isHttps: boolean): SecurityTxtFacts {
  const lines = rawText.split(/\r?\n/);
  const contacts: string[] = [];
  let expires: string | null = null;
  let isExpired = false;
  let canonical: string | null = null;
  let policy: string | null = null;
  let encryption: string | null = null;
  let acknowledgments: string | null = null;
  let preferredLanguages: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    switch (key) {
      case "contact":
        contacts.push(value);
        break;
      case "expires":
        expires = value;
        try {
          const expDate = new Date(value);
          if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
            isExpired = true;
          }
        } catch {
          // unparseable
        }
        break;
      case "canonical":
        canonical = value;
        break;
      case "policy":
        policy = value;
        break;
      case "encryption":
        encryption = value;
        break;
      case "acknowledgments":
      case "acknowledgements":
        acknowledgments = value;
        break;
      case "preferred-languages":
        preferredLanguages = value;
        break;
    }
  }

  const hasSecurityTxt = httpStatus === 200 && contacts.length > 0;

  return {
    hasSecurityTxt,
    requestedUrl,
    httpStatus,
    isHttps,
    contact: contacts,
    expires,
    isExpired,
    canonical,
    policy,
    encryption,
    acknowledgments,
    preferredLanguages,
    rawText: rawText.slice(0, 4000), // bounded size
  };
}

export async function inspectSecurityTxt(
  targetDomain: string,
  options: { timeoutMs?: number; skipNetworkProbes?: boolean } = {}
): Promise<SecurityTxtFacts> {
  const url = `https://${targetDomain}/.well-known/security.txt`;

  if (options.skipNetworkProbes) {
    return {
      hasSecurityTxt: false,
      requestedUrl: url,
      httpStatus: 0,
      isHttps: true,
      contact: [],
      expires: null,
      isExpired: false,
      canonical: null,
      policy: null,
      encryption: null,
      acknowledgments: null,
      preferredLanguages: null,
      rawText: null,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 3000);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DreamSEO-SecurityBot/1.0; +https://dreamseo.com/bot)",
        "Accept": "text/plain, */*",
      },
    });
    clearTimeout(timeout);

    if (res.status === 200) {
      const text = await res.text();
      return parseSecurityTxtContent(text, url, res.status, true);
    }
  } catch {
    // network or timeout
  }

  return {
    hasSecurityTxt: false,
    requestedUrl: url,
    httpStatus: 404,
    isHttps: true,
    contact: [],
    expires: null,
    isExpired: false,
    canonical: null,
    policy: null,
    encryption: null,
    acknowledgments: null,
    preferredLanguages: null,
    rawText: null,
  };
}
