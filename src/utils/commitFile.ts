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

const binWorkflows = "./bin/workflows";
const loadTemplate = (templateName: string): string => {
  const draftPath = `${binWorkflows}/${templateName}`;

  const template = fs.readFileSync(draftPath).toString("utf-8");
  return template;
};

const fileName = "code-analysis.yml";
const placeholderRunsOn = "RUNS_ON_PLACEHOLDER";
const placeholderMatrixLangs = "MATRIX_LANGS_PLACEHOLDER";
const runs_on_windows = "[self-hosted, windows-2019]";
const runs_on_linux = "im-ghas-linux";
const templateCs = loadTemplate("template-cs.yml");
const templateOthers = loadTemplate("template-other-langs.yml");
const templatePwsh = loadTemplate("template-ps1.yml");
const templateTf = loadTemplate("template-tf.yml");
const templateWorkflow = loadTemplate("template-workflow.yml");

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

const addWorkflowJob = (template: string, workflowParts: Array<string>) => {
  // job templates start with jobs: on the first line so they don't
  // lose their tab spacing as they are stored. Remove this and add to array
  const templateWithoutJobs = template.replace("jobs:", "");
  workflowParts.push(templateWithoutJobs);
};

const createWorkflowFile = (
  primaryLanguage: string,
  requiresWindows: boolean
): string => {
  const workflowParts: Array<string> = [];
  workflowParts.push(templateWorkflow);

  const primaryLanguageList = primaryLanguage.split(",");
  const otherLangs: Array<string> = [];
  for (let index = 0; index < primaryLanguageList.length; index++) {
    const languageTrim = primaryLanguageList[index].trim();
    if (languageTrim == "csharp") {
      // Create C# job and specify if it's windows or linux
      const templateCsWithReplacements = templateCs.replace(
        placeholderRunsOn,
        requiresWindows ? runs_on_windows : runs_on_linux
      );
      addWorkflowJob(templateCsWithReplacements, workflowParts);
    } else if (languageTrim == "hcl") {
      // Create terraform scan job
      addWorkflowJob(templateTf, workflowParts);
    } else if (languageTrim == "powershell") {
      // Create PowerShell scan job
      addWorkflowJob(templatePwsh, workflowParts);
    } else if (
      ["go", "javascript", "python", "cpp", "java", "ruby"].includes(
        languageTrim
      )
    ) {
      // Add language to other langs
      otherLangs.push(languageTrim);
    }
  }

  if (otherLangs.length > 0) {
    // create other CodeQL languages job
    const matrixLangs = otherLangs.join(", ");
    const templateOtherWithReplacements = templateOthers.replace(
      placeholderMatrixLangs,
      matrixLangs
    );
    addWorkflowJob(templateOtherWithReplacements, workflowParts);
  }

  // join list as a string separating list items by new line
  const workflowFile = workflowParts.join("\n");
  return workflowFile;
};

const setupCodeAnalysisYml = (
  requiresWindows: boolean,
  primaryLanguage: string
): boolean => {
  const workflowFinal = createWorkflowFile(primaryLanguage, requiresWindows);
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
  if (!codeQLLanguage) {
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
      setupCodeAnalysisYml(requiresWindows, primaryLanguage);
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
