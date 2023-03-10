class RepoLangParam:
    def __init__(self, org_name: str, repo_name: str, pat: str, total: int, index: int) -> None:
        self.headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {pat}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self.api_url = f"https://api.github.com/repos/{org_name}/{repo_name}/languages"
        self.sleep_secs = .25
        self.org_name = org_name
        self.repo_name = repo_name
        self.count_info = f"({index} of {total}) {org_name}/{repo_name}"
