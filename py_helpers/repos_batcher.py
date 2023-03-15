import json
import multiprocessing
import os
import requests
import time

from datetime import date
from requests import Response
from shared.env_loader import EnvLoaderHelper
from shared.org_load_param import OrgLoadParam
from shared.path_helper import PathHelper, FileName
from shared.repo_lang_param import RepoLangParam
from shared.runnable_class import RunnableClass
from typing import Tuple

class ReposBatcher(RunnableClass):
    def __init__(self) -> None:
        self.envs = EnvLoaderHelper.load_envs()
        self.not_supported_prefix = "not-supported-"
        self.name_all_results = "all-org"
        self.name_org_repo_lang_results = "all-results-for-orgs-and"
        self.batch_repo_limit = self.envs.repos_per_batch
        self.code_scan_langs = {
            "javascript": "javsacript",
            "java": "java",
            "go": "go",
            "python": "python",
            "c++": "cpp",
            "c#": "csharp",
            "ruby": "ruby",
            "hcl": "hcl",
            "powershell": "powershell",
        }

        self._cleanup_increments_dir(PathHelper.get_batch_dir())
        self.path_org_repos = PathHelper.get_file_name(FileName.ORG_REPOS)
        self.path_org_repo_langs = PathHelper.get_file_name(FileName.ORG_REPO_LANGS)
        self.path_unsupported_repos = PathHelper.get_file_name(FileName.UNSUPPORTED)
        self.path_supported_repos = PathHelper.get_file_name(FileName.SUPPORTED)


    def run(self):
        all_together = self._get_all_together_results()
        all_supported = self._filter_out_unsupported(all_together)

        self._batch_results(all_supported)


    def _filter_out_unsupported(self, all_together: dict) -> dict:
        supported_repos = {
            "count": 0,
            "orgs": {}
        }
        unsupported_repos = {
            "count": 0,
            "orgs": {}
        }

        for org_name in sorted(all_together):
            print(f"Look in {org_name}")
            org_item = all_together[org_name]

            for repo_name in sorted(org_item):
                repo_item = org_item[repo_name]
                if not self._has_at_least_one_supported_language(repo_item):
                    unsupported_repos["count"] += 1

                    if org_name not in unsupported_repos["orgs"]:
                        unsupported_repos["orgs"][org_name] = {}

                    unsupported_repos["orgs"][org_name][repo_name.lower()] = repo_item

                else:
                    supported_repos["count"] += 1

                    if org_name not in supported_repos["orgs"]:
                        supported_repos["orgs"][org_name] = {}

                    supported_repos["orgs"][org_name][repo_name.lower()] = repo_item

        self._add_run_info(unsupported_repos)
        self._save_results(unsupported_repos, PathHelper.get_file_name(FileName.UNSUPPORTED))

        self._add_run_info(supported_repos)
        self._save_results(supported_repos, PathHelper.get_file_name(FileName.SUPPORTED))
        return supported_repos


    def _add_run_info(self, repos: dict):
        total = repos["count"]
        running_count = 1
        for org_name in sorted(repos["orgs"]):
            org_item = repos["orgs"][org_name]

            for repo_name in sorted(org_item):
                repo_item = org_item[repo_name]
                repo_item["runInfo"] = f"{running_count} of {total}"
                running_count += 1


    def _create_dir(self, dir: str):
        if not os.path.exists(dir):
            os.mkdir(dir)


    def _get_all_together_results(self) -> dict:
        existing = self._load_from_file_if_exists(PathHelper.get_file_name(FileName.ORG_REPO_LANGS))
        if existing:
            return existing

        else:
            org_repos = self._load_orgs_for_batch()
            total_repos = self._get_total_repos(org_repos)
            repo_lang_params = []
            running_index = 0
            for org_name in org_repos:
                for repo_name in org_repos[org_name]:
                    running_index += 1
                    repo_lang_params.append(RepoLangParam(org_name, repo_name, self.envs.github_pat, total_repos, running_index))

            pool = multiprocessing.Pool()
            org_repo_lang_list = pool.map(self._get_repo_language, repo_lang_params)
            org_repo_lang_results = {}
            for org, repo, languages in org_repo_lang_list:
                langs_with_support = self._add_not_supported_to_langs(languages)
                if org not in org_repo_lang_results:
                    org_repo_lang_results[org] = {}

                org_repo_lang_results[org][repo.lower()] = {
                    "primaryLanguage": ", ".join(langs_with_support),
                    "repo": f"{org}/{repo}"
                }

            self._save_results(org_repo_lang_results, PathHelper.get_file_name(FileName.ORG_REPO_LANGS))
            return org_repo_lang_results


    def _get_total_repos(self, org_repos: dict) -> int:
        total = 0
        for org_name in org_repos:
            total += len(org_repos[org_name])

        return total


    def _add_not_supported_to_langs(self, languages: list) -> list:
        updates_langs = []
        for language in languages:
            lang_lower = language.lower()
            if lang_lower in self.code_scan_langs:
                lang_lower = self.code_scan_langs[lang_lower]
            elif lang_lower not in self.code_scan_langs:
                lang_lower = f"{self.not_supported_prefix}{lang_lower}"

            updates_langs.append(lang_lower)

        updates_langs.sort()
        return updates_langs


    def _get_repo_language(self, param: RepoLangParam) -> Tuple[str, str, list]:
        print(f"{param.count_info}, Get Languages ... {os.linesep} ")
        response = self._run_get(param.api_url, param.headers, param.sleep_secs)
        languages = list(response.json().keys())

        return param.org_name, param.repo_name, languages


    def _load_orgs_for_batch(self) -> dict:
        existing = self._load_from_file_if_exists(PathHelper.get_file_name(FileName.ORG_REPOS))
        if existing:
            return existing

        params = []
        for org in self.envs.batch_orgs:
            params.append(OrgLoadParam(self.envs.github_pat, org))

        pool = multiprocessing.Pool()
        all_results = pool.map(self._load_org, params)

        parsed_results = {}
        for org_name, org_results in all_results:
            for repo_item in org_results:
                repo_name = repo_item["name"]
                if org_name not in parsed_results:
                    parsed_results[org_name] = []

                parsed_results[org_name].append(repo_name)

        self._save_results(parsed_results, PathHelper.get_file_name(FileName.ORG_REPOS))
        return parsed_results


    def _load_from_file_if_exists(self, path: str) -> dict:
        if os.path.exists(path):
            with open(path, "r") as reader:
                return json.load(reader)

        return None


    def _load_org(self, param: OrgLoadParam) -> Tuple[str, dict]:
        print(f"Load {param.org} Repos...")

        repos_with_code_scan = self._find_code_scan_workflows_in_org(param.org, param.headers)

        org_results = self._load_from_file_if_exists(PathHelper.get_org_repos(param.org))
        if not org_results:
            response = self._run_get(param.api_url, param.headers, param.sleep_time_secs)
            if response is None:
                print(f"Error Loading {param.org}")
                return param.org, {}

            org_results = []
            org_results.extend(response.json())
            next_url = self._get_next_url(response)
            while next_url is not None:
                response = self._run_get(next_url, param.headers, param.sleep_time_secs)
                if response is None:
                    print(f"Part-way Error Loading {param.org}")
                    return param.org, org_results

                next_url = self._get_next_url(response)
                org_results.extend(response.json())

            self._save_results(org_results, PathHelper.get_org_repos(param.org))

        updated_results = self._filter_out_results_with_code_scanning(org_results, repos_with_code_scan)

        self._save_results(updated_results, PathHelper.get_org_repos_without_code_scanning(param.org))
        return param.org, updated_results


    def _filter_out_results_with_code_scanning(self, org_results: dict, repos_with_code_scan: dict) -> dict:
        if repos_with_code_scan["total_count"] == 0:
            return org_results

        updated_results = []
        for repo_item in org_results:
            repo_name = repo_item["name"]

            has_code_scanning = False
            for code_scan_item in repos_with_code_scan["items"]:
                code_scan_repo = code_scan_item["repository"]["name"]

                if repo_name == code_scan_repo:
                    has_code_scanning = True
                    break

            if has_code_scanning:
                continue

            updated_results.append(repo_item)

        return updated_results


    def _find_code_scan_workflows_in_org(self, org_name: str, headers: dict) -> dict:
        print(f"Check for repos in {org_name} that already have code scanning...")
        existing = self._load_from_file_if_exists(PathHelper.get_org_code_scan_repos(org_name))
        if existing:
            return existing

        # https://docs.github.com/en/rest/search?apiVersion=2022-11-28#search-code
        querystring = f"org:{org_name} path:.github/workflows filename:code-analysis"
        url = f"https://api.github.com/search/code?q={querystring}"
        sleep_secs = .25
        response = self._run_get(url, headers, sleep_secs)

        results = response.json()
        print(f"{org_name} has {results['total_count']} repos with code scanning.")
        self._save_results(results, PathHelper.get_org_code_scan_repos(org_name))
        return results


    def _run_get(self, url: str, headers: dict, sleep_secs: float) -> Response:
        response = requests.get(url, headers=headers)
        time.sleep(sleep_secs)
        if not response.ok:
            print(response.text)
            return None

        return response


    def _get_next_url(self, response: Response) -> str:
        links = response.links
        if not links:
            return None

        next = links.get("next")
        if not next:
            return None

        return next.get("url")


    def _cleanup_increments_dir(self, batch_dir: str):
        files = os.listdir(batch_dir)
        for file_name in files:
            file_path = os.path.join(batch_dir, file_name)
            os.remove(file_path)


    def _get_repo_number(self, run_info: str) -> int:
        # "494 of 499"
        return int(run_info.split("of")[0].strip())


    def _batch_results(self, all_supported: dict):
        # initialize variables
        batch_count = 1
        batches = []

        for org_name in sorted(all_supported["orgs"]):
            current_org = {
                "login": org_name,
                "repos": []
            }
            batches.append(current_org)

            for repo_name_lower in sorted(all_supported["orgs"][org_name]):
                item = all_supported["orgs"][org_name][repo_name_lower]
                current_run_info = item["runInfo"]
                repo_number = self._get_repo_number(current_run_info)

                item["runInfo"] = f"(Batch {batch_count}) Repo {current_run_info}"
                current_org["repos"].append(item)

                if repo_number % self.batch_repo_limit == 0:
                    self._save_results(batches, PathHelper.get_batch_number(batch_count))

                    # reset variables
                    batch_count += 1 # increment this one
                    batches = []
                    current_org = {
                        "login": org_name,
                        "repos": []
                    }
                    batches.append(current_org)

        if batches:
            self._save_results(batches, PathHelper.get_batch_number(batch_count))


    def _save_results(self, results: dict, path: str):
        print(f"Save {path}...")
        results_str = json.dumps(results, indent=3, sort_keys=True)
        with open(path, "w") as writer:
            writer.write(results_str)


    def _has_at_least_one_supported_language(self, repo_item: dict) -> bool:
        primary_language = repo_item["primaryLanguage"]
        if primary_language == "":
            return False

        languages = primary_language.split(", ")
        for language in languages:
            if "not-supported" not in language:
                return True

        return False



if __name__ == "__main__":
    batcher = ReposBatcher()
    batcher.run()
