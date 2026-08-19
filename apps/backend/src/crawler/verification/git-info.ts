import { execSync } from "child_process";
import path from "path";

export interface GitProvenance {
  gitSha: string;
  shortSha: string;
  branch: string;
  workingTreeClean: boolean;
  uncommittedChanges: string[];
  repositoryRoot: string;
  commitTimestamp?: string;
  commitAuthor?: string;
  commitMessage?: string;
}

/**
 * Resolves current Git provenance dynamically from the local repository.
 * Zero hardcoded commit SHAs allowed.
 */
export function getGitProvenance(cwd = process.cwd()): GitProvenance {
  try {
    const gitSha = execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim();
    const shortSha = gitSha.slice(0, 7);
    const branch = execSync("git branch --show-current", { cwd, encoding: "utf8" }).trim() || "HEAD";
    const statusOutput = execSync("git status --porcelain", { cwd, encoding: "utf8" }).trim();
    const uncommittedChanges = statusOutput
      ? statusOutput.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    const repositoryRoot = execSync("git rev-parse --show-toplevel", { cwd, encoding: "utf8" }).trim();
    
    let commitTimestamp: string | undefined;
    let commitAuthor: string | undefined;
    let commitMessage: string | undefined;

    try {
      commitTimestamp = execSync("git log -1 --format=%cI", { cwd, encoding: "utf8" }).trim();
      commitAuthor = execSync("git log -1 --format=%an", { cwd, encoding: "utf8" }).trim();
      commitMessage = execSync("git log -1 --format=%s", { cwd, encoding: "utf8" }).trim();
    } catch {}

    return {
      gitSha,
      shortSha,
      branch,
      workingTreeClean: uncommittedChanges.length === 0,
      uncommittedChanges,
      repositoryRoot,
      commitTimestamp,
      commitAuthor,
      commitMessage,
    };
  } catch (err: any) {
    console.error(`[GitProvenance] Failed to read git metadata: ${err.message}`);
    return {
      gitSha: "unknown",
      shortSha: "unknown",
      branch: "unknown",
      workingTreeClean: false,
      uncommittedChanges: ["git_metadata_resolution_failed"],
      repositoryRoot: cwd,
    };
  }
}
