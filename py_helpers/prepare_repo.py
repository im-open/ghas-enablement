import json
import os

from datetime import date

class PrepareRepo:
    def __init__(self) -> None:
        self.org_repo_lang_results = self._load_results()
        self.bin_repos = os.path.join("bin", "repos.json")


    def run(self):
        repo_name = input(f"Please enter the name of the repo to import?{os.linesep}").lower().strip()
        repos_result = self._find_repo(repo_name)

        if not repos_result:
            print(f"Could not find {repo_name}...")

        print(f"Save to {self.bin_repos}")

        repos_str = json.dumps(repos_result, indent=3, sort_keys=True)
        with open(self.bin_repos, "w") as writer:
            writer.write(repos_str)

        print("DONE!")


    def _find_repo(self, repo_name_input: str) -> dict:
        print(f"Does {repo_name_input} exist in any github orgs?")
        results = []
        for org_name in self.org_repo_lang_results:
            org_item = self.org_repo_lang_results[org_name]
            result = {
                "login": org_name,
                "repos": []
            }
            for repo_name in org_item:
                repo_item = org_item[repo_name]

                if repo_name_input == repo_name:
                    print(f"YES, {repo_name_input} was found in {org_name}")
                    result["repos"].append(repo_item)

            if result["repos"]:
                results.append(result)
            else:
                print(f"NO, {repo_name_input} not found in {org_name}")

        return results


    def _load_results(self) -> dict:
        date_str = date.today().strftime("%Y-%m-%d")
        path_supported_repos = os.path.join("repo-results", date_str, "all-supported-repos.json")

        with open(path_supported_repos, "r") as reader:
            return json.load(reader)



if __name__ == "__main__":
    instance = PrepareRepo()
    instance.run()
