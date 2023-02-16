/* eslint-disable no-alert, no-await-in-loop */
import delay from "delay";
import fs from "fs";
import util from "util";

import { auth as authToken } from "./clients";
import { client as octokit } from "./clients";
import { commands } from "../../types/common";
import { destDir, tempDIR } from "./globals";
import { execFile as ImportedExec } from "child_process";
import { findDefaultBranch } from "./findDefaultBranch.js";
import { generalCommands } from "./commands";
import { gitCommands, reposFile } from "../../types/common/index.js";
import { Octokit } from "@octokit/core";
import { readFileSync } from "node:fs";
import { reposFileLocation, inform, baseURL, error } from "./globals.js";

const execFile = util.promisify(ImportedExec);

const getCommandsForClone = (
  commands: commands,
  repoName: string
): gitCommands[] => {
  // We only want the first few commands that remove previous checkout, create tempdir, and clone the repo
  const commandsForClone = [];
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    if (
      command.command.includes("rm") &&
      (command.args.includes("/Q") || command.args.includes("-rf"))
    ) {
      commandsForClone.push(command);
    } else if (
      command.command.includes("mkdir") &&
      !command.cwd.includes(repoName)
    ) {
      commandsForClone.push(command);
    } else if (command.args.includes("clone")) {
      commandsForClone.push(command);
    }
  }
  return commandsForClone;
};

const getWorkflowPath = (repoName: string): string => {
  const workflowPath = `${destDir}/${tempDIR}/${repoName}/.github/workflows/im-build-dotnet-ci.yml`;
  return workflowPath;
};

const containsImDotnetCi = (repoName: string): boolean => {
  const containsFile = fs.existsSync(getWorkflowPath(repoName));
  return containsFile;
};

export const doesRepoRequireWindowsRunner = (repoName: string): boolean => {
  const workflowPath = getWorkflowPath(repoName);

  const fileContents = fs.readFileSync(workflowPath).toString("utf-8");
  const fileLines = fileContents.split("\n");
  let requiresWindows = false;
  for (let index = 0; index < fileLines.length; index++) {
    const line = fileLines[index];
    if (line.includes("runs-on:") && line.includes("windows-")) {
      requiresWindows = true;
      break;
    }
  }
  return requiresWindows;
};

export const repoInspector = async (): Promise<unknown> => {
  let file: string;
  let repos: reposFile;
  let response;

  const apiToken = (await authToken()) as string;
  const authBaseUrl = baseURL!.replace(
    "https://",
    `https://x-access-token:${apiToken}@`
  ) as string;
  const octoClient = (await octokit()) as Octokit;
  try {
    file = readFileSync(reposFileLocation, "utf8");
    if (file == "") {
      throw new Error(
        "ERROR: repos.json found but was empty. Please run `yarn run getRepos`."
      );
    }
    repos = JSON.parse(file);
  } catch (err) {
    console.error(err);
    throw new Error(
      "ERROR: Could not find repos.json. Please run `yarn run getRepos`."
    );
  }

  // using for loops instead of forEach so we can use await later on
  for (let orgIndex = 0; orgIndex < repos.length; orgIndex++) {
    const org = repos[orgIndex];
    inform(`Find repos in ${org.login}`);

    const orgRepos = org.repos;
    for (let repoIndex = 0; repoIndex < orgRepos.length; repoIndex++) {
      const repo = orgRepos[repoIndex];
      inform(
        `Check if ${repo.repo} has build dotnet workflow that uses windows runner...`
      );
      const [owner, repoName] = repo.repo.split("/");
      const defaultBranch = await findDefaultBranch(
        owner,
        repoName,
        octoClient
      );
      const gitCommands = generalCommands(
        owner,
        repoName,
        defaultBranch,
        "",
        authBaseUrl
      );
      const commandsForClone = getCommandsForClone(gitCommands, repoName);
      try {
        for (let cmdIndex = 0; cmdIndex < commandsForClone.length; cmdIndex++) {
          const commandForClone = commandsForClone[cmdIndex];

          inform(
            `Run command: ${
              commandForClone.command
            } ${commandForClone.args.join(" ")} in ${commandForClone.cwd}`
          );
          const { stdout, stderr } = await execFile(
            commandForClone.command,
            commandForClone.args,
            {
              cwd: commandForClone.cwd,
              shell: true,
            }
          );
          if (stderr) {
            error(stderr);
          }
          inform(stdout);
        }

        if (
          containsImDotnetCi(repoName) &&
          doesRepoRequireWindowsRunner(repoName)
        ) {
          inform(`Repo, ${repoName}, requires a windows runner`);
        } else {
          inform(`Repo, ${repoName}, does not require a windows runner`);
        }
        // wait a half-second between git clones
        await delay(500);
      } catch (err: any) {
        throw new Error(
          `ERROR: Could not clone ${repo}. Error: ${err.message}`
        );
      }
    }
  }
  return response;
};
