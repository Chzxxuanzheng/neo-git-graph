import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { GitCommitNode } from "@/backend/types";
import type * as GG from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/my-repo";

const defaultViewState: GG.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  graphColours: ["#0085d9"],
  graphStyle: "rounded",
  initialLoadCommits: 300,
  lastActiveRepo: null,
  loadMoreCommits: 75,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false
};

const twoCommits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: ["def456"],
    author: "Alice",
    email: "alice@example.com",
    date: 1700000000,
    message: "Add feature",
    refs: [{ hash: "abc123", name: "main", type: "head" }]
  },
  {
    hash: "def456",
    parentHashes: [],
    author: "Bob",
    email: "bob@example.com",
    date: 1699000000,
    message: "Initial commit",
    refs: []
  }
];

describe("webview rendering", () => {
  beforeAll(async () => {
    vi.resetModules();
    createVscodeMock();
    setupHtml(defaultViewState);
    await import("@/webview/main");
    receive({
      command: "loadBranches",
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true
    });
    receive({
      command: "loadCommits",
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true
    });
  });

  it("shows Load More Commits button when more commits are available", () => {
    expect(document.getElementById("loadMoreCommitsBtn")).not.toBeNull();
  });
});

describe("branch selection", () => {
  let branchSelectElem: HTMLElement;

  beforeEach(async () => {
    vi.resetModules();
    createVscodeMock();
    setupHtml(defaultViewState);
    await import("@/webview/main");
    receive({
      command: "loadBranches",
      branches: ["main", "develop", "feature/test"],
      head: "main",
      hard: true,
      isRepo: true
    });
    receive({
      command: "loadCommits",
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true
    });
    branchSelectElem = document.getElementById("branchSelect")!;
  });

  it("branch options should match the loaded branches", () => {
    const dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const optionNames = Array.from(dropdownOptions).map((option) => option.textContent?.trim());

    // Should have "Show All" + 3 branches
    expect(optionNames).toHaveLength(4);
    expect(optionNames[0]).toBe("Show All");
    expect(optionNames).toContain("main");
    expect(optionNames).toContain("develop");
    expect(optionNames).toContain("feature/test");
  });

  it("should deselect 'Show All' when selecting another branch, and will should clear other selections when selecting 'Show All'", () => {
    const currentValueElem = branchSelectElem.querySelector(".dropdownCurrentValue") as HTMLElement;

    let dropdownOptions: NodeListOf<HTMLElement>;
    let showAllOption: HTMLElement;
    let mainOption: HTMLElement;
    let developOption: HTMLElement;

    // Open the dropdown
    currentValueElem.click();

    // Click other branches to select it
    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    mainOption = dropdownOptions[1] as HTMLElement;

    mainOption.click();

    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    developOption = dropdownOptions[2] as HTMLElement;

    developOption.click();

    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    showAllOption = dropdownOptions[0] as HTMLElement;
    mainOption = dropdownOptions[1] as HTMLElement;
    developOption = dropdownOptions[2] as HTMLElement;

    // After selecting other branches, "Show All" should not be selected
    expect(showAllOption.classList.contains("selected")).toBe(false);
    expect(mainOption.classList.contains("selected")).toBe(true);
    expect(developOption.classList.contains("selected")).toBe(true);

    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    showAllOption = dropdownOptions[0] as HTMLElement;

    // click "Show All"
    showAllOption.click();

    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    showAllOption = dropdownOptions[0] as HTMLElement;
    mainOption = dropdownOptions[1] as HTMLElement;
    developOption = dropdownOptions[2] as HTMLElement;

    // After selecting "Show All", other selections will be cleared
    expect(showAllOption.classList.contains("selected")).toBe(true);
    expect(mainOption.classList.contains("selected")).toBe(false);
    expect(developOption.classList.contains("selected")).toBe(false);
  });

  it("should select default branch (Show All) when no branches are selected", () => {
    const currentValueElem = branchSelectElem.querySelector(".dropdownCurrentValue") as HTMLElement;
    currentValueElem.click();

    let dropdownOptions: NodeListOf<HTMLElement>;
    let showAllOption: HTMLElement;
    let mainOption: HTMLElement;

    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    mainOption = dropdownOptions[1] as HTMLElement;

    mainOption.click();

    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    showAllOption = dropdownOptions[0] as HTMLElement;
    mainOption = dropdownOptions[1] as HTMLElement;

    // After selecting "main", "Show All" should not be selected
    expect(showAllOption.classList.contains("selected")).toBe(false);
    expect(mainOption.classList.contains("selected")).toBe(true);

    // remove the only selected branch
    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    mainOption = dropdownOptions[1] as HTMLElement;

    mainOption.click();

    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    showAllOption = dropdownOptions[0] as HTMLElement;
    mainOption = dropdownOptions[1] as HTMLElement;

    // After clear the selected, default branch (Show All) should be selected
    expect(showAllOption.classList.contains("selected")).toBe(true);
    expect(mainOption.classList.contains("selected")).toBe(false);
  });
});
