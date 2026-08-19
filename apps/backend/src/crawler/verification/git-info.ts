import { execSync } from "child_process";
import path from "path";

export type VerificationGitState =
  | "LOCAL_VERIFIED_NOT_PUSHED"
  | "REMOTE_VERIFIED"
  | "REMOTE_SHA_MISMATCH"
  | "REMOTE_REPOSITORY_MISMATCH"
  | "DIRTY_WORKTREE"
  | "PROVENANCE_NOT_VERIFIED"
  | "VERIFICATION_INVALIDATED";

export interface RawGitCommandEvidence {
  originUrl: string;
  revParseHeadRaw: string;
  branchRaw: string;
  statusRaw: string;
  lsRemoteRaw: string;
  parsedLocalSha: string;
  parsedRemoteSha: string | null;
  exact40CharacterMatch: boolean;
  repositoryRoot: string;
  isExpectedRepository: boolean;
}

export interface GitProvenance {
  localHeadSha: string;
  gitShaFull: string;
  gitShaShort: string;
  branch: string;
  workingTreeClean: boolean;
  uncommittedChanges: string[];
  repositoryRoot: string;
  originUrl: string;
  remoteBranchSha?: string | null;
  remoteVerified: boolean;
  verificationGitState: VerificationGitState;
  commitTimestamp?: string;
  commitAuthor?: string;
  commitMessage?: string;
  gitEvidence: RawGitCommandEvidence;
}

/**
 * Resolves current Git provenance dynamically from the local repository and remote.
 * Zero hardcoded commit SHAs allowed. Captures literal stdout from raw git commands.
 */
export function getGitProvenance(cwd = process.cwd(), checkRemote = false): GitProvenance {
  try {
    const revParseHeadRaw = execSync("git rev-parse HEAD", { cwd, encoding: "utf8" });
    const gitShaFull = revParseHeadRaw.trim();
    const gitShaShort = gitShaFull.slice(0, 7);

    const branchRaw = execSync("git branch --show-current", { cwd, encoding: "utf8" });
    const branch = branchRaw.trim() || "HEAD";

    const statusRaw = execSync("git status --porcelain", { cwd, encoding: "utf8" });
    const statusTrimmed = statusRaw.trim();
    const uncommittedChanges = statusTrimmed
      ? statusTrimmed.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];

    const repositoryRoot = execSync("git rev-parse --show-toplevel", { cwd, encoding: "utf8" }).trim();

    let originUrl = "unknown";
    try {
      originUrl = execSync("git remote get-url origin", { cwd, encoding: "utf8" }).trim();
    } catch {}

    const isExpectedRepository = originUrl.includes("DesignDreamAshu/seo-geo-analyzer");

    let lsRemoteRaw = "";
    let remoteBranchSha: string | null = null;
    let remoteVerified = false;
    let verificationGitState: VerificationGitState = uncommittedChanges.length > 0
      ? "DIRTY_WORKTREE"
      : "LOCAL_VERIFIED_NOT_PUSHED";

    if (!isExpectedRepository && originUrl !== "unknown") {
      verificationGitState = "REMOTE_REPOSITORY_MISMATCH";
    } else if (checkRemote && branch && branch !== "HEAD") {
      try {
        lsRemoteRaw = execSync(`git ls-remote origin refs/heads/${branch}`, { cwd, encoding: "utf8", timeout: 10000 });
        const lsRemoteTrimmed = lsRemoteRaw.trim();
        if (lsRemoteTrimmed) {
          remoteBranchSha = lsRemoteTrimmed.split(/\s+/)[0]?.trim() || null;
          if (remoteBranchSha && remoteBranchSha.toLowerCase() === gitShaFull.toLowerCase()) {
            remoteVerified = true;
            verificationGitState = uncommittedChanges.length === 0 ? "REMOTE_VERIFIED" : "DIRTY_WORKTREE";
          } else {
            verificationGitState = "REMOTE_SHA_MISMATCH";
          }
        } else {
          verificationGitState = "PROVENANCE_NOT_VERIFIED";
        }
      } catch (err: any) {
        console.warn(`[GitProvenance] Note: Remote check failed (${err.message}). State remains ${verificationGitState}`);
        verificationGitState = "PROVENANCE_NOT_VERIFIED";
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

    const gitEvidence: RawGitCommandEvidence = {
      originUrl,
      revParseHeadRaw: revParseHeadRaw.trimEnd(),
      branchRaw: branchRaw.trimEnd(),
      statusRaw: statusRaw.trimEnd(),
      lsRemoteRaw: lsRemoteRaw.trimEnd(),
      parsedLocalSha: gitShaFull,
      parsedRemoteSha: remoteBranchSha,
      exact40CharacterMatch: Boolean(
        remoteBranchSha && remoteBranchSha.toLowerCase() === gitShaFull.toLowerCase()
      ),
      repositoryRoot,
      isExpectedRepository,
    };

    return {
      localHeadSha: gitShaFull,
      gitShaFull,
      gitShaShort,
      branch,
      workingTreeClean: uncommittedChanges.length === 0,
      uncommittedChanges,
      repositoryRoot,
      originUrl,
      remoteBranchSha,
      remoteVerified,
      verificationGitState,
      commitTimestamp,
      commitAuthor,
      commitMessage,
      gitEvidence,
    };
  } catch (err: any) {
    console.error(`[GitProvenance] Failed to read git metadata: ${err.message}`);
    const emptyEvidence: RawGitCommandEvidence = {
      originUrl: "unknown",
      revParseHeadRaw: "",
      branchRaw: "",
      statusRaw: "",
      lsRemoteRaw: "",
      parsedLocalSha: "unknown",
      parsedRemoteSha: null,
      exact40CharacterMatch: false,
      repositoryRoot: cwd,
      isExpectedRepository: false,
    };

    return {
      localHeadSha: "unknown",
      gitShaFull: "unknown",
      gitShaShort: "unknown",
      branch: "unknown",
      workingTreeClean: false,
      uncommittedChanges: ["git_metadata_resolution_failed"],
      repositoryRoot: cwd,
      originUrl: "unknown",
      remoteBranchSha: null,
      remoteVerified: false,
      verificationGitState: "PROVENANCE_NOT_VERIFIED",
      gitEvidence: emptyEvidence,
    };
  }
}
