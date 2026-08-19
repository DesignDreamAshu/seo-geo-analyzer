import { execSync } from "child_process";
import path from "path";

export type VerificationGitState =
  | "LOCAL_VERIFIED_NOT_PUSHED"
  | "REMOTE_VERIFIED"
  | "REMOTE_SHA_MISMATCH"
  | "DIRTY_WORKTREE"
  | "VERIFICATION_INVALIDATED";

export interface GitProvenance {
  localHeadSha: string;
  gitShaFull: string;
  gitShaShort: string;
  branch: string;
  workingTreeClean: boolean;
  uncommittedChanges: string[];
  repositoryRoot: string;
  remoteBranchSha?: string | null;
  remoteVerified: boolean;
  verificationGitState: VerificationGitState;
  commitTimestamp?: string;
  commitAuthor?: string;
  commitMessage?: string;
}

/**
 * Resolves current Git provenance dynamically from the local repository and optional remote.
 * Zero hardcoded commit SHAs allowed. Full 40-character SHA is authoritative.
 */
export function getGitProvenance(cwd = process.cwd(), checkRemote = false): GitProvenance {
  try {
    const gitShaFull = execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim();
    const gitShaShort = gitShaFull.slice(0, 7);
    const branch = execSync("git branch --show-current", { cwd, encoding: "utf8" }).trim() || "HEAD";
    const statusOutput = execSync("git status --porcelain", { cwd, encoding: "utf8" }).trim();
    const uncommittedChanges = statusOutput
      ? statusOutput.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    const repositoryRoot = execSync("git rev-parse --show-toplevel", { cwd, encoding: "utf8" }).trim();

    let remoteBranchSha: string | null = null;
    let remoteVerified = false;
    let verificationGitState: VerificationGitState = uncommittedChanges.length > 0
      ? "DIRTY_WORKTREE"
      : "LOCAL_VERIFIED_NOT_PUSHED";

    if (checkRemote && branch && branch !== "HEAD") {
      try {
        const lsRemote = execSync(`git ls-remote origin refs/heads/${branch}`, { cwd, encoding: "utf8", timeout: 10000 }).trim();
        if (lsRemote) {
          remoteBranchSha = lsRemote.split(/\s+/)[0]?.trim() || null;
          if (remoteBranchSha && remoteBranchSha.toLowerCase() === gitShaFull.toLowerCase()) {
            remoteVerified = true;
            verificationGitState = uncommittedChanges.length === 0 ? "REMOTE_VERIFIED" : "DIRTY_WORKTREE";
          } else {
            verificationGitState = "REMOTE_SHA_MISMATCH";
          }
        }
      } catch (err: any) {
        console.warn(`[GitProvenance] Note: Remote check failed (${err.message}). State remains ${verificationGitState}`);
      }
    }

    let commitTimestamp: string | undefined;
    let commitAuthor: string | undefined;
    let commitMessage: string | undefined;

    try {
      commitTimestamp = execSync("git log -1 --format=%cI", { cwd, encoding: "utf8" }).trim();
      commitAuthor = execSync("git log -1 --format=%an", { cwd, encoding: "utf8" }).trim();
      commitMessage = execSync("git log -1 --format=%s", { cwd, encoding: "utf8" }).trim();
    } catch {}

    return {
      localHeadSha: gitShaFull,
      gitShaFull,
      gitShaShort,
      branch,
      workingTreeClean: uncommittedChanges.length === 0,
      uncommittedChanges,
      repositoryRoot,
      remoteBranchSha,
      remoteVerified,
      verificationGitState,
      commitTimestamp,
      commitAuthor,
      commitMessage,
    };
  } catch (err: any) {
    console.error(`[GitProvenance] Failed to read git metadata: ${err.message}`);
    return {
      localHeadSha: "unknown",
      gitShaFull: "unknown",
      gitShaShort: "unknown",
      branch: "unknown",
      workingTreeClean: false,
      uncommittedChanges: ["git_metadata_resolution_failed"],
      repositoryRoot: cwd,
      remoteBranchSha: null,
      remoteVerified: false,
      verificationGitState: "VERIFICATION_INVALIDATED",
    };
  }
}
