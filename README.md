# GitHub Advanced Security - Code Scanning, Secret Scanning & Dependabot Bulk Enablement Tooling

## General Information

For general information about our implementation of Github Advanced Security you can see our documentation in Confluence [here](https://kb.extendhealth.com/x/Uwn2Ow).

## Purpose

The purpose of this tool is to help enable GitHub Advanced Security (GHAS) across multiple repositories in an automated way. There will be times when you need the ability to enable Code Scanning (CodeQL), Secret Scanning, Dependabot Alerts, and/or Dependabot Security Updates across various repositories, and you don't want to click buttons manually or drop a GitHub Workflow for CodeQL into every repository. Doing this is manual and painstaking. The purpose of this utility is to help automate these manual tasks.

## Context

The primary motivator for this utility is CodeQL. It is incredibly time-consuming to enable CodeQL across multiple repositories. Additionally, no API allows write access to the `.github/workflow/` directory. So this means teams have to write various scripts with varying results. This tool provides a tried and proven way of doing that.

Secret Scanning & Dependabot is also hard to enable if you only want to enable it on specific repositories versus everything. This tool allows you to do that easily.

## What does this tooling do?

There are two main actions this tool does:

**Part One:**

Goes and collects repositories that will have Code Scanning (CodeQL)/Secret Scanning/Dependabot Alerts/Dependabot Security Updates enabled. There are three main ways these repositories are collected.

- Collect the repositories where the primary language matches a specific value. For example, if you provide JavaScript, all repositories will be collected where the primary language is, Javascript.
- Collect the repositories to which a user has administrative access, or a GitHub App has access.

If you select option 1, the script will return all repositories in the language you specify (which you have access to). The repositories collected from this script are then stored within a `repos.json` file. If you specify option 2, the script will return all repositories you are an administrator over. The third option is to define the `repos.json` manually. We don't recommend this, but it's possible. If you want to go down this path, first run one of the above options for collecting repository information automatically, look at the structure, and build your fine of the laid out format.

**Part Two:**

Loops over the repositories found within the `repos.json` file and enables Code Scanning(CodeQL)/Secret Scanning/Dependabot Alerts/Dependabot Security Updates/Secret Scanning Push Protection.

If you pick Code Scanning:

- Loops over the repositories found within the `repos.json` file. A pull request gets created on that repository with the `code-analysis.yml` found in the `bin/workflows` directory. For convenience, all pull requests made will be stored within the `prs.txt` file, where you can see and manually review the pull requests after the script has run.

If you pick Secret Scanning:

- Loops over the repositories found within the `repos.json` file. Secret Scanning is then enabled on these repositories.

If you pick Dependabot Alerts:

- Loops over the repositories found within the `repos.json` file. Dependabot Alerts is then enabled on these repositories.

If you pick Dependabot Security Updates:

- Loops over the repositories found within the `repos.json` file. Dependabot Security Updates is then enabled on these repositories.

## Prerequisites

- [Node v18](https://nodejs.org/en/download/) or higher installed.
- [Yarn](https://yarnpkg.com/)\*
- [TypeScript](https://www.typescriptlang.org/download)
- [Git](https://git-scm.com/downloads) installed on the (user's) machine running this tool.
- A Personal Access Token (PAT) that has at least admin access over the repositories they want to enable Code Scanning on.
- Some basic software development skills, e.g., can navigate their way around a terminal or command prompt.

* You can use `npm` but for the sake of this `README.md`; we are going to standardise the commands on yarn. These are easily replaceable though with `npm` commands.

## Set up Instructions

1.  Clone this repository onto your local machine.

    ```bash
    git clone https://github.com/NickLiffen/ghas-enablement.git
    ```

1.  Change the directory to the repository you have just installed.

    ```bash
    cd ghas-enablement
    ```

1.  Generate your chosen [Personal Access Token (PAT)](https://github.com/settings/tokens/new). The GitHub App needs to have permissions of `read and write` of `administration`, `Code scanning alerts`, `contents`, `issues`, `pull requests`, `workflows`. The GitHub PAT needs access to `repo`, `workflow` and `read:org` only. (if you are running `yarn run getOrgs` you will also need the `read:enterprise` scope).

1.  Copy the `.env.sample` to `.env`. On a Mac, this can be done via the following terminal command:

    ```bash
    cp .env.sample .env
    ```

1.  Update the `.env` with the required values. Please pick one of the authentication methods for interacting with GitHub. You can either fill in the `GITHUB_API_TOKEN` with a PAT that has access to the Org. OR, fill in all the values required for a GitHub App. **Note**: It is recommended to pick the GitHub App choice if running on thousands of repositories, as this gives you more API requests versus a PAT.

1.  Update the `GITHUB_ORG` value found within the `.env`. Remove the `XXXX` and replace that with the name of the GitHub Organisation you would like to use as part of this script.

1.  Update the `LANGUAGE_TO_CHECK` value found within the `.env`. Remove the `XXXX` and replace that with the language you would like to use as a filter when collecting repositories. **Note**: Please make sure these are lowercase values, such as: `javascript`, `python`, `go`, `ruby`, `hcl`, `powershell`, etc.

1.  Update the `ITHD_TICKET_URL` value with the url for the ITHD ticket that can be created by teams when they are having trouble getting the Github Advanced Security workflow running successfully. The URL should be to the ticket type that is sent to the Purple Team.

1.  Decide what you want to enable. Update the `ENABLE_ON` value to choose what you want to enable on the repositories found within the `repos.json`. This can be one or multiple values. If you are enabling just code scanning (CodeQL) you will need to set `ENABLE_ON=codescanning`, if you are enabling everything, you will need to set `ENABLE_ON=codescanning,secretscanning,pushprotection,dependabot,dependabotupdates`. You can pick one, two or three. The format is a comma-seperated list.

1.  **OPTIONAL**: Update the `CREATE_ISSUE` value to `true/false` depending on if you would like to create an issue explaining the purpose of the PR. We recommend this, as it will help explain why the PR was created; and give some context. However, this is optional. The text which is in the issue can be modified and found here: `./src/utils/text/`.

1.  **OPTIONAL**: If you would like the Pull Request, for Code Scanning, to be created as a [Draft](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests#draft-pull-requests) add `CREATE_DRAFT_PR` and set it to `true`. Otherwise the Pull Request will be set as `Ready for review`.

1.  **OPTIONAL**: The title to give to the Code Scanning Pull Request. If this is empty `Github Advanced Security - Code Scanning` will be used.

1.  If you are enabling Code Scanning (CodeQL), check the `code-analysis.yml` file. This is a sample file; please configure this file to suit your repositories needs.

1.  Run `yarn install` or `npm install`, which will install the necessary dependencies.

1.  Run `yarn run build` or `npm run build`, which will create the JavaScript bundle from TypeScript.

## How to use?

There are two simple steps to run:

### Step One

The first step is collecting the repositories you would like to run this script on. You have three options as mentioned above. Option 1 is automated and finds all the repositories within an organisation you have admin access to. Option 2 is automated and finds all the repositories within an organisation based on the language you specify. Or, Option 3, which is a manual entry of the repositories you would like to run this script on. See more information below.

**OPTION 1** (Preferred)

```bash
yarn run getRepos // In the `.env` set the `LANGUAGE_TO_CHECK=` to the language. E.G `python`, `javascript`, `go`, `hcl`, `powershell`, etc.
```

**Note**: The property can also be left blank, `LANGUAGE_TO_CHECK=`, and it will get all languages that the repo states to have.

When using GitHub Actions, we commonly find (especially for non-build languages such as JavaScript) that the `code-analysis.yml` file is repeatable and consistent across multiple repositories of the same language. About 80% of the time, teams can reuse the same workflow files for the same language. For Java, C++ that number drops down to about 60% of the time. But the reason why we recommend enabling Code Scanning at bulk via language is the `code-analysis.yml` file you propose within the pull request has the highest chance of being most accurate. Even if the file needs changing, the team reviewing the pull request would likely only need to make small changes. We recommend you run this command first to get a list of repositories to enable Code Scanning. After running the command, you are welcome to modify this file. Just make sure it's a valid JSON file if you do edit.

This script only returns repositories where CodeQL results have not already been uploaded to code scanning. If any CodeQL results have been uploaded to a repositories code scanning feature, that repository will not be returned to this list. The motivation behind this is not to raise pull requests on repositories where CodeQL has already been enabled.

**OPTION 2**

```bash
yarn run getRepos // or npm run getRepos
```

Similar to step one, another automated approach is to enable by user access. This approach will be a little less accurate as the file will most certainly need changing between a Python project and a Java project (if you are enabling CodeQL), and the user's PAT you are using will most likely. But the file you propose is going to be a good start. After running the command, you are welcome to modify this file. Just make sure it's a valid JSON file if you do edit.

This script only returns repositories where CodeQL results have not already been uploaded to code scanning. If any CodeQL results have been uploaded to a repositories code scanning feature, that repository will not be returned to this list. The motivation behind this is not to raise pull requests on repositories where CodeQL has already been enabled.

**OPTION 3**

Create a file called `repos.json` within the `./bin/` directory. This file needs to have an array of organization objects, each with its own array of repository objects. The structure of the objects should look like this:

```JSON
[
  {
    "login": "string <org>",
    "repos":
    [
      {
        "primaryLanguage": "csv of repo languages that are supported",
        "repo": "string <org/repo>",
      }
    ]
  }
]
```

As you can see, the object takes a number of boolean keys:

- `primaryLanguage`
  - Comma separated list of supported Code Scan languages that the repo has:
    - javascript
    - java
    - go
    - python
    - cpp (C++)
    - csharp (C#)
    - ruby
    - hcl (Terraform)
    - powershell
- `repo`
  - The name of the repo in the following syntax: `org-name/repo-name`.

**NOTE:** The account that generated the PAT needs to have `write` access or higher over any repository that you include within the `repos` key.

**OPTION 4**

Option 4 supports enabling GHAS in batches. New code, which has been written in python, has been written to handle this. A new property in the `.env` file has been created called `BATCH_ORGS`. This is a comma-separated list of github organization names (no spaces should exist in between commas). This option will asynchronously lookup orgs, repos and their languages, and whether they already have the code scanning workflow this tool creates.

> Note: In order to save API calls results are saved in `repo-results/YYYY-MM-DD` directory.

How to Run the batching functionality to create `repos.json` files:

1. Set `REPOS_PER_BATCH` value in `.env` file.
1. Run the debug configuration `Python: Main` and select option 3 `REPOS_BATCHER` by typing `3` and pressing `ENTER`
   - The batched repos.json files are saved to `repo-results/YYYY-MM-DD/batches`
1. Run `Python: Main` again but this time select selection option 2 `PREPARE_BATCH` by typing `2` and pressing `ENTER`
   - Enter the batch number that will be run by typing the number and pressing `ENTER`.
1. Run what is in [Step Two](#step-two)
1. Run this over and over again until all batches have been run.

### Step Two

Run the script which enables Code Scanning (and/or Dependabot Alerts/Dependabot Security Updates/Secret Scanning) on your repository by running:

```bash
yarn run start // or npm run start
```

This will run a script, and you should see output text appearing on your screen.

After the script has run, please head to your `~/Desktop` directory and delete the `tempGitLocations` directory that has been automatically created.

The reason you need this within your `.devcontainer/devcontainer.json` file is the `GITHUB_TOKEN` tied to the Codespace will need to access other repositories within your organisation which this script may interact with. You will need to create a new Codespace **after** you have added the above and pushed it to your repository.

# About Original Parent Repo

This repository was originally created as a fork of [ghas-enablement](https://github.com/NickLiffen/ghas-enablement). It has, since, been converted to a standalone repository that is disconnected from the parent. This repo has had a lot of changes made to it to make it more customizable for our specific needs.

## Found an Issue?

If using this internally at WTW create an ITHD ticket and assign it to the Purple Team if not you can also go to [Issues](https://github.com/im-open/ghas-enablement/issues) and create one here. Be sure to include specific information like:

- Windows, Linux, Mac
- What version of NodeJS you are running.
- Add any logs that appeared when you ran into the issue.
