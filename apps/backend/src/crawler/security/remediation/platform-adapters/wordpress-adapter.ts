/**
 * WordPress Platform Adapter for Security Fix Intelligence (SECURITY S4).
 * Provides actionable WordPress remediation paths (plugins, functions.php, .htaccess, wp-config.php).
 */

import type { SecurityPlatformInstruction } from "../remediation-types";

export function getWordPressInstruction(ruleId: string): SecurityPlatformInstruction | null {
  switch (ruleId) {
    case "SEC_HSTS_MISSING":
    case "SEC_HSTS_SHORT_MAX_AGE":
    case "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING":
    case "SEC_HSTS_PRELOAD_NOT_ENABLED":
      return {
        platform: "WORDPRESS",
        title: "WordPress HSTS Implementation",
        isDirectlySupported: true,
        controlLocation: ".htaccess (Apache) / Nginx config / Security Plugin",
        steps: [
          "Recommended: Add the HSTS header at the web server layer (.htaccess for Apache/LiteSpeed or server block for Nginx).",
          "Alternative: Use a trusted security plugin (e.g. Really Simple SSL or Wordfence) and enable HSTS in the SSL/Headers settings.",
          "Alternative in theme code: Add `header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');` in your child theme's `functions.php` hooked to `send_headers`."
        ],
        codeExamples: [
          {
            title: "WordPress .htaccess HSTS Rule",
            language: "apache",
            code: `<IfModule mod_headers.c>\n  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"\n</IfModule>`,
            context: "CONFIG"
          },
          {
            title: "WordPress functions.php send_headers Hook",
            language: "php",
            code: `add_action('send_headers', function() {\n    if (is_ssl()) {\n        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');\n    }\n});`,
            context: "RECOMMENDED"
          }
        ],
        caveats: [
          "Server/CDN headers are strongly preferred over PHP runtime headers for caching performance and reliability."
        ]
      };

    case "SEC_CSP_MISSING":
    case "SEC_CSP_UNSAFE_INLINE":
    case "SEC_CSP_UNSAFE_EVAL":
    case "SEC_CSP_BROAD_WILDCARD_SOURCE":
    case "SEC_CSP_OBJECT_SRC_UNRESTRICTED":
    case "SEC_CSP_BASE_URI_MISSING":
      return {
        platform: "WORDPRESS",
        title: "WordPress Content-Security-Policy Implementation",
        isDirectlySupported: true,
        controlLocation: "functions.php / .htaccess / Security Headers Plugin",
        steps: [
          "Due to WordPress plugins and admin scripts, test your CSP policy using `Content-Security-Policy-Report-Only` first.",
          "Add the CSP header via your child theme's `functions.php` or a dedicated security headers manager.",
          "Ensure you include WordPress core asset origins (`'self'`, Google Fonts, Gravatar, and active plugin CDNs)."
        ],
        codeExamples: [
          {
            title: "WordPress functions.php CSP Header",
            language: "php",
            code: `add_action('send_headers', function() {\n    header("Content-Security-Policy: default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; object-src 'none'; base-uri 'self';");\n});`,
            context: "RECOMMENDED"
          }
        ],
        caveats: [
          "WordPress admin (wp-admin) and page builders (Elementor, Divi) rely heavily on inline scripts and styles; do not remove 'unsafe-inline' without thorough staging testing."
        ]
      };

    case "SEC_COOKIE_SECURE_MISSING":
    case "SEC_COOKIE_HTTPONLY_MISSING":
    case "SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE":
      return {
        platform: "WORDPRESS",
        title: "WordPress Cookie Security Flags",
        isDirectlySupported: true,
        controlLocation: "wp-config.php / functions.php",
        steps: [
          "In `wp-config.php`, ensure `FORCE_SSL_ADMIN` is enabled: `define('FORCE_SSL_ADMIN', true);`.",
          "Ensure your site URL in Settings > General is configured with `https://`.",
          "For custom session cookies or plugin cookies, set `$args['secure'] = true;` and `$args['httponly'] = true;` in `setcookie()` calls."
        ],
        codeExamples: [
          {
            title: "WordPress wp-config.php SSL Enforcement",
            language: "php",
            code: `define('FORCE_SSL_ADMIN', true);\ndefine('COOKIE_SSL', true);`,
            context: "CONFIG"
          }
        ]
      };

    case "SEC_X_POWERED_BY_DISCLOSURE":
    case "SEC_SERVER_VERSION_DISCLOSURE":
      return {
        platform: "WORDPRESS",
        title: "WordPress Technology & Version Disclosure Suppression",
        isDirectlySupported: true,
        controlLocation: "wp-config.php / functions.php / php.ini",
        steps: [
          "In `php.ini`, set `expose_php = Off` to remove `X-Powered-By: PHP/x.x`.",
          "In your child theme's `functions.php`, remove the WordPress generator meta tag: `remove_action('wp_head', 'wp_generator');`."
        ],
        codeExamples: [
          {
            title: "WordPress Generator Removal Hook",
            language: "php",
            code: `remove_action('wp_head', 'wp_generator');\nadd_filter('the_generator', '__return_null');`,
            context: "RECOMMENDED"
          }
        ]
      };

    case "SEC_ENV_FILE_EXPOSED":
    case "SEC_GIT_HEAD_EXPOSED":
    case "SEC_GIT_CONFIG_EXPOSED":
    case "SEC_DS_STORE_EXPOSED":
      return {
        platform: "WORDPRESS",
        title: "WordPress Sensitive File Protection",
        isDirectlySupported: true,
        controlLocation: ".htaccess / Nginx configuration",
        steps: [
          "Add block rules to your root `.htaccess` file to prevent direct HTTP access to dotfiles and configuration files.",
          "Delete any leftover `.env`, `.git`, or backup files (`.sql`, `.zip`) from your `public_html` directory."
        ],
        codeExamples: [
          {
            title: "WordPress .htaccess Dotfile Block Rule",
            language: "apache",
            code: `<FilesMatch "^\\.(env|git|DS_Store|user\\.ini)">\n  Require all denied\n</FilesMatch>`,
            context: "CONFIG"
          }
        ]
      };

    default:
      return null;
  }
}
