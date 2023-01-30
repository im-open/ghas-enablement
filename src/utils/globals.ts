import Debug from "debug";

import { existsSync } from "fs";

import os from "os";

export const baseRestApiURL =
  process.env.GHES == "true"
    ? `${process.env.GHES_SERVER_BASE_URL}/api/v3`
    : "https://api.github.com";
export const baseGraphApiURL =
  process.env.GHES == "true"
    ? `${process.env.GHES_SERVER_BASE_URL}/api`
    : "https://api.github.com";
export const baseURL =
  process.env.GHES == "true"
    ? process.env.GHES_SERVER_BASE_URL
    : "https://github.com";

export const ref = `refs/heads/ghas-enablement` as string;
export const message = "Created CodeQL Analysis File";
export const title = "GitHub Advanced Security - Code Scanning" as string;
export const tempDIR = "tempGitLocations" as string;
export const path = "./github/workflows" as string;
export const inform = Debug("ghas:inform") as Debug.Debugger;
export const error = Debug("ghas:error") as Debug.Debugger;
export const reposFileLocation = "./bin/repos.json" as string;
export const orgsFileLocation = "./bin/organizations.json" as string;
export const platform = os.platform() as string;
const user =
  platform === "win32"
    ? (process.cwd().split("\\")[2] as string)
    : (process.cwd().split("/")[2] as string);
const root = existsSync("/vscode") // Requires user
  ? ("workspaces" as string)
  : platform === "win32" || platform === "darwin"
  ? (`Users/${user}` as string)
  : (`home/${user}` as string);
export const destDir =
  process.env.TEMP_DIR != ""
    ? process.env.TEMP_DIR
    : existsSync("/vscode") // Requires root
    ? ("workspaces" as string)
    : (`${root}/Desktop` as string);
