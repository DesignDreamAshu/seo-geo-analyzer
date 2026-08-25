/**
 * Phase 28C: Knowledge Profile Governance & User Override Engine.
 * Manages user confirmations, rejections, manual additions, and conflict resolution across recalculations.
 */

import {
  ProjectKnowledgeProfile,
  KnowledgeItemStatus,
  OfferingItem,
  TopicItem,
  IndustryServed,
  CompetitorCandidate,
} from "./types";

export interface UserOverrideState {
  confirmedItemIds: Set<string>;
  rejectedItemIds: Set<string>;
  manualOfferings: OfferingItem[];
  manualTopics: TopicItem[];
  manualIndustries: IndustryServed[];
  manualCompetitors: CompetitorCandidate[];
  itemEdits: Map<string, Record<string, any>>;
}

export class KnowledgeGovernanceManager {
  private overrides = new Map<string, UserOverrideState>();

  private getProjectState(projectId: string): UserOverrideState {
    if (!this.overrides.has(projectId)) {
      this.overrides.set(projectId, {
        confirmedItemIds: new Set(),
        rejectedItemIds: new Set(),
        manualOfferings: [],
        manualTopics: [],
        manualIndustries: [],
        manualCompetitors: [],
        itemEdits: new Map(),
      });
    }
    return this.overrides.get(projectId)!;
  }

  public confirmItem(projectId: string, itemId: string): void {
    const state = this.getProjectState(projectId);
    state.confirmedItemIds.add(itemId);
    state.rejectedItemIds.delete(itemId);
  }

  public rejectItem(projectId: string, itemId: string): void {
    const state = this.getProjectState(projectId);
    state.rejectedItemIds.add(itemId);
    state.confirmedItemIds.delete(itemId);
  }

  public editItem(projectId: string, itemId: string, updates: Record<string, any>): void {
    const state = this.getProjectState(projectId);
    state.itemEdits.set(itemId, { ...(state.itemEdits.get(itemId) || {}), ...updates });
  }

  public addManualOffering(projectId: string, offering: OfferingItem): void {
    const state = this.getProjectState(projectId);
    offering.status = "CONFIRMED";
    offering.userOverride = true;
    state.manualOfferings.push(offering);
  }

  /**
   * Merges user overrides cleanly on top of a newly extracted knowledge profile.
   */
  public applyOverrides(profile: ProjectKnowledgeProfile): ProjectKnowledgeProfile {
    const state = this.getProjectState(profile.projectId);

    // Apply status and edits to offerings
    profile.offerings = profile.offerings
      .filter((o) => !state.rejectedItemIds.has(o.id))
      .map((o) => {
        if (state.confirmedItemIds.has(o.id)) o.status = "CONFIRMED";
        const edits = state.itemEdits.get(o.id);
        if (edits) Object.assign(o, edits);
        return o;
      });

    // Add manual offerings
    for (const mo of state.manualOfferings) {
      if (!profile.offerings.some((o) => o.id === mo.id)) {
        profile.offerings.push(mo);
      }
    }

    // Apply to topics
    profile.topics = profile.topics
      .filter((t) => !state.rejectedItemIds.has(t.id))
      .map((t) => {
        if (state.confirmedItemIds.has(t.id)) t.status = "CONFIRMED";
        const edits = state.itemEdits.get(t.id);
        if (edits) Object.assign(t, edits);
        return t;
      });

    // Apply to industries
    profile.industries = profile.industries
      .filter((i) => !state.rejectedItemIds.has(i.id))
      .map((i) => {
        if (state.confirmedItemIds.has(i.id)) i.status = "CONFIRMED";
        return i;
      });

    // Apply to competitors
    profile.competitors = profile.competitors
      .filter((c) => !state.rejectedItemIds.has(c.id))
      .map((c) => {
        if (state.confirmedItemIds.has(c.id)) c.status = "CONFIRMED";
        return c;
      });

    return profile;
  }
}

export const globalKnowledgeGovernance = new KnowledgeGovernanceManager();
