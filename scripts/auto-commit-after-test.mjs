#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const skip = process.env.SKYFALL_SKIP_AUTO_COMMIT === "1";
const ci = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

if (skip) {
  log("SKYFALL_SKIP_AUTO_COMMIT=1; skipping auto commit.");
  process.exit(0);
}

if (ci) {
  log("CI environment detected; skipping auto commit.");
  process.exit(0);
}

const repoRoot = git(["rev-parse", "--show-toplevel"], { capture: true, allowFailure: true }).stdout.trim();

if (!repoRoot) {
  log("not inside a git worktree; skipping auto commit.");
  process.exit(0);
}

const branch = git(["symbolic-ref", "--quiet", "--short", "HEAD"], { capture: true, allowFailure: true }).stdout.trim();

if (!branch) {
  log("detached HEAD; skipping auto commit.");
  process.exit(0);
}

if (isGitOperationInProgress(repoRoot)) {
  log("merge/rebase/cherry-pick in progress; skipping auto commit.");
  process.exit(0);
}

const status = git(["status", "--porcelain"], { capture: true }).stdout.trim();

if (!status) {
  log("no changes to commit.");
  process.exit(0);
}

git(["add", "-A"], { stdio: "inherit" });

const hasStagedChanges = git(["diff", "--cached", "--quiet"], { allowFailure: true }).status !== 0;

if (!hasStagedChanges) {
  log("no staged changes after git add.");
  process.exit(0);
}

const message = process.env.SKYFALL_AUTO_COMMIT_MESSAGE || "chore: auto commit after passing tests";
const body = "Created automatically by scripts/auto-commit-after-test.mjs after npm test passed.";

log(`committing passing test changes on ${branch}.`);
git(["commit", "-m", message, "-m", body], {
  env: {
    ...process.env,
    SKYFALL_AUTO_COMMIT: "1",
  },
  stdio: "inherit",
});

function isGitOperationInProgress(repoRoot) {
  const gitDir = git(["rev-parse", "--git-dir"], { capture: true }).stdout.trim();
  const absoluteGitDir = gitDir.startsWith("/") || /^[A-Za-z]:[\\/]/.test(gitDir) ? gitDir : `${repoRoot}/${gitDir}`;
  return ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-apply", "rebase-merge"].some((name) =>
    existsSync(`${absoluteGitDir}/${name}`),
  );
}

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: options.stdio ?? (options.capture ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"]),
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr ? `\n${result.stderr.trim()}` : "";
    throw new Error(`git ${args.join(" ")} failed with exit code ${result.status}${stderr}`);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function log(message) {
  console.error(`[posttest:auto-commit] ${message}`);
}
