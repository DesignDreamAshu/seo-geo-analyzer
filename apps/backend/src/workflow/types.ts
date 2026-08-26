/**
 * Phase 28K: Unified Remediation Workflow & Action Item Data Model.
 * Represents normalized, traceable, and verifiable action items derived from
 * SEO diagnostic findings, AI optimization, AI measurement gaps, and competitive benchmarks.
 */

export type ActionItemSourceType =
  | "SEO_FINDING"
  | "AI_OPTIMIZATION"
  | "AI_MEASUREMENT_GAP"
  | "COMPETITIVE_OPPORTUNITY"
  | "CONTENT_OPPORTUNITY"
  | "TECHNICAL_OPPORTUNITY";

export type ActionItemPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ActionItemStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "READY_TO_VERIFY"
  | "VERIFIED_FIXED"
  | "PARTIALLY_FIXED"
  | "NOT_FIXED"
  | "BLOCKED"
  | "WONT_FIX"
  | "MANUALLY_CONFIRMED"
  | "REOPENED";

export type BlockerReason =
  | "CLIENT_ACCESS_REQUIRED"
  | "DNS_ACCESS_REQUIRED"
  | "CONTENT_REQUIRED"
  | "DEVELOPER_REQUIRED"
  | "THIRD_PARTY_DEPENDENCY"
  | "BUSINESS_DECISION_REQUIRED"
  | "OTHER";

export interface ActionItemNote {
  noteId: string;
  author: string;
  timestamp: string;
  text: string;
}

export interface ActionItemHistoryEntry {
  timestamp: string;
  actor: string;
  action: string;
  fromStatus?: ActionItemStatus;
  toStatus?: ActionItemStatus;
  details?: string;
}

export interface ActionOccurrenceItem {
  occurrenceId: string;
  url: string;
  location?: string;
  snippet?: string;
  selector?: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedEvidence?: string;
}

export interface ActionItem {
  actionItemId: string;
  projectId: string;
  sourceType: ActionItemSourceType;
  sourceId: string; // e.g. ruleId ("CONTENT_SKIPPED_HEADINGS") or promptClusterId or opportunityId
  title: string;
  summary: string;
  
  // Priority
  systemPriority: ActionItemPriority;
  userPriority: ActionItemPriority | null;
  effectivePriority: ActionItemPriority;
  priorityReason: string;
  
  // Status & Verification
  status: ActionItemStatus;
  userSetStatus: ActionItemStatus | null;
  systemVerifiedStatus: ActionItemStatus | null;
  lastVerifiedAt: string | null;
  verificationMethod: string;
  
  // Grouping & Categorization
  category: string;
  clientSafeLabel: string;
  groupingKey?: string; // CMS template, site-wide component, or page cluster
  
  // Scope & Evidence
  affectedUrls: string[];
  affectedPrompts: string[];
  totalOccurrences: number;
  resolvedOccurrences: number;
  remainingOccurrences: number;
  occurrences: ActionOccurrenceItem[];
  
  // Remediation Instructions
  whatIsWrong: string;
  whyItMatters: string;
  whereItOccurs: string;
  whatToChange: string;
  howToChange: string;
  howToVerify: string;
  recommendation: string;
  platformGuidance?: string;
  
  // Operational Management
  assigneeName: string | null;
  dueDate: string | null;
  blockerReason: BlockerReason | null;
  blockerDetail: string | null;
  notes: ActionItemNote[];
  history: ActionItemHistoryEntry[];
  
  // Provenance & Immutability
  sourceSnapshotRef: {
    auditRunId?: string;
    snapshotId?: string;
    engineVersion?: string;
  };
  lastVerificationEvidence: any | null;
  
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowQueueSummary {
  projectId: string;
  totalActionItems: number;
  openCount: number;
  inProgressCount: number;
  readyToVerifyCount: number;
  verifiedFixedCount: number;
  partiallyFixedCount: number;
  blockedCount: number;
  wontFixCount: number;
  criticalHighOpenCount: number;
  
  totalOriginalOccurrences: number;
  resolvedOriginalOccurrences: number;
  remainingOccurrences: number;
  
  lastUpdated: string;
}

export interface WorkflowFilterOptions {
  status?: ActionItemStatus | "ALL_OPEN";
  priority?: ActionItemPriority;
  category?: string;
  sourceType?: ActionItemSourceType;
  assignee?: string;
  searchQuery?: string;
  url?: string;
  isBlocked?: boolean;
}
