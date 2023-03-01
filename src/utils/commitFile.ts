/* eslint-disable no-alert, no-await-in-loop */

import delay from "delay";
import fs from "fs";
import util from "util";

// https://www.npmjs.com/package/js-yaml
import yaml from "js-yaml";

import { inform, error, platform, baseURL, destDir, tempDIR } from "./globals";

import { generalCommands } from "./commands";

import { execFile as ImportedExec } from "child_process";

import {
  response,
  commands,
  CSharpCiYmlMetadata,
  Props,
} from "../../types/common";

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
const placeholderRunsOn = "PLACEHOLDER_RUNS_ON";
const placeholderMatrixLangs = "PLACEHOLDER_MATRIX_LANGS";
const placeholderDotnetVersion = "PLACEHOLDER_DOTNET_VERSION";
const placeholderSolutionFile = "PLACEHOLDER_SOLUTION_FILE";
const placeholderOrg = "PLACEHOLDER_ORG";

const runs_on_windows = "[self-hosted, windows-2019]";
const runs_on_linux = "im-ghas-linux";
const templateCs = loadTemplate("template-csharp.yml");
const templateOthers = loadTemplate("template-other-langs.yml");
const templatePwsh = loadTemplate("template-powershell.yml");
const templateTf = loadTemplate("template-terraform.yml");
const templateWorkflow = loadTemplate("template-workflow.yml");
const templateDependency = loadTemplate("template-dependency.yml");

const needsWindowsRunner = (fileContents: string): boolean => {
  let requiresWindows = false;
  const fileLines = fileContents.split("\n");
  for (let lIndex = 0; lIndex < fileLines.length; lIndex++) {
    const line = fileLines[lIndex];
    if (line.includes("runs-on") && line.includes("windows-")) {
      requiresWindows = true;
    }
  }
  return requiresWindows;
};

const getPaddedDotnetPlaceholderChars = (): string => {
  const fileLines = templateCs.split("\n");
  let firstCharIndex = -1;
  for (let index = 0; index < fileLines.length; index++) {
    const line = fileLines[index];
    firstCharIndex = line.indexOf("PLACEHOLDER_DOTNET_VERSION");
    if (firstCharIndex > -1) {
      break;
    }
  }
  let padded = "";
  for (let index = 0; index < firstCharIndex; index++) {
    padded += " ";
  }
  return padded;
};

const getDotnetVersionFormatted = (env: Props): string => {
  // 1. Get the version from env
  // 2. Read line with PLACEHOLDER_DOTNET_VERSION and see how many spaces out it is.
  // If there are more than 1 dotnet versions declared we will need multiple lines and each
  // additional line will need to be aligned with the first one so we will add spaces
  const rawVersion = env["DOTNET_VERSION"].toString().trim();
  const newLine = "\n";
  const versions = rawVersion.split(newLine);

  if (versions.length == 1) {
    return versions[0];
  }

  const padded = getPaddedDotnetPlaceholderChars();

  let dotnetVersion = versions[0];
  for (let index = 1; index < versions.length; index++) {
    const currentVersion = versions[index];
    dotnetVersion += `${newLine}${padded}${currentVersion}`;
  }
  return dotnetVersion;
};

const gatherCSharpCiYmlMetadata = (repoName: string): CSharpCiYmlMetadata => {
  const workflowsPath = `${destDir}/${tempDIR}/${repoName}/.github/workflows`;
  let dotnetVersion = "";
  let solutionFile = "";
  let requiresWindows = false;

  if (fs.existsSync(workflowsPath)) {
    const fileList = fs.readdirSync(workflowsPath);
    for (let fIndex = 0; fIndex < fileList.length; fIndex++) {
      const fileName = fileList[fIndex];
      if (fileName.endsWith("ci.yml")) {
        const filePath = `${workflowsPath}/${fileName}`;
        const fileContents = fs.readFileSync(filePath).toString("utf-8");

        requiresWindows = needsWindowsRunner(fileContents);

        const ymlJson = yaml.load(fileContents) as Props;

        const env = ymlJson["env"] as Props;
        solutionFile = env["SOLUTION_FILE"].toString();

        dotnetVersion = getDotnetVersionFormatted(env);
      }
    }
  }
  const result = {
    dotnetVersion,
    solutionFile,
    requiresWindows,
  } as CSharpCiYmlMetadata;
  return result;
};

const addWorkflowJob = (template: string, workflowParts: Array<string>) => {
  // job templates start with jobs: on the first line so they don't
  // lose their tab spacing as they are stored. Remove this and add to array
  const templateWithoutJobs = template.replace("jobs:", "");
  workflowParts.push(templateWithoutJobs);
};

const createWorkflowFile = (
  primaryLanguage: string,
  metadata: CSharpCiYmlMetadata,
  orgName: string
): string => {
  const workflowParts: Array<string> = [];
  workflowParts.push(templateWorkflow);
  addWorkflowJob(templateDependency, workflowParts);

  const primaryLanguageList = primaryLanguage.split(",");
  const otherLangs: Array<string> = [];
  for (let index = 0; index < primaryLanguageList.length; index++) {
    const languageTrim = primaryLanguageList[index].trim();
    if (languageTrim == "csharp") {
      // Create C# job and specify if it's windows or linux
      const templateCsWithReplacements = templateCs
        .replace(
          placeholderRunsOn,
          metadata.requiresWindows ? runs_on_windows : runs_on_linux
        )
        .replace(placeholderDotnetVersion, metadata.dotnetVersion)
        .replace(placeholderSolutionFile, metadata.solutionFile)
        .replace(placeholderOrg, orgName);
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
  metadata: CSharpCiYmlMetadata,
  orgName: string,
  primaryLanguage: string
): boolean => {
  const workflowFinal = createWorkflowFile(primaryLanguage, metadata, orgName);
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
      const metadata = gatherCSharpCiYmlMetadata(repo);
      // write code-analysis.yml with appropriate code scan runner type
      setupCodeAnalysisYml(metadata, owner, primaryLanguage);
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
