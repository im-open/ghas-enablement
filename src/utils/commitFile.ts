/* eslint-disable no-alert, no-await-in-loop */

import delay from "delay";
import fs from "fs";
import util from "util";

import { inform, error, platform, baseURL, destDir, tempDIR } from "./globals";

import { generalCommands } from "./commands";

import { execFile as ImportedExec } from "child_process";

import { response, commands } from "../../types/common";

const execFile = util.promisify(ImportedExec);

inform(`Platform detected: ${platform}`);

if (platform !== "win32" && platform !== "darwin" && platform !== "linux") {
  error("You can only use either windows or mac machine!");
  throw new Error(
    `We detected an OS that wasn't Windows, Linux or Mac. Right now, these
    are the only three OS's supported. Log an issue on the repository for
    wider support`
  );
}

const fileName = "code-analysis.yml";
const fileNameDraft = "code-analysis-draft.yml";
const osWindows = "windows";
const osLinux = "linux";
const placeholderOS = "OS_PLACEHOLDER";
const placeholderCSharp = "HAS_CSHARP_PLACEHOLDER";

const doesCodeScanRequireWindowsRunner = (repoName: string): boolean => {
  const workflowPath = `${destDir}/${tempDIR}/${repoName}/.github/workflows/im-build-dotnet-ci.yml`;
  let requiresWindows = false;

  if (fs.existsSync(workflowPath)) {
    const fileContents = fs.readFileSync(workflowPath).toString("utf-8");
    const fileLines = fileContents.split("\n");
    for (let index = 0; index < fileLines.length; index++) {
      const line = fileLines[index];
      if (line.includes("runs-on:") && line.includes("windows-")) {
        requiresWindows = true;
        break;
      }
    }
  }
  return requiresWindows;
};

const setupCodeAnalysisYml = (requiresWindows: boolean): boolean => {
  const binWorkflows = "./bin/workflows";
  const draftPath = `${binWorkflows}/${fileNameDraft}`;

  const workflowDraft = fs.readFileSync(draftPath).toString("utf-8");

  const workflowFinal = workflowDraft
    .replace(placeholderCSharp, requiresWindows ? "true" : "false")
    .replace(placeholderOS, requiresWindows ? osWindows : osLinux);
  try {
    const finalPath = `${binWorkflows}/${fileName}`;
    fs.writeFileSync(finalPath, workflowFinal);
    return true;
  } catch {
    return false;
  }
};

export const commitFileMac = async (
  owner: string,
  repo: string,
  primaryLanguage: string,
  refs: string,
  authToken: string
): Promise<response> => {
  let gitCommands: commands;
  let index: number;

  const authBaseURL = baseURL!.replace(
    "https://",
    `https://x-access-token:${authToken}@`
  ) as string;
  const regExpExecArray = /[^/]*$/.exec(refs);
  const branch = regExpExecArray ? regExpExecArray[0] : "";

  const {
    env: { LANGUAGE_TO_CHECK: language },
  } = process;
  let codeQLLanguage = language;
  if (!codeQLLanguage && primaryLanguage != "no-language") {
    codeQLLanguage = primaryLanguage;
  }
  if (!codeQLLanguage) {
    return { status: 500, message: "no language on repo" };
  }

  try {
    gitCommands = generalCommands(
      owner,
      repo,
      branch,
      fileName,
      authBaseURL
    ) as commands;
    inform(gitCommands);
  } catch (err) {
    error(err);
    throw err;
  }

  for (index = 0; index < gitCommands.length; index++) {
    const gitCommand = gitCommands[index];
    inform(
      `Executing ${gitCommand.command} ${gitCommand.args.join(" ")} in ${
        gitCommand.cwd
      }`
    );
    // Adding try/catch so we can whitelist
    try {
      const { stdout, stderr } = await execFile(
        gitCommand.command,
        gitCommand.args,
        {
          cwd: gitCommand.cwd,
          shell: true,
        }
      );
      if (stderr) {
        error(stderr);
      }
      inform(stdout);
      await delay(1000);
    } catch (err: any) {
      inform(`Whitelist returns: ${whiteListed(err.message)}`);
      if (!whiteListed(err.message)) {
        throw err;
      }
    }
    if (gitCommand.args.includes("clone")) {
      // after cloning repo check if we will need a windows runner for code scan
      const requiresWindows = doesCodeScanRequireWindowsRunner(repo);
      // write code-analysis.yml with appropriate code scan runner type
      setupCodeAnalysisYml(requiresWindows);
    }
  }
  return { status: 200, message: "success" };
};

/**
 *
 * @param errorMsg    The string error message captured
 * @returns           A boolean determined by the existance or lack of a
 *                    whitelist match.
 */
function whiteListed(errorMsg: string): boolean {
  const whiteList = [
    "The system cannot find the file specified",
    "already exists",
  ];

  const contains = whiteList.some((searchTerm) => {
    if (errorMsg.includes(searchTerm)) {
      inform(`The error is whitelisted. Continuing...`);
      return true;
    }
    return false;
  });
  return contains;
}
