/**
 * Next.js Platform Adapter for Security Fix Intelligence (SECURITY S4).
 * Provides clean, modern Next.js implementations (next.config.js, middleware, Vercel).
 */

import type { SecurityPlatformInstruction } from "../remediation-types";

export function getNextJsInstruction(ruleId: string): SecurityPlatformInstruction | null {
  switch (ruleId) {
    case "SEC_HSTS_MISSING":
    case "SEC_HSTS_SHORT_MAX_AGE":
    case "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING":
    case "SEC_HSTS_PRELOAD_NOT_ENABLED":
    case "SEC_X_CONTENT_TYPE_OPTIONS_MISSING":
    case "SEC_REFERRER_POLICY_MISSING":
    case "SEC_FRAME_PROTECTION_MISSING":
    case "SEC_CSP_MISSING":
      return {
        platform: "NEXT_JS",
        title: "Next.js Security Response Headers via next.config.js",
        isDirectlySupported: true,
        controlLocation: "next.config.js (or next.config.mjs)",
        steps: [
          "Open `next.config.js` in your project root.",
          "Add or expand the `async headers()` configuration function.",
          "Define the desired security headers for all routes (`/:path*`).",
          "Rebuild and deploy your Next.js application."
        ],
        codeExamples: [
          {
            title: "Next.js Comprehensive Security Headers Configuration",
            language: "javascript",
            code: `// next.config.js\nmodule.exports = {\n  async headers() {\n    return [\n      {\n        source: '/:path*',\n        headers: [\n          {\n            key: 'Strict-Transport-Security',\n            value: 'max-age=31536000; includeSubDomains; preload',\n          },\n          {\n            key: 'X-Content-Type-Options',\n            value: 'nosniff',\n          },\n          {\n            key: 'Referrer-Policy',\n            value: 'strict-origin-when-cross-origin',\n          },\n          {\n            key: 'X-Frame-Options',\n            value: 'DENY',\n          },\n          {\n            key: 'Content-Security-Policy',\n            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"\n          },\n        ],\n      },\n    ];\n  },\n};`,
            context: "RECOMMENDED"
          }
        ],
        caveats: [
          "Next.js Fast Refresh and dev server may require 'unsafe-eval' in development, but production builds should minimize unsafe directives."
        ]
      };

    case "SEC_X_POWERED_BY_DISCLOSURE":
      return {
        platform: "NEXT_JS",
        title: "Next.js X-Powered-By Header Suppression",
        isDirectlySupported: true,
        controlLocation: "next.config.js",
        steps: [
          "In `next.config.js`, set `poweredByHeader: false` in your configuration object.",
          "This automatically suppresses the `x-powered-by: Next.js` header on all server-rendered responses."
        ],
        codeExamples: [
          {
            title: "Disable Next.js PoweredBy Header",
            language: "javascript",
            code: `// next.config.js\nmodule.exports = {\n  poweredByHeader: false,\n};`,
            context: "RECOMMENDED"
          }
        ]
      };

    case "SEC_ENV_FILE_EXPOSED":
      return {
        platform: "NEXT_JS",
        title: "Next.js Environment Variable Protection",
        isDirectlySupported: true,
        controlLocation: ".gitignore / Public Assets Directory",
        steps: [
          "Ensure `.env`, `.env.local`, `.env.production` are listed in `.gitignore`.",
          "Verify that `.env` files were not accidentally placed inside the `public/` directory (anything in `public/` is served statically).",
          "Never prefix private secrets with `NEXT_PUBLIC_` (which bundles them into client-side JS)."
        ],
        caveats: [
          "If secrets were committed to Git, immediately rotate API keys, database credentials, and session secrets."
        ]
      };

    case "SEC_COOKIE_SECURE_MISSING":
    case "SEC_COOKIE_HTTPONLY_MISSING":
    case "SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE":
      return {
        platform: "NEXT_JS",
        title: "Next.js Route Handler / Middleware Cookie Security",
        isDirectlySupported: true,
        controlLocation: "app/api/... or middleware.ts (cookies.set)",
        steps: [
          "When setting cookies using `next/headers` `cookies().set()` or `NextResponse.cookies.set()`, explicitly pass security options:",
          "`httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`."
        ],
        codeExamples: [
          {
            title: "Next.js Secure Cookie Helper",
            language: "typescript",
            code: `import { cookies } from 'next/headers';\n\nexport async function setAuthSession(token: string) {\n  const cookieStore = await cookies();\n  cookieStore.set('session_id', token, {\n    httpOnly: true,\n    secure: process.env.NODE_ENV === 'production',\n    sameSite: 'lax',\n    path: '/',\n    maxAge: 60 * 60 * 24 * 7, // 7 days\n  });\n}`,
            context: "RECOMMENDED"
          }
        ]
      };

    default:
      return null;
  }
}
