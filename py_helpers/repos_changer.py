import json
import os
import shutil


class ReposChanger:
    def __init__(self) -> None:
        self.base_path = "repo-results"
        org_names = [
            "client",
            "customer-engagement",
            "enrollment",
            "funding",
            "platform",
            "practices",
        ]
        self.all_repos = []
        for org_name in org_names:
            repos_json = self._load_repos_json(org_name)
            self.all_repos.extend(repos_json["repos"])

    def run(self):
        repo_name = input(f"Which Repo would you like to get?{os.linesep}")

        if repo_name != None:
            path_temp = "working-dir/tempGitLocations"
            children = os.listdir(path_temp)
            for child in children:
                path_child = os.path.join(path_temp, child)
                shutil.rmtree(path_child)

        repo_item = self._get_repo_by_name(repo_name)
        repos_json = [
            {
                "login": repo_item["repo"].split("/")[0].strip(),
                "repos": [
                    repo_item
                ]
            }
        ]

        path_repos_json = os.path.join("bin", "repos.json")
        with open(path_repos_json, "w") as writer:
            json_str = json.dumps(repos_json, indent=3, sort_keys=True)
            writer.write(json_str)


    def _get_repo_by_name(self, repo_name: str) -> dict:
        for item in self.all_repos:
            repo = item["repo"].lower()
            if repo_name.lower() in repo:
                return item

        print(f"Could not find repo {repo_name}")
        raise


    def _load_repos_json(self, org_name: str) -> dict:
        file_path = os.path.join(self.base_path, f"im-{org_name}-repos.json")
        with open(file_path, "r") as reader:
            return json.load(reader)[0]


if __name__ == "__main__":
    changer = ReposChanger()
    changer.run()
