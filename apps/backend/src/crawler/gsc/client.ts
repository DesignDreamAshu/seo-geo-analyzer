/**
 * Google Search Console Provider Client & Abstraction
 * Handles OAuth2 tokens securely, executes Search Analytics queries, and handles rate-limits/errors gracefully.
 */

import { GscAuthMode, GscConnectionState, GscPropertyType, GscSearchAnalyticsRow, GscTelemetry } from "./types";
import { GscCache } from "./cache";

export interface GscOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  redirectUri?: string;
}

export interface GscClientOptions {
  accessToken?: string;
  oauthConfig?: GscOAuthConfig;
  cache?: GscCache;
  expectedProjectHost?: string;
}

export interface GscQueryParams {
  propertyUri: string;
  startDate: string;
  endDate: string;
  dimensions: Array<"page" | "query" | "country" | "device" | "date">;
  rowLimit?: number;
}

export interface GscQueryResult {
  status: GscConnectionState;
  authMode: GscAuthMode;
  rows: GscSearchAnalyticsRow[];
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  errorMessage?: string;
  freshnessTimestamp: string;
}

export interface GscDataProvider {
  querySearchAnalytics(params: GscQueryParams): Promise<GscQueryResult>;
  listProperties(): Promise<Array<{ siteUrl: string; permissionLevel: string }>>;
  getAuthMode(): GscAuthMode;
}

export class GoogleSearchConsoleClient implements GscDataProvider {
  private accessToken?: string;
  private oauthConfig?: GscOAuthConfig;
  private cache: GscCache;
  private expectedProjectHost?: string;

  constructor(options?: GscClientOptions) {
    this.accessToken = options?.accessToken || process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN;
    this.oauthConfig = options?.oauthConfig;
    this.cache = options?.cache || new GscCache();
    this.expectedProjectHost = options?.expectedProjectHost;
  }

  getAuthMode(): GscAuthMode {
    if (this.oauthConfig && this.oauthConfig.clientId && this.oauthConfig.refreshToken) {
      return "OAUTH_CONFIGURED";
    }
    if (this.accessToken) {
      return "DEV_TOKEN_MODE";
    }
    return "NOT_CONFIGURED";
  }

  /**
   * Refreshes OAuth2 access token if refreshToken and client credentials are configured.
   */
  async refreshAccessToken(): Promise<string | undefined> {
    if (!this.oauthConfig?.refreshToken || !this.oauthConfig?.clientId || !this.oauthConfig?.clientSecret) {
      return undefined;
    }

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.oauthConfig.clientId,
          client_secret: this.oauthConfig.clientSecret,
          refresh_token: this.oauthConfig.refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        return undefined;
      }

      const data = await response.json();
      if (data.access_token) {
        this.accessToken = data.access_token;
        return data.access_token;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  async listProperties(): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
    if (!this.accessToken && !(await this.refreshAccessToken())) {
      return [];
    }

    try {
      const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.siteEntry || []).map((s: any) => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
      }));
    } catch {
      return [];
    }
  }

  async querySearchAnalytics(params: GscQueryParams): Promise<GscQueryResult> {
    const { propertyUri, startDate, endDate, dimensions, rowLimit = 5000 } = params;
    const authMode = this.getAuthMode();

    // 0. Validate Property Match against Project Host if configured
    if (this.expectedProjectHost) {
      const cleanExpected = this.expectedProjectHost.toLowerCase().replace(/^www\./, "");
      const cleanProp = propertyUri
        .replace(/^sc-domain:/, "")
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .toLowerCase()
        .replace(/^www\./, "");

      if (cleanProp && cleanExpected && cleanProp !== cleanExpected && !cleanProp.endsWith(`.${cleanExpected}`)) {
        return {
          status: "PROPERTY_MISMATCH",
          authMode,
          rows: [],
          totalClicks: 0,
          totalImpressions: 0,
          averageCtr: 0,
          averagePosition: 0,
          errorMessage: `Selected GSC property '${propertyUri}' does not match project host '${this.expectedProjectHost}'.`,
          freshnessTimestamp: new Date().toISOString(),
        };
      }
    }

    // 1. Check cache
    const cached = this.cache.get<GscQueryResult>(propertyUri, startDate, endDate, dimensions);
    if (cached) {
      return cached;
    }

    if (!this.accessToken && !(await this.refreshAccessToken())) {
      return {
        status: "NOT_CONNECTED",
        authMode,
        rows: [],
        totalClicks: 0,
        totalImpressions: 0,
        averageCtr: 0,
        averagePosition: 0,
        errorMessage: "No GSC credentials configured. Running in offline/disconnected mode.",
        freshnessTimestamp: new Date().toISOString(),
      };
    }

    try {
      const encodedSite = encodeURIComponent(propertyUri);
      const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

      const body = {
        startDate,
        endDate,
        dimensions,
        rowLimit,
      };

      let response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      // Handle token expiration & automatic refresh
      if (response.status === 401 && (await this.refreshAccessToken())) {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });
      }

      if (response.status === 401) {
        return {
          status: "AUTH_EXPIRED",
          authMode,
          rows: [],
          totalClicks: 0,
          totalImpressions: 0,
          averageCtr: 0,
          averagePosition: 0,
          errorMessage: "GSC authentication token expired or revoked (HTTP 401).",
          freshnessTimestamp: new Date().toISOString(),
        };
      }

      if (response.status === 403) {
        return {
          status: "INSUFFICIENT_PERMISSION",
          authMode,
          rows: [],
          totalClicks: 0,
          totalImpressions: 0,
          averageCtr: 0,
          averagePosition: 0,
          errorMessage: "Insufficient permissions for requested Search Console property (HTTP 403).",
          freshnessTimestamp: new Date().toISOString(),
        };
      }

      if (response.status === 429) {
        return {
          status: "API_ERROR",
          authMode,
          rows: [],
          totalClicks: 0,
          totalImpressions: 0,
          averageCtr: 0,
          averagePosition: 0,
          errorMessage: "GSC API rate limit / quota exceeded (HTTP 429).",
          freshnessTimestamp: new Date().toISOString(),
        };
      }

      if (!response.ok) {
        const errText = await response.text();
        return {
          status: "API_ERROR",
          authMode,
          rows: [],
          totalClicks: 0,
          totalImpressions: 0,
          averageCtr: 0,
          averagePosition: 0,
          errorMessage: `GSC API request failed (HTTP ${response.status}): ${errText.slice(0, 200)}`,
          freshnessTimestamp: new Date().toISOString(),
        };
      }

      const json = await response.json();
      const rawRows: any[] = json.rows || [];

      let totalClicks = 0;
      let totalImpressions = 0;
      let totalPositionWeighted = 0;

      const rows: GscSearchAnalyticsRow[] = rawRows.map((r) => {
        const clicks = r.clicks || 0;
        const impressions = r.impressions || 0;
        const ctr = r.ctr || (impressions > 0 ? clicks / impressions : 0);
        const position = r.position || 0;

        totalClicks += clicks;
        totalImpressions += impressions;
        totalPositionWeighted += position * impressions;

        const rowObj: GscSearchAnalyticsRow = {
          clicks,
          impressions,
          ctr,
          position,
        };

        if (dimensions.includes("page") && r.keys) {
          const pageIdx = dimensions.indexOf("page");
          rowObj.page = r.keys[pageIdx];
        }
        if (dimensions.includes("query") && r.keys) {
          const queryIdx = dimensions.indexOf("query");
          rowObj.query = r.keys[queryIdx];
        }
        if (dimensions.includes("device") && r.keys) {
          const devIdx = dimensions.indexOf("device");
          rowObj.device = r.keys[devIdx]?.toUpperCase();
        }
        if (dimensions.includes("date") && r.keys) {
          const dateIdx = dimensions.indexOf("date");
          rowObj.date = r.keys[dateIdx];
        }

        return rowObj;
      });

      const averageCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
      const averagePosition = totalImpressions > 0 ? totalPositionWeighted / totalImpressions : 0;

      const result: GscQueryResult = {
        status: "CONNECTED",
        authMode,
        rows,
        totalClicks,
        totalImpressions,
        averageCtr: Math.round(averageCtr * 10000) / 10000,
        averagePosition: Math.round(averagePosition * 10) / 10,
        freshnessTimestamp: new Date().toISOString(),
      };

      // Cache successful response
      this.cache.set(propertyUri, startDate, endDate, dimensions, result);
      return result;
    } catch (err: any) {
      return {
        status: "API_ERROR",
        authMode,
        rows: [],
        totalClicks: 0,
        totalImpressions: 0,
        averageCtr: 0,
        averagePosition: 0,
        errorMessage: `Network error querying GSC API: ${err.message}`,
        freshnessTimestamp: new Date().toISOString(),
      };
    }
  }
}
