import { client as octokit } from "./clients";

import { Octokit } from "@octokit/core";

import { GraphQlQueryResponseData } from "@octokit/graphql";

import {
  GraphQLQueryResponse,
  GraphQLQueryResponseGetRepos,
  GraphQLQueryResponseGetReposRaw,
  usersWriteAdminReposArray,
} from "../../types/common";

import { filterAsync } from "./filterAsync";
import { error, inform } from "./globals";
import { getcodeQLLanguage } from "./getcodeQLLanguage";

const performRepositoryQuery = async (
  client: Octokit,
  query: string,
  slug: string,
  after: string | null
): Promise<GraphQLQueryResponse> => {
  try {
    const {
      organization: {
        repositories: {
          pageInfo: { hasNextPage, endCursor },
          nodes,
        },
      },
    } = (await client.graphql(query, {
      slug,
      after,
    })) as GraphQlQueryResponseData;

    const currentNodes = nodes as Array<GraphQLQueryResponseGetReposRaw>;
    const responseNodes = new Array<GraphQLQueryResponseGetRepos>();

    currentNodes.forEach((node) => {
      if (node.languages.nodes != null && node.languages.nodes.length > 0) {
        const responseNode: GraphQLQueryResponseGetRepos = {
          nameWithOwner: node.nameWithOwner,
          isArchived: node.isArchived,
          viewerPermission: node.viewerPermission,
          visibility: node.viewerPermission,
          primaryLanguage: {
            // We don't care about the language, as long as it matches one of them
            // because the single workflow will support scanning all
            name: node.languages.nodes[0].name,
          },
        };
        responseNodes.push(responseNode);
      }
    });

    return [hasNextPage, endCursor, responseNodes];
  } catch (err) {
    error(err);
    throw err;
  }
};

const getRepositoryInOrganizationPaginate = async (
  client: Octokit,
  slug: string,
  query: string,
  paginatedData = [] as usersWriteAdminReposArray,
  ec = null as string | null
): Promise<usersWriteAdminReposArray> => {
  try {
    const [hasNextPage, endCursor, nodes] = await performRepositoryQuery(
      client,
      query,
      slug,
      ec
    );

    /* If (the viewerPermission is set to NULL OR the viewerPermission is set to ADMIN)
      OR the reposiory is not archived, keep in the array*/
    const results = await filterAsync(nodes, async (value) => {
      const {
        nameWithOwner,
        viewerPermission,
        isArchived,
        primaryLanguage,
        visibility,
      } = value;
      const { name } = primaryLanguage || { name: "no-language" };
      inform(
        `Repo Name: ${nameWithOwner} Permission: ${viewerPermission} Archived: ${isArchived} Language: ${name} Visibility: ${visibility}`
      );
      const languageCheck =
        process.env.LANGUAGE_TO_CHECK || ""
          ? name.toLocaleLowerCase() === `${process.env.LANGUAGE_TO_CHECK}`
          : true;
      const returnValue =
        (viewerPermission === "ADMIN" || viewerPermission === null) &&
        isArchived === false &&
        languageCheck
          ? true
          : false;

      return returnValue;
    });

    inform(
      `Found ${results.length} repositories that met the valid criteria in the organisation ${slug}. Out of ${nodes.length}.`
    );

    const enable = process.env.ENABLE_ON as string;

    if (enable.includes("pushprotection") && !enable.includes("secretscanning"))
      throw new Error(
        "You cannot enable pushprotection without enabling secretscanning"
      );

    results.forEach((element) => {
      return paginatedData.push({
        enableDependabot: enable.includes("dependabot") as boolean,
        enableDependabotUpdates: enable.includes(
          "dependabotupdates"
        ) as boolean,
        enableSecretScanning: enable.includes("secretscanning") as boolean,
        enableCodeScanning: enable.includes("codescanning") as boolean,
        enablePushProtection: enable.includes("pushprotection") as boolean,
        primaryLanguage: getcodeQLLanguage(element.primaryLanguage?.name || ""),
        createIssue:
          process.env.CREATE_ISSUE === "true" ? true : (false as boolean),
        repo: element.nameWithOwner,
      });
    });

    if (hasNextPage) {
      await getRepositoryInOrganizationPaginate(
        client,
        slug,
        query,
        paginatedData,
        endCursor
      );
    }
    return paginatedData;
  } catch (err) {
    error(err);
    throw err;
  }
};

export const paginateQuery = async (
  slug: string,
  graphQuery: string
): Promise<usersWriteAdminReposArray> => {
  try {
    const client = await octokit();
    const data = await getRepositoryInOrganizationPaginate(
      client,
      slug,
      graphQuery
    );
    return data.filter(({ primaryLanguage: pl }) => pl !== "no-language");
  } catch (err) {
    error(err);
    throw err;
  }
};
