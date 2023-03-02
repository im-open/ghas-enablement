export const prText = (prTitle: string, ithdTicketUrl: string): string => `
# ${prTitle}

This Pull Request was produced using [ghas-enablement](https://github.com/im-open/ghas-enablement). It works by scanning repositories, in an organization, and creates a workflow based on the programming languages it uses. In addition to the Github README we have also created documentation in Confluence titled [Github Advanced Security](https://kb.extendhealth.com/x/Uwn2Ow).

## Github Advanced Security
GitHub has many features that help you improve and maintain the quality of your code. Some of these are included in all plans, such as dependency graph and Dependabot alerts. Other security features require a [GitHub Advanced Security](https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security) license to run on repositories apart from public repositories on GitHub.com.

## Our Implementation
The ghas-enablement repo dynamically creates the workflow using the following scanning frameworks:
- [CodeQL Action](https://github.com/github/codeql-action)
- [TfSec Action](https://github.com/aquasecurity/tfsec-action)
- [PSScriptAnalyzer Action](https://github.com/microsoft/psscriptanalyzer-action)

### CodeQL
[CodeQL](https://docs.github.com/en/code-security/code-scanning/automatically-scanning-your-code-for-vulnerabilities-and-errors/about-code-scanning-with-codeql) is the code analysis engine developed by GitHub to automate security checks. You can analyze your code using CodeQL and display the results as code scanning alerts. To see supported languages go to [Supported languages and frameworks](https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/).

### tfsec
[tfsec](https://github.com/aquasecurity/tfsec) uses static analysis of your terraform code to spot potential misconfigurations.. To see the Azure rule checks it uses go to [Azure Checks](https://aquasecurity.github.io/tfsec/v1.28.1/checks/azure/).

### PSScriptAnalyzer
[PSScriptAnalyzer](https://github.com/PowerShell/PSScriptAnalyzer) is a static code checker for PowerShell modules and scripts. PSScriptAnalyzer checks the quality of PowerShell code by running a [set of rules](https://github.com/PowerShell/PSScriptAnalyzer/blob/master/docs/Rules/README.md).

## Get Help
If your team requires additional help with the generated workflow please open a [Help Request Ticket](${ithdTicketUrl}) and the Purple Team will reach out to provide assistance.
`;
