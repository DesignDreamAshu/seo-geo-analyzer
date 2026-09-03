/**
 * Server and CDN Platform Adapter for Security Fix Intelligence (SECURITY S4).
 * Provides production-ready configuration snippets for Nginx, Apache, and Cloudflare.
 */

import type { SecurityCodeExample, SecurityPlatformInstruction } from "../remediation-types";

export function getServerCdnInstructions(ruleId: string): SecurityPlatformInstruction[] {
  const instructions: SecurityPlatformInstruction[] = [];

  switch (ruleId) {
    case "SEC_HSTS_MISSING":
    case "SEC_HSTS_SHORT_MAX_AGE":
    case "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING":
    case "SEC_HSTS_PRELOAD_NOT_ENABLED":
      instructions.push({
        platform: "NGINX",
        title: "Nginx HSTS Server Block Configuration",
        isDirectlySupported: true,
        controlLocation: "/etc/nginx/sites-available/your-site.conf (or nginx.conf)",
        steps: [
          "Open your Nginx site configuration file.",
          "Inside the HTTPS `server { listen 443 ssl ... }` block, add the `add_header` directive.",
          "Test the configuration using `nginx -t` and reload using `systemctl reload nginx`."
        ],
        codeExamples: [
          {
            title: "Nginx HSTS Configuration Directive",
            language: "nginx",
            code: `# In server { listen 443 ssl ... }\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`,
            context: "CONFIG"
          }
        ]
      });
      instructions.push({
        platform: "APACHE",
        title: "Apache HSTS VirtualHost / .htaccess Configuration",
        isDirectlySupported: true,
        controlLocation: "/etc/apache2/sites-available/your-site.conf or .htaccess",
        steps: [
          "Ensure `mod_headers` is enabled (`a2enmod headers`).",
          "Inside your VirtualHost block or root `.htaccess`, add the Header always set directive.",
          "Reload Apache with `systemctl reload apache2`."
        ],
        codeExamples: [
          {
            title: "Apache HSTS Directive",
            language: "apache",
            code: `<IfModule mod_headers.c>\n  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"\n</IfModule>`,
            context: "CONFIG"
          }
        ]
      });
      instructions.push({
        platform: "CLOUDFLARE",
        title: "Cloudflare Edge HSTS Settings",
        isDirectlySupported: true,
        controlLocation: "Cloudflare Dashboard > SSL/TLS > Edge Certificates > HSTS",
        steps: [
          "Log in to Cloudflare Dashboard and select your zone.",
          "Go to SSL/TLS > Edge Certificates.",
          "Scroll down to 'HTTP Strict Transport Security (HSTS)' and click 'Enable HSTS'.",
          "Configure Max Age (e.g. 1 Year), Include Subdomains, and Preload after verifying readiness."
        ]
      });
      break;

    case "SEC_X_CONTENT_TYPE_OPTIONS_MISSING":
    case "SEC_REFERRER_POLICY_MISSING":
    case "SEC_FRAME_PROTECTION_MISSING":
    case "SEC_CSP_MISSING":
      instructions.push({
        platform: "NGINX",
        title: "Nginx Comprehensive Security Headers",
        isDirectlySupported: true,
        controlLocation: "/etc/nginx/conf.d/security_headers.conf",
        steps: [
          "Add the standard security response headers to your Nginx HTTPS server block.",
          "Run `nginx -t` and reload `nginx`."
        ],
        codeExamples: [
          {
            title: "Nginx Security Headers Block",
            language: "nginx",
            code: `add_header X-Content-Type-Options "nosniff" always;\nadd_header Referrer-Policy "strict-origin-when-cross-origin" always;\nadd_header X-Frame-Options "DENY" always;\nadd_header Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';" always;`,
            context: "CONFIG"
          }
        ]
      });
      instructions.push({
        platform: "CLOUDFLARE",
        title: "Cloudflare Transform Rules for Security Headers",
        isDirectlySupported: true,
        controlLocation: "Cloudflare Dashboard > Rules > Transform Rules > Modify Response Header",
        steps: [
          "In Cloudflare Dashboard, go to Rules > Transform Rules > Modify Response Header tab.",
          "Click 'Create rule'. Set rule name to 'Global Security Headers'.",
          "Set matching incoming requests to 'All incoming requests'.",
          "Add header modifications for `X-Content-Type-Options`, `Referrer-Policy`, and `Content-Security-Policy`."
        ]
      });
      break;

    case "SEC_ENV_FILE_EXPOSED":
    case "SEC_GIT_HEAD_EXPOSED":
    case "SEC_GIT_CONFIG_EXPOSED":
    case "SEC_DS_STORE_EXPOSED":
      instructions.push({
        platform: "NGINX",
        title: "Nginx Dotfile and Sensitive File Block",
        isDirectlySupported: true,
        controlLocation: "/etc/nginx/sites-available/your-site.conf",
        steps: [
          "Inside your server block, add a location block to deny access to hidden files.",
          "Test with `nginx -t` and reload."
        ],
        codeExamples: [
          {
            title: "Nginx Deny Hidden Files Rule",
            language: "nginx",
            code: `location ~ /\\.(env|git|DS_Store) {\n  deny all;\n  return 404;\n}`,
            context: "CONFIG"
          }
        ]
      });
      instructions.push({
        platform: "APACHE",
        title: "Apache Sensitive File Block (.htaccess)",
        isDirectlySupported: true,
        controlLocation: ".htaccess in document root",
        steps: [
          "Add a FilesMatch directive in `.htaccess` to deny access to `.env`, `.git`, and `.DS_Store`."
        ],
        codeExamples: [
          {
            title: "Apache Block Hidden Files",
            language: "apache",
            code: `<FilesMatch "^\\.(env|git|DS_Store)">\n  Require all denied\n</FilesMatch>`,
            context: "CONFIG"
          }
        ]
      });
      break;

    case "SEC_X_POWERED_BY_DISCLOSURE":
    case "SEC_SERVER_VERSION_DISCLOSURE":
      instructions.push({
        platform: "NGINX",
        title: "Nginx Server Token Suppression",
        isDirectlySupported: true,
        controlLocation: "/etc/nginx/nginx.conf (http block)",
        steps: [
          "In the `http { ... }` block of `nginx.conf`, set `server_tokens off;`.",
          "This suppresses the exact Nginx version number from the `Server` header."
        ],
        codeExamples: [
          {
            title: "Nginx server_tokens Directive",
            language: "nginx",
            code: `http {\n    server_tokens off;\n}`,
            context: "CONFIG"
          }
        ]
      });
      instructions.push({
        platform: "APACHE",
        title: "Apache ServerSignature and ServerTokens Suppression",
        isDirectlySupported: true,
        controlLocation: "/etc/apache2/conf-available/security.conf",
        steps: [
          "Set `ServerTokens Prod` and `ServerSignature Off` in Apache security configuration.",
          "Reload Apache."
        ],
        codeExamples: [
          {
            title: "Apache Security Tokens",
            language: "apache",
            code: `ServerTokens Prod\nServerSignature Off`,
            context: "CONFIG"
          }
        ]
      });
      break;

    default:
      break;
  }

  return instructions;
}
