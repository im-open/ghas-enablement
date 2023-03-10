class OrgLoadParam:
    def __init__(self, pat: str, org: str, date_dir: str) -> None:
        self.api_url = f"https://api.github.com/orgs/{org}/repos"
        self.headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {pat}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self.org = org
        self.sleep_time_secs = 0.25
        self.date_dir = date_dir
