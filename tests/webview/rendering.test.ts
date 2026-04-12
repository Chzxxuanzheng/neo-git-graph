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

  beforeAll(async () => {
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
  });

  beforeEach(() => {
    branchSelectElem = document.getElementById("branchSelect")!;
  });

  it("should deselect 'Show All' when selecting another branch", () => {
    const currentValueElem = branchSelectElem.querySelector(".dropdownCurrentValue") as HTMLElement;

    // Open the dropdown
    currentValueElem.click();

    const dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const mainOption = dropdownOptions[1] as HTMLElement;

    // Click "main" branch to select it
    mainOption.click();

    // Re-query after event handling
    const updatedOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const showAllOption = updatedOptions[0];
    const mainOptionAfter = updatedOptions[1];

    // After selecting "main", "Show All" should not be selected
    expect(showAllOption.classList.contains("selected")).toBe(false);
    expect(mainOptionAfter.classList.contains("selected")).toBe(true);
  });

  it("should clear other selections when selecting 'Show All'", () => {
    const currentValueElem = branchSelectElem.querySelector(".dropdownCurrentValue") as HTMLElement;

    // First ensure dropdown is closed so we have clean state
    const dropdownElem = branchSelectElem as HTMLElement;
    if (dropdownElem.classList.contains("dropdownOpen")) {
      currentValueElem.click();
    }

    // Open the dropdown
    currentValueElem.click();

    // Get the options and click main branch
    let dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const mainOption = dropdownOptions[1] as HTMLElement;
    mainOption.click();

    // Re-open dropdown to verify state and select Show All
    let currentValueElemAgain = branchSelectElem.querySelector(
      ".dropdownCurrentValue"
    ) as HTMLElement;
    currentValueElemAgain.click();

    // Now click "Show All"
    dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const showAllOption = dropdownOptions[0] as HTMLElement;
    showAllOption.click();

    // Check the state even though dropdown is now closed
    // The DOM should reflect the current selection state
    const allOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const showAllAfter = allOptions[0];
    const mainAfter = allOptions[1];

    // After selecting "Show All", only "Show All" should be selected
    expect(showAllAfter.classList.contains("selected")).toBe(true);
    expect(mainAfter.classList.contains("selected")).toBe(false);
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

  it("should select default branch (Show All) when no branches are selected", () => {
    const currentValueElem = branchSelectElem.querySelector(".dropdownCurrentValue") as HTMLElement;

    // Ensure dropdown is closed first
    if (branchSelectElem.classList.contains("dropdownOpen")) {
      currentValueElem.click();
    }

    // Open dropdown
    currentValueElem.click();

    let dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const mainOption = dropdownOptions[1] as HTMLElement;
    const developOption = dropdownOptions[2] as HTMLElement;

    // Select main and develop
    mainOption.click();
    developOption.click();

    // Now deselect both branches to trigger the default selection behavior
    // Ensure dropdown is open again
    const currentValueElem2 = branchSelectElem.querySelector(
      ".dropdownCurrentValue"
    ) as HTMLElement;

    if (!branchSelectElem.classList.contains("dropdownOpen")) {
      currentValueElem2.click();
    }

    let dropdownOptions2 = branchSelectElem.querySelectorAll(".dropdownOption");
    const mainOptionToDeselect = dropdownOptions2[1] as HTMLElement;
    const developOptionToDeselect = dropdownOptions2[2] as HTMLElement;

    // Deselect first branch
    mainOptionToDeselect.click();

    // Deselect second branch - this should trigger auto-selection of Show All
    developOptionToDeselect.click();

    // Query the options again to check the current state
    const allOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const showAllOption = allOptions[0];

    // Show All should be automatically selected when all others are deselected
    expect(showAllOption.classList.contains("selected")).toBe(true);
  });

  it("should select Show All as default when no branches are selected", () => {
    const currentValueElem = branchSelectElem.querySelector(".dropdownCurrentValue") as HTMLElement;

    // Ensure dropdown is closed first
    if (branchSelectElem.classList.contains("dropdownOpen")) {
      currentValueElem.click();
    }

    // Open dropdown
    currentValueElem.click();

    let dropdownOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const mainOption = dropdownOptions[1] as HTMLElement;
    const developOption = dropdownOptions[2] as HTMLElement;

    // Select main and develop
    mainOption.click();
    developOption.click();

    // Now deselect both branches
    // First, ensure dropdown is open
    const currentValueElem2 = branchSelectElem.querySelector(
      ".dropdownCurrentValue"
    ) as HTMLElement;

    if (!branchSelectElem.classList.contains("dropdownOpen")) {
      currentValueElem2.click();
    }

    let dropdownOptions2 = branchSelectElem.querySelectorAll(".dropdownOption");
    const mainOptionToDeselect = dropdownOptions2[1] as HTMLElement;
    const developOptionToDeselect = dropdownOptions2[2] as HTMLElement;

    // Deselect first branch
    mainOptionToDeselect.click();

    // Deselect second branch - this should trigger auto-selection of Show All
    developOptionToDeselect.click();

    // Query the options again to check the current state
    const allOptions = branchSelectElem.querySelectorAll(".dropdownOption");
    const showAllOption = allOptions[0];

    // Show All should be automatically selected when all others are deselected
    expect(showAllOption.classList.contains("selected")).toBe(true);
  });
});
