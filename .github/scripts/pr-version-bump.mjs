#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PACKAGE_JSON_PATH = "package.json";

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
      continue;
    }
    parsed.set(key, next);
    index += 1;
  }
  return parsed;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "inherit"],
  }).trim();
}

function readPackageFromWorktree() {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
}

function readPackageFromRef(ref) {
  const raw = run("git", ["show", `${ref}:${PACKAGE_JSON_PATH}`], { stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(raw);
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(version));
  if (!match) {
    throw new Error(`Cannot bump non-semver package version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function nextPatchVersion(version) {
  const parsed = parseSemver(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function writePackageVersion(version) {
  const pkg = readPackageFromWorktree();
  pkg.version = version;
  writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
}

function refreshPnpmLockfile(dryRun) {
  if (dryRun) return;
  run("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], { stdio: "inherit" });
}

function versionAt(ref) {
  return readPackageFromRef(ref).version;
}

function worktreeVersion() {
  return readPackageFromWorktree().version;
}

function bumpApprovedMainPr(baseRef, dryRun) {
  const baseVersion = versionAt(baseRef);
  const expectedVersion = nextPatchVersion(baseVersion);
  const currentVersion = worktreeVersion();

  if (currentVersion === expectedVersion) {
    console.log(`package.json already has expected main release candidate version ${expectedVersion}.`);
    return false;
  }

  console.log(`Preparing main PR release candidate: ${currentVersion} -> ${expectedVersion} (base ${baseRef} is ${baseVersion}).`);
  if (!dryRun) writePackageVersion(expectedVersion);
  refreshPnpmLockfile(dryRun);
  return true;
}

function bumpMainPush(previousRef, dryRun) {
  const previousVersion = versionAt(previousRef);
  const currentVersion = worktreeVersion();

  if (previousVersion !== currentVersion) {
    console.log(`package.json version already changed in pushed commits: ${previousVersion} -> ${currentVersion}.`);
    return false;
  }

  const nextVersion = nextPatchVersion(currentVersion);
  console.log(`Main push did not include a version bump; applying safety-net bump ${currentVersion} -> ${nextVersion}.`);
  if (!dryRun) writePackageVersion(nextVersion);
  refreshPnpmLockfile(dryRun);
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.get("mode");
  const dryRun = args.has("dry-run");

  if (mode === "approved-main-pr") {
    const baseRef = args.get("base-ref") ?? "origin/main";
    bumpApprovedMainPr(baseRef, dryRun);
    return;
  }

  if (mode === "main-push") {
    const previousRef = args.get("previous-ref") ?? "HEAD^";
    bumpMainPush(previousRef, dryRun);
    return;
  }

  console.error([
    "Usage:",
    "  node .github/scripts/pr-version-bump.mjs --mode approved-main-pr --base-ref origin/main [--dry-run]",
    "  node .github/scripts/pr-version-bump.mjs --mode main-push --previous-ref HEAD^ [--dry-run]",
  ].join("\n"));
  process.exit(1);
}

main();
