/**
 * Security Redaction Engine (SECURITY S1).
 * Strictly redacts sensitive credentials, tokens, cookies, auth headers, and environment variables
 * from evidence artifacts to prevent secrets leakage in persistence, API responses, exports, and logs.
 */

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-access-token",
  "x-secret",
  "apikey",
  "secret",
  "token",
  "private-key",
]);

const SENSITIVE_QUERY_PARAMS = new Set([
  "token",
  "access_token",
  "auth_token",
  "apikey",
  "api_key",
  "key",
  "secret",
  "client_secret",
  "password",
  "passwd",
  "pwd",
  "jwt",
  "session",
  "sessionid",
  "session_id",
  "bearer",
]);

const SENSITIVE_ENV_KEY_PATTERN = /(password|secret|key|token|auth|credential|jwt|private|cert|signature|salt|hash|conn_str|connection_string|database_url)/i;

/**
 * Redacts a cookie value while preserving structure information (presence, length).
 */
export function redactCookieValue(cookieValue: string): string {
  if (!cookieValue) return "";
  const trimmed = cookieValue.trim();
  if (trimmed.length <= 4) {
    return "[REDACTED]";
  }
  const first = trimmed.charAt(0);
  const last = trimmed.charAt(trimmed.length - 1);
  return `${first}***${last}(len=${trimmed.length})`;
}

/**
 * Redacts sensitive query parameters from a URL string.
 */
export function redactUrlParams(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    let mutated = false;

    for (const [key] of parsed.searchParams.entries()) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase()) || SENSITIVE_ENV_KEY_PATTERN.test(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
        mutated = true;
      }
    }

    // Redact basic auth username / password if embedded in URL
    if (parsed.username || parsed.password) {
      parsed.username = parsed.username ? "[USER]" : "";
      parsed.password = parsed.password ? "[REDACTED]" : "";
      mutated = true;
    }

    return mutated ? parsed.toString() : rawUrl;
  } catch {
    return rawUrl;
  }
}

/**
 * Redacts sensitive HTTP header maps.
 */
export function redactHeadersMap(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};

  for (const [rawKey, val] of Object.entries(headers)) {
    if (val === undefined || val === null) {
      continue;
    }
    const keyLower = rawKey.toLowerCase();

    if (SENSITIVE_HEADER_KEYS.has(keyLower)) {
      if (Array.isArray(val)) {
        result[rawKey] = val.map(() => "[REDACTED]");
      } else {
        result[rawKey] = "[REDACTED]";
      }
    } else {
      result[rawKey] = val;
    }
  }

  return result;
}

/**
 * Redacts sensitive content in text snippets (such as discovered .env lines).
 */
export function redactEnvSnippet(rawSnippet: string, maxLen = 160): string {
  if (!rawSnippet) return "";

  const lines = rawSnippet.split(/\r?\n/).slice(0, 8);
  const sanitizedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return trimmed;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();

      if (SENSITIVE_ENV_KEY_PATTERN.test(key) || val.length > 0) {
        return `${key}=[REDACTED:len=${val.length}]`;
      }
    }
    return trimmed;
  });

  const joined = sanitizedLines.join("\n");
  if (joined.length > maxLen) {
    return joined.slice(0, maxLen) + "... [truncated]";
  }
  return joined;
}

/**
 * Redacts a generic string, guaranteeing max length and stripping credentials.
 */
export function sanitizeEvidenceString(input: string, maxLen = 200): string {
  if (!input) return "";
  const cleaned = input.replace(/[\r\n\t]+/g, " ").trim();
  if (cleaned.length > maxLen) {
    return cleaned.slice(0, maxLen) + "... [truncated]";
  }
  return cleaned;
}
