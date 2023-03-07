/* eslint-disable no-alert, no-await-in-loop */

import { readFileSync } from "node:fs";

import { findDefaultBranch } from "./findDefaultBranch.js";
import { enableSecretScanningAlerts } from "./enableSecretScanning";
import { createPullRequest } from "./createPullRequest.js";
import { writeToFile } from "./writeToFile.js";
import { client as octokit } from "./clients";
import { commitFileMac } from "./commitFile.js";
import { enableGHAS } from "./enableGHAS.js";
import { enableDependabotAlerts } from "./enableDependabotAlerts";
import { enableDependabotFixes } from "./enableDependabotUpdates";
import { enableIssueCreation } from "./enableIssueCreation";
import { auth as generateAuth } from "./clients";

import { Octokit } from "@octokit/core";
import { ref as branchRef, inform, reposFileLocation } from "./globals.js";
import { repo, reposFile } from "../../types/common/index.js";
import { getReposWithCodeScanning } from "./codeScannerSearch";
import { searchCodeResponse } from "./octokitTypes.js";

const hasAtLeastOneSupportedLanguage = (primaryLanguage: string): boolean => {
  let hasAtLeastOneSupported = false;
  const languageList = primaryLanguage.split(",");
  for (let index = 0; index < languageList.length; index++) {
    const language = languageList[index].trim();
    if (!language.startsWith("not-supported")) {
      hasAtLeastOneSupported = true;
      break;
    }
  }
  return hasAtLeastOneSupported;
};

const filterOutReposWithCodeScanning = (
  searchResult: searchCodeResponse,
  repos: Array<repo>
): Array<repo> => {
  const filteredRepos: Array<repo> = [];
  for (let repoIndex = 0; repoIndex < repos.length; repoIndex++) {
    const repoItem = repos[repoIndex];
    const repoName = repoItem.repo;

    let containsRepo = false;
    for (
      let searchIndex = 0;
      searchIndex < searchResult.data.items.length;
      searchIndex++
    ) {
      const searchRepo =
        searchResult.data.items[searchIndex].repository.full_name;
      if (searchRepo === repoName) {
        containsRepo = true;
        break;
      }
    }
    if (containsRepo) {
      inform(
        `${repoName} already has Code Scanning enabled. Do not attempt to add it again.`
      );
    } else {
      filteredRepos.push(repoItem);
    }
  }
  return filteredRepos;
};

export const worker = async (): Promise<unknown> => {
  let res;
  let orgIndex: number;
  let repoIndex: number;
  let repos: reposFile;
  let file: string;
  const client = (await octokit()) as Octokit;
  // Read the repos.json file and get the list of repos using fs.readFileSync, handle errors, if empty file return error, if file exists and is not empty JSON.parse it and return the list of repos
  try {
    file = readFileSync(reposFileLocation, "utf8");
    if (file === "") {
      throw new Error(
        "We found your repos.json but it was empty, please run `yarn run getRepos` to collect the repos to run this script on."
      );
    }
    repos = JSON.parse(file);
  } catch (err) {
    console.error(err);
    throw new Error(
      "We did not find your repos.json file, please run `yarn run getRepos` to collect the repos to run this script on."
    );
  }

  for (orgIndex = 0; orgIndex < repos.length; orgIndex++) {
    const org = repos[orgIndex].login;
    if (!org.startsWith("im")) {
      inform(`Invalid org found: ${org}, skipping it...`);
      continue;
    }
    inform(
      `Currently looping over: ${orgIndex + 1}/${
        repos.length
      }. The org name is: ${org}`
    );
    const allRepos = repos[orgIndex].repos;
    const searchResults = await getReposWithCodeScanning(org, client);
    // Compare repos with what was searched for.
    // If the repo is in the results than we will filter it out
    const filteredRepos = filterOutReposWithCodeScanning(
      searchResults,
      allRepos
    );

    for (repoIndex = 0; repoIndex < filteredRepos.length; repoIndex++) {
      inform(
        `Currently looping over: ${repoIndex + 1}/${
          filteredRepos.length
        }. The repo name is: ${filteredRepos[repoIndex].repo}`
      );
      const {
        createDraftPr,
        createIssue,
        enableCodeScanning,
        enableDependabot,
        enableDependabotUpdates,
        enablePushProtection,
        enableSecretScanning,
        ithdTicketUrl,
        primaryLanguage,
        prTitle,
        repo: repoName,
      } = filteredRepos[repoIndex];

      const [owner, repo] = repoName.split("/");

      // If Code Scanning or Secret Scanning need to be enabled, let's go ahead and enable GHAS first
      enableCodeScanning || enableSecretScanning
        ? await enableGHAS(owner, repo, client)
        : null;

      // If they want to enable Dependabot, and they are NOT on GHES (as that currently isn't GA yet), enable Dependabot
      enableDependabot && process.env.GHES != "true"
        ? await enableDependabotAlerts(owner, repo, client)
        : null;

      // If they want to enable Dependabot Security Updates, and they are NOT on GHES (as that currently isn't GA yet), enable Dependabot Security Updates
      enableDependabotUpdates && process.env.GHES != "true"
        ? await enableDependabotFixes(owner, repo, client)
        : null;

      // Kick off the process for enabling Secret Scanning
      enableSecretScanning
        ? await enableSecretScanningAlerts(
            owner,
            repo,
            client,
            enablePushProtection
          )
        : null;

      // Kick off the process for enabling Code Scanning only if it is set to be enabled AND the primary language for the repo exists. If it doesn't exist that means CodeQL doesn't support it.
      if (
        enableCodeScanning &&
        hasAtLeastOneSupportedLanguage(primaryLanguage)
      ) {
        const authToken = (await generateAuth()) as string;
        let continueWithCodeScanCreation = true;
        try {
          await commitFileMac(
            owner,
            repo,
            primaryLanguage,
            branchRef,
            authToken
          );
        } catch (error) {
          inform(`Error Details: ${error}`);
          inform(
            `File, code-analysis.yml, already exists. Nothing needed to commit.`
          );
          continueWithCodeScanCreation = false;
        }

        if (continueWithCodeScanCreation) {
          const defaultBranch = await findDefaultBranch(owner, repo, client);
          const pullRequestURL = await createPullRequest(
            defaultBranch,
            branchRef,
            owner,
            repo,
            client,
            createDraftPr,
            prTitle,
            ithdTicketUrl
          );
          if (createIssue) {
            await enableIssueCreation(pullRequestURL, owner, repo, client);
          }
          await writeToFile(pullRequestURL);
          // }
        }
      }
    }
  }
  return res;
};
