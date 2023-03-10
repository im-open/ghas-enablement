export type repo = {
  primaryLanguage: string;
  runInfo: string;
  repo: string;
};

export type reposFile = {
  login: string;
  repos: repo[];
}[];

export type gitCommands = {
  command: string;
  args: string[];
  cwd: string;
};

export type apiEndpoints = {
  checkStatus: string;
  enableAlerts: string;
};

export type config = {
  type: string;
  per_page: number;
  page: number;
};

export type usersWriteAdminRepos = {
  primaryLanguage: string;
  runInfo: string;
  repo: string;
};

export type RateLimitOptions = {
  request: {
    retryCount: number;
  };
};

export type response = {
  status: number;
  message: string;
};

export type TestOctokit = {
  request?: unknown;
  paginate?: unknown;
};

export type commands = gitCommands[];

type usersWriteAdminReposArray = usersWriteAdminRepos[];

export type orgsInEnterpriseArray = orgsInEnterpriseObject[];

export type orgsInEnterpriseObject = {
  login: string;
  repos?: usersWriteAdminReposArray;
};

export type performOrganisationsQueryType = [
  string,
  string,
  orgsInEnterpriseArray
];

export type getOrgLocalFileResponse = {
  status: number;
  data: orgsInEnterpriseArray | null;
};

export type performRepositoryQueryType = [string, string, reposInOrgArray];

export type performRepositoryLanguageQueryType = [
  string,
  string,
  reposByLanguageArray
];

export type reposInOrgArray = reposInOrgObject[];

export type reposInOrgObject = {
  nameWithOwner: string;
  isArchived?: boolean;
  viewerPermission?: string;
};

export type reposByLanguageObject = {
  nameWithOwner: string;
  isArchived?: boolean;
  viewerPermission?: string;
  primaryLanguage: {
    name: string;
  };
};

export type reposByLanguageArray = reposByLanguageObject[];

type Func = (
  slug: string,
  graphQuery: string
) => Promise<usersWriteAdminReposArray>;

type GetGraphQLQueryFunction = () => string;

export type GraphQLQueryResponseGetReposRaw = {
  nameWithOwner: string;
  isArchived: boolean;
  viewerPermission: string;
  visibility: string;
  languages: Languages;
};

export type Languages = {
  nodes: LanguagesNode[];
};

export type LanguagesNode = {
  name: string;
};

export type GraphQLQueryResponseGetRepos = {
  nameWithOwner: string;
  isArchived: boolean;
  viewerPermission: string;
  visibility: string;
  primaryLanguage: {
    name: string;
  };
};

export type CSharpCiYmlMetadata = {
  dotnetInstallDir: string;
  dotnetVersion: string;
  packageOrgs: string;
  solutionFile: string;
  requiresWindows: boolean;
};

export type GraphQLQueryResponseData = GraphQLQueryResponseGetRepos[];
export type GraphQLQueryResponse = [string, string, GraphQLQueryResponseData];

export type Props = {
  [key: string]: object;
};

export type EnvValues = {
  createDraftPr: boolean;
  createIssue: boolean;
  enableCodeScanning: boolean;
  enableDependabot: boolean;
  enableDependabotUpdates: boolean;
  enablePushProtection: boolean;
  enableSecretScanning: boolean;
  ithdTicketUrl: string;
  prTitle: string;
  prWaitSecs: number;
};
