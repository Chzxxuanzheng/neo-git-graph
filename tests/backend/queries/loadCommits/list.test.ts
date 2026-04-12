import * as fs from "node:fs";
import * as path from "node:path";

import simpleGit from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadCommits } from "@/backend/queries/loadCommits";

import { git, makeRepo } from "@tests/backend/helpers";

const SHOW_ALL = "";

let repo: string;
let repoWithRemote: string;
let remoteRepo: string;

beforeAll(() => {
  repo = makeRepo();
  fs.writeFileSync(path.join(repo, "f2"), "y");
  git(["add", "."], repo);
  git(["commit", "-m", "second"], repo);

  remoteRepo = makeRepo();
  repoWithRemote = makeRepo();
  git(["remote", "add", "origin", remoteRepo], repoWithRemote);
  git(["fetch", "origin"], repoWithRemote);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(repoWithRemote, { recursive: true, force: true });
  fs.rmSync(remoteRepo, { recursive: true, force: true });
});

describe("loadCommits", () => {
  it("returns commits with expected fields", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchNames: [SHOW_ALL],
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result).toEqual({
      commits: expect.any(Array),
      head: expect.any(String),
      moreCommitsAvailable: false,
      hard: false
    });
    expect(result.commits.length).toBeGreaterThan(0);
    expect(result.commits[0]).toEqual({
      hash: expect.any(String),
      parentHashes: expect.any(Array),
      author: expect.any(String),
      email: expect.any(String),
      date: expect.any(Number),
      message: expect.any(String),
      refs: expect.any(Array)
    });
  });

  it("attaches HEAD ref to the current commit and sets head correctly", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchNames: [SHOW_ALL],
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result.head).not.toBeNull();
    const headCommit = result.commits.find((c) => c.hash === result.head);
    expect(headCommit).toBeDefined();
    expect(headCommit!.refs.some((r) => r.type === "head")).toBe(true);
  });

  it("limits to maxCommits and sets moreCommitsAvailable: true", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchNames: [SHOW_ALL],
      maxCommits: 1,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result).toEqual({
      commits: expect.any(Array),
      head: expect.any(String),
      moreCommitsAvailable: true,
      hard: false
    });
    expect(result.commits.length).toBe(1);
  });

  it("moreCommitsAvailable is false when all commits fit", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchNames: [SHOW_ALL],
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result).toEqual({
      commits: expect.any(Array),
      head: expect.any(String),
      moreCommitsAvailable: false,
      hard: false
    });
  });

  it("filters commits by multiple branches", async () => {
    const multiBranchRepo = makeRepo();
    try {
      fs.writeFileSync(path.join(multiBranchRepo, "file1"), "content1");
      git(["add", "."], multiBranchRepo);
      git(["commit", "-m", "commit on main"], multiBranchRepo);

      git(["checkout", "-b", "branch1"], multiBranchRepo);
      fs.writeFileSync(path.join(multiBranchRepo, "file2"), "content2");
      git(["add", "."], multiBranchRepo);
      git(["commit", "-m", "commit on branch1"], multiBranchRepo);

      git(["checkout", "-b", "branch2"], multiBranchRepo);
      fs.writeFileSync(path.join(multiBranchRepo, "file3"), "content3");
      git(["add", "."], multiBranchRepo);
      git(["commit", "-m", "commit on branch2"], multiBranchRepo);

      git(["checkout", "main"], multiBranchRepo);

      const resultBranch1And2 = await loadCommits(simpleGit(multiBranchRepo), {
        branchNames: ["branch1", "branch2"],
        maxCommits: 300,
        showRemoteBranches: false,
        hard: false,
        dateType: "Author Date",
        showUncommittedChanges: false
      });

      const resultAllBranches = await loadCommits(simpleGit(multiBranchRepo), {
        branchNames: [SHOW_ALL],
        maxCommits: 300,
        showRemoteBranches: false,
        hard: false,
        dateType: "Author Date",
        showUncommittedChanges: false
      });

      expect(resultBranch1And2.commits.length).toBeGreaterThan(0);
      expect(resultAllBranches.commits.length).toBeGreaterThanOrEqual(
        resultBranch1And2.commits.length
      );
      expect(resultBranch1And2.moreCommitsAvailable).toBe(false);
    } finally {
      fs.rmSync(multiBranchRepo, { recursive: true, force: true });
    }
  });

  it("filters commits to the given branch", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchNames: ["main"],
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result.commits.length).toBeGreaterThan(0);
  });

  it("prepends uncommitted-changes commit when working tree is dirty", async () => {
    const dirtyRepo = makeRepo();
    try {
      fs.writeFileSync(path.join(dirtyRepo, "untracked"), "z");
      const result = await loadCommits(simpleGit(dirtyRepo), {
        branchNames: [SHOW_ALL],
        maxCommits: 300,
        showRemoteBranches: false,
        hard: false,
        dateType: "Author Date",
        showUncommittedChanges: true
      });
      expect(result.commits[0]).toEqual({
        hash: "*",
        parentHashes: [result.head],
        author: "*",
        email: "",
        date: expect.any(Number),
        message: expect.stringMatching(/^Uncommitted Changes \(\d+\)$/),
        refs: []
      });
    } finally {
      fs.rmSync(dirtyRepo, { recursive: true, force: true });
    }
  });

  it("does not prepend uncommitted-changes commit when showUncommittedChanges is false", async () => {
    const dirtyRepo = makeRepo();
    try {
      fs.writeFileSync(path.join(dirtyRepo, "untracked"), "z");
      const result = await loadCommits(simpleGit(dirtyRepo), {
        branchNames: [SHOW_ALL],
        maxCommits: 300,
        showRemoteBranches: false,
        hard: false,
        dateType: "Author Date",
        showUncommittedChanges: false
      });
      expect(result.commits[0].hash).not.toBe("*");
    } finally {
      fs.rmSync(dirtyRepo, { recursive: true, force: true });
    }
  });

  it("does not include remote refs when showRemoteBranches is false", async () => {
    const result = await loadCommits(simpleGit(repoWithRemote), {
      branchNames: [SHOW_ALL],
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    const allRefs = result.commits.flatMap((c) => c.refs);
    expect(allRefs.every((r) => r.type !== "remote")).toBe(true);
  });

  it("uses commit date when dateType is Commit Date", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchNames: [SHOW_ALL],
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Commit Date",
      showUncommittedChanges: false
    });
    expect(result.commits.length).toBeGreaterThan(0);
    expect(result.commits[0].date).toBeGreaterThan(0);
  });

  it("passes hard flag through to the result", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchNames: [SHOW_ALL],
      maxCommits: 300,
      showRemoteBranches: false,
      hard: true,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result).toEqual({
      commits: expect.any(Array),
      head: expect.any(String),
      moreCommitsAvailable: false,
      hard: true
    });
  });
});
