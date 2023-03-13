import os

from datetime import date
from enum import Enum

class FileName(Enum):
    COUNTS = "all-counts.json"
    ORG_REPOS = "all-org-repo-results.json"
    ORG_REPO_LANGS = "all-org-repo-lang-results.json"
    SUPPORTED = "all-supported-repos.json"
    UNSUPPORTED = "all-unsupported-repos.json"

class PathHelper:
    @staticmethod
    def get_repo_results() -> str:
        path = "repo-results"
        PathHelper.verify_dir(path)

        return path

    @staticmethod
    def get_date_dir() -> str:
        date_str = date.today().strftime("%Y-%m-%d")
        repo_results = PathHelper.get_repo_results()

        path = os.path.join(repo_results, date_str)
        PathHelper.verify_dir(path)
        return path

    @staticmethod
    def get_batch_dir() -> str:
        date_dir = PathHelper.get_date_dir()

        path = os.path.join(date_dir, "batches")
        PathHelper.verify_dir(path)
        return path

    @staticmethod
    def get_bin_repos() -> str:
        return os.path.join("bin", "repos.json")

    @staticmethod
    def get_file_name(file_name: FileName) -> str:
        date_dir = PathHelper.get_date_dir()

        json_file = file_name.value

        return os.path.join(date_dir, json_file)

    @staticmethod
    def get_batch_number(batch_number: int) -> str:
        batch_dir = PathHelper.get_batch_dir()
        file_name = f"repos({batch_number}).json"

        return os.path.join(batch_dir, file_name)

    @staticmethod
    def get_org_repos(org_name: str) -> str:
        date_dir = PathHelper.get_date_dir()

        return os.path.join(date_dir, f"{org_name}-repos.json")

    @staticmethod
    def get_org_code_scan_repos(org_name: str) -> str:
        date_dir = PathHelper.get_date_dir()

        return os.path.join(date_dir, f"{org_name}-repos-with-code-scanning.json")


    def get_org_repos_without_code_scanning(org_name: str) -> str:
        date_dir = PathHelper.get_date_dir()

        return os.path.join(date_dir, f"{org_name}-repos-without-code-scanning.json")


    @staticmethod
    def get_py_helpers() -> str:
        return "py_helpers"

    @staticmethod
    def verify_dir(path):
        if not os.path.exists(path):
            os.mkdir(path)
