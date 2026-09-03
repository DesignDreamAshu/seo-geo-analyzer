/**
 * Host TLS & Certificate Inspector (SECURITY S1).
 * Inspects host-level TLS certificate, cipher suite, and validity with in-memory host deduplication caching.
 */

import * as tls from "node:tls";
import type { HostTlsSecurityFacts } from "../types";

const tlsFactsCache = new Map<string, HostTlsSecurityFacts>();

/**
 * Checks if a hostname matches a certificate pattern (supporting standard single-level wildcards).
 */
export function matchHostnameToSan(hostname: string, pattern: string): boolean {
  const cleanHost = hostname.toLowerCase().trim();
  const cleanPattern = pattern.toLowerCase().trim();

  if (cleanHost === cleanPattern) {
    return true;
  }

  if (cleanPattern.startsWith("*.")) {
    const suffix = cleanPattern.slice(2);
    const hostParts = cleanHost.split(".");
    const suffixParts = suffix.split(".");

    if (hostParts.length === suffixParts.length + 1) {
      const hostSuffix = hostParts.slice(1).join(".");
      return hostSuffix === suffix;
    }
  }

  return false;
}

/**
 * Clears the host TLS facts cache (useful for isolated unit testing).
 */
export function clearTlsFactsCache(): void {
  tlsFactsCache.clear();
}

/**
 * Inspects the TLS certificate and negotiated connection details for a host:port.
 * Uses cached results if previously inspected during the current audit run.
 */
export async function inspectHostTls(
  host: string,
  port = 443,
  timeoutMs = 6000
): Promise<HostTlsSecurityFacts> {
  const cacheKey = `${host.toLowerCase().trim()}:${port}`;
  const cached = tlsFactsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const cleanHost = host.trim();
  const inspectionTimestamp = new Date().toISOString();

  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const result: HostTlsSecurityFacts = {
          host: cleanHost,
          port,
          inspectedSuccessfully: false,
          isHttpsAvailable: false,
          inspectionError: `TLS connection timed out after ${timeoutMs}ms`,
          inspectionTimestamp,
          protocolSupport: {
            testedProtocols: [],
            isDeprecatedProtocolProbed: false,
          },
        };
        tlsFactsCache.set(cacheKey, result);
        resolve(result);
      }
    }, timeoutMs);

    try {
      const socket = tls.connect(
        {
          host: cleanHost,
          port,
          servername: cleanHost, // SNI extension
          rejectUnauthorized: false, // capture raw cert facts even if invalid/self-signed
          timeout: timeoutMs,
        },
        () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);

          try {
            const peerCert = socket.getPeerCertificate(true);
            const cipher = socket.getCipher();
            const protocol = socket.getProtocol();
            const authorized = socket.authorized;
            const authError = socket.authorizationError
              ? String(socket.authorizationError)
              : null;

            if (!peerCert || !peerCert.valid_to) {
              const result: HostTlsSecurityFacts = {
                host: cleanHost,
                port,
                inspectedSuccessfully: false,
                isHttpsAvailable: false,
                inspectionError: "Peer certificate unavailable from TLS socket",
                inspectionTimestamp,
                protocolSupport: {
                  testedProtocols: [protocol || "unknown"],
                  isDeprecatedProtocolProbed: false,
                },
              };
              tlsFactsCache.set(cacheKey, result);
              socket.destroy();
              return resolve(result);
            }

            const validFromMs = Date.parse(peerCert.valid_from);
            const validToMs = Date.parse(peerCert.valid_to);
            const nowMs = Date.now();

            const isExpired = !isNaN(validToMs) && nowMs > validToMs;
            const isNotYetValid = !isNaN(validFromMs) && nowMs < validFromMs;
            const daysRemaining = !isNaN(validToMs)
              ? Math.max(0, Math.floor((validToMs - nowMs) / (1000 * 60 * 60 * 24)))
              : 0;
            const isExpiringSoon = !isExpired && daysRemaining <= 30;

            const sanList: string[] = [];
            if (peerCert.subjectaltname) {
              const sans = peerCert.subjectaltname.split(",");
              for (const san of sans) {
                const trimmed = san.trim();
                if (trimmed.startsWith("DNS:")) {
                  sanList.push(trimmed.slice(4).trim());
                } else if (trimmed.startsWith("IP Address:")) {
                  sanList.push(trimmed.slice(11).trim());
                } else {
                  sanList.push(trimmed);
                }
              }
            }

            const commonName = peerCert.subject?.CN || null;
            let isHostnameMatch = false;
            let matchReason = "No matching CN or SAN found";

            if (commonName && matchHostnameToSan(cleanHost, commonName)) {
              isHostnameMatch = true;
              matchReason = `Matched Common Name (CN): ${commonName}`;
            } else {
              for (const san of sanList) {
                if (matchHostnameToSan(cleanHost, san)) {
                  isHostnameMatch = true;
                  matchReason = `Matched Subject Alternative Name (SAN): ${san}`;
                  break;
                }
              }
            }

            const result: HostTlsSecurityFacts = {
              host: cleanHost,
              port,
              inspectedSuccessfully: true,
              isHttpsAvailable: true,
              inspectionTimestamp,
              certificate: {
                subject: {
                  commonName: peerCert.subject?.CN || null,
                  organization: peerCert.subject?.O || null,
                  organizationalUnit: peerCert.subject?.OU || null,
                  country: peerCert.subject?.C || null,
                },
                issuer: {
                  commonName: peerCert.issuer?.CN || null,
                  organization: peerCert.issuer?.O || null,
                  country: peerCert.issuer?.C || null,
                },
                subjectAltNames: sanList,
                validFrom: peerCert.valid_from,
                validTo: peerCert.valid_to,
                validFromTimestamp: validFromMs,
                validToTimestamp: validToMs,
                daysRemaining,
                isExpired,
                isExpiringSoon,
                isNotYetValid,
                fingerprint256: peerCert.fingerprint256 || peerCert.fingerprint || "",
                serialNumber: peerCert.serialNumber || "",
                isHostnameMatch,
                hostnameMatchReason: matchReason,
              },
              connection: {
                authorized,
                authorizationError: authError,
                negotiatedProtocol: protocol,
                negotiatedCipher: cipher
                  ? {
                      name: cipher.name,
                      version: cipher.version,
                    }
                  : null,
                ephemeralKeyInfo: socket.getEphemeralKeyInfo ? ((socket.getEphemeralKeyInfo() as unknown) as Record<string, unknown>) : null,
              },
              protocolSupport: {
                testedProtocols: [protocol || "unknown"],
                isDeprecatedProtocolProbed: false, // Explicitly not tested in standard single handshake
              },
            };

            tlsFactsCache.set(cacheKey, result);
            socket.destroy();
            resolve(result);
          } catch (err) {
            socket.destroy();
            const result: HostTlsSecurityFacts = {
              host: cleanHost,
              port,
              inspectedSuccessfully: false,
              isHttpsAvailable: false,
              inspectionError: `Certificate parsing error: ${(err as Error).message}`,
              inspectionTimestamp,
              protocolSupport: {
                testedProtocols: [],
                isDeprecatedProtocolProbed: false,
              },
            };
            tlsFactsCache.set(cacheKey, result);
            resolve(result);
          }
        }
      );

      socket.on("error", (err) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        socket.destroy();

        const result: HostTlsSecurityFacts = {
          host: cleanHost,
          port,
          inspectedSuccessfully: false,
          isHttpsAvailable: false,
          inspectionError: `Socket error: ${err.message}`,
          inspectionTimestamp,
          protocolSupport: {
            testedProtocols: [],
            isDeprecatedProtocolProbed: false,
          },
        };
        tlsFactsCache.set(cacheKey, result);
        resolve(result);
      });
    } catch (err) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      const result: HostTlsSecurityFacts = {
        host: cleanHost,
        port,
        inspectedSuccessfully: false,
        isHttpsAvailable: false,
        inspectionError: `Initialization error: ${(err as Error).message}`,
        inspectionTimestamp,
        protocolSupport: {
          testedProtocols: [],
          isDeprecatedProtocolProbed: false,
        },
      };
      tlsFactsCache.set(cacheKey, result);
      resolve(result);
    }
  });
}
