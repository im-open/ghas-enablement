import json
import multiprocessing
import os
import requests
import time

from datetime import date
from requests import Response
from shared.env_loader import EnvLoaderHelper
from shared.org_load_param import OrgLoadParam
from shared.repo_lang_param import RepoLangParam
from typing import List, Tuple

class ReposBatcher:
    def __init__(self) -> None:
        self.source_dir = "repo-results"
        self.target_dir = os.path.join(self.source_dir, "repo-increments")
        self.date_dir = os.path.join(self.source_dir, date.today().strftime("%Y-%m-%d"))
        self.json_paths = self._get_json_paths()
        self.repo_limit = 50
        self._cleanup_increments_dir()
        self.repos_without_scan_support = {
            "count": 0,
            "repos": {}
        }
        self.envs = EnvLoaderHelper.load_envs()
        self.not_supported_prefix = "not-supported-"
        self.name_all_results = "all-org"
        self.name_org_repo_lang_results = "all-results-for-orgs-and"

        if not os.path.exists(self.date_dir):
            os.mkdir(self.date_dir)


    def run(self):
        all_together = self._get_all_together_results()
        print("done")


        # self.repos_without_scan_support["count"] = len(self.repos_without_scan_support["repos"].keys())
        # self._save_results(self.repos_without_scan_support, os.path.join(self.target_dir, "repos-without-scan-support.json"))
        # self._save_results(all_together, os.path.join(self.source_dir, "all-together.json"))
        # self._batch_results(all_together, total_repos)


    def _get_all_together_results(self) -> dict:
        existing = self._load_from_file_if_exists(self.name_org_repo_lang_results, self.date_dir)
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
                    "repo": f"{org_name}/{repo_name}"
                }

            self._save_results(org_repo_lang_results, self._get_org_repos_path(self.name_org_repo_lang_results, self.date_dir))
            return org_repo_lang_results


    def _get_total_repos(self, org_repos: dict) -> int:
        total = 0
        for org_name in org_repos:
            total += len(org_repos[org_name])

        return total


    def _add_not_supported_to_langs(self, languages: list) -> list:
        self.code_scan_langs = {
            "javascript": "javscript",
            "java": "java",
            "go": "go",
            "python": "python",
            "c++": "cpp",
            "c#": "csharp",
            "ruby": "ruby",
            "hcl": "hcl",
            "powershell": "powershell",
        }
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
        existing = self._load_from_file_if_exists(self.name_all_results, self.date_dir)
        if existing:
            return existing

        params = []
        for org in self.envs.batch_orgs:
            params.append(OrgLoadParam(self.envs.github_pat, org, self.date_dir))

        pool = multiprocessing.Pool()
        all_results = pool.map(self._load_org, params)

        parsed_results = {}
        for org_name, org_results in all_results:
            for repo_item in org_results:
                repo_name = repo_item["name"]
                if org_name not in parsed_results:
                    parsed_results[org_name] = []

                parsed_results[org_name].append(repo_name)

        self._save_results(parsed_results, self._get_org_repos_path(self.name_all_results, self.date_dir))
        return parsed_results


    def _load_from_file_if_exists(self, org: str, date_dir: str) -> dict:
        org_repos_path = self._get_org_repos_path(org, date_dir)
        if os.path.exists(org_repos_path):
            with open(org_repos_path, "r") as reader:
                return json.load(reader)

        return None


    def _get_org_repos_path(self, org: str, date_dir: str) -> str:
        org_repos_path = os.path.join(date_dir, f"{org}-repos.json")
        return org_repos_path


    def _load_org(self, param: OrgLoadParam) -> Tuple[str, dict]:
        print(f"Load {param.org} Repos...")
        existing = self._load_from_file_if_exists(param.org, param.date_dir)
        if existing:
            return param.org, existing

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

        self._save_results(org_results, self._get_org_repos_path(param.org, param.date_dir))
        return param.org, org_results


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


    def _cleanup_increments_dir(self):
        files = os.listdir(self.target_dir)
        for file_name in files:
            file_path = os.path.join(self.target_dir, file_name)
            os.remove(file_path)


    def _batch_results(self, all_together: dict, total_repos: int):
        # initialize variables
        batch_count = 1
        repos_in_batch_count = 1
        batches = []

        # get total repos for run info

        for org_name in sorted(all_together):
            current_org = {
                "login": org_name,
                "repos": []
            }
            batches.append(current_org)

            for repo_name_lower in sorted(all_together[org_name]):
                item = all_together[org_name][repo_name_lower]
                item["runInfo"] = f"Batch {batch_count}, Repo {repos_in_batch_count} of {total_repos}"
                current_org["repos"].append(item)
                repos_in_batch_count += 1

                if repos_in_batch_count % self.repo_limit == 0:
                    path_batch = os.path.join(self.target_dir, f"repos({batch_count}).json")
                    self._save_results(batches, path_batch)

                    # reset variables
                    batch_count += 1 # increment this one
                    batches = []
                    current_org = {
                        "login": org_name,
                        "repos": []
                    }
                    batches.append(current_org)

        if batches:
            path_batch = os.path.join(self.target_dir, f"repos({batch_count}).json")
            self._save_results(batches, path_batch)


    def _save_results(self, results: dict, path: str):
        print(f"Save {path}...")
        results_str = json.dumps(results, indent=3, sort_keys=True)
        with open(path, "w") as writer:
            writer.write(results_str)


    def _has_at_least_one_supported_language(self, repo_item: dict) -> bool:
        languages = repo_item["primaryLanguage"].split(", ")
        for language in languages:
            if "not-supported" not in language:
                return True

        repo_name = repo_item["repo"].lower()

        self.repos_without_scan_support["repos"][repo_name] = repo_item
        return False


    def _read_as_one(self) -> Tuple[dict, int]:
        all_together = {}
        total_repos = 0
        for json_path in self.json_paths:
            repo_dict = []
            with open(json_path, "r") as reader:
                repo_dict = json.load(reader)

            org_name = repo_dict[0]["login"]
            if "login" not in all_together:
                all_together[org_name] = {}

            for repo_item in repo_dict[0]["repos"]:
                if not self._has_at_least_one_supported_language(repo_item):
                    continue

                key = repo_item["repo"].lower()
                total_repos += 1
                all_together[org_name][key] = repo_item

        return all_together, total_repos


    def _get_json_paths(self) -> list:
        json_paths = []
        file_names = os.listdir(self.source_dir)
        for file_name in file_names:
            if file_name.startswith("im-") and file_name.endswith(".json"):
                json_paths.append(os.path.join(self.source_dir, file_name))

        return json_paths



if __name__ == "__main__":
    batcher = ReposBatcher()
    batcher.run()
