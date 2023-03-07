import { Octokit } from "@octokit/core";
import { searchCodeParameters, searchCodeResponse } from "./octokitTypes";

export const getReposWithCodeScanning = async (
  org: string,
  octokit: Octokit
): Promise<searchCodeResponse> => {
  // https://docs.github.com/en/rest/search?apiVersion=2022-11-28#search-code
  // https://docs.github.com/en/search-github/searching-on-github/searching-code
  const params = {
    q: `org:${org} path:.github/workflows filename:code-analysis`,
  } as searchCodeParameters;

  const response = (await octokit.request(
    "GET /search/code",
    params
  )) as searchCodeResponse;
  return response;
};
