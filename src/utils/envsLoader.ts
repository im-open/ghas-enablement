import { EnvValues } from "../../types/common";

export const loadEnvValues = (): EnvValues => {
  const envFile = {
    createDraftPr: process.env.CREATE_DRAFT_PR == "true",
    createIssue: process.env.CREATE_ISSUE == "true",
    enableCodeScanning: process.env.ENABLE_ON?.includes("codescanning"),
    enableDependabot: process.env.ENABLE_ON?.includes("dependabot"),
    enableDependabotUpdates:
      process.env.ENABLE_ON?.includes("dependabotupdates"),
    enablePushProtection: process.env.ENABLE_ON?.includes("pushprotection"),
    enableSecretScanning: process.env.ENABLE_ON?.includes("secretscanning"),
    ithdTicketUrl: process.env.ITHD_TICKET_URL,
    prTitle: process.env.PR_TITLE,
    prWaitSecs: Number.parseInt(process.env.PR_WAIT_SECS || ""),
  } as EnvValues;
  return envFile;
};
