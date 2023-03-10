import json
import os

class ResultCruncher:
    def _has_at_least_one_supported(self, languages):
        has_one = False
        for raw_language in languages:
            language = raw_language.strip()
            if "not-supported" not in language:
                has_one = True
                break

        return has_one

    def run(self):
        across_orgs = "across-orgs"
        by_org = "by-org"
        all_result_sums = {}
        workflows_to_create = {
            across_orgs: 0,
            by_org: {}
        }
        for org in self.orgs:
            repos = self._load_repos(org)

            if org not in workflows_to_create[by_org]:
                workflows_to_create[by_org][org] = 0

            for item in repos["repos"]:
                languages = item["primaryLanguage"].split(",")
                repo_name = item["repo"]

                if self._has_at_least_one_supported(languages):
                    if org not in workflows_to_create[by_org]:
                        workflows_to_create[by_org][org] = 1
                    else:
                        workflows_to_create[by_org][org] += 1

                for raw_language in languages:
                    language = raw_language.strip()

                    if language not in all_result_sums:
                        all_result_sums[language] = []

                    if repo_name not in all_result_sums[language]:
                        all_result_sums[language].append(repo_name)

        total = 0
        for org in workflows_to_create[by_org]:
            total += workflows_to_create[by_org][org]

        workflows_to_create[across_orgs] = total

        all_counts = {
            across_orgs: {},
            by_org: {},
        }
        # create counts
        for language in all_result_sums:
            all_counts[across_orgs][language] = len(all_result_sums[language])
            for org_repo_name in all_result_sums[language]:
                org_name, repo_name = org_repo_name.split("/")
                if org_name not in all_counts[by_org]:
                    all_counts[by_org][org_name] = {}

                if language not in all_counts[by_org][org_name]:
                    all_counts[by_org][org_name][language] = 1
                else:
                    all_counts[by_org][org_name][language] += 1

        combined = {
            "counts-languages": all_counts,
            "counts-workflows": workflows_to_create,
            "raw-results": all_result_sums,
        }
        self._save_summation("new-totals", combined)


    def create_summations(self):
        self._save_summation(
            name="language-sums",
            sums=self._create_language_sums()
        )


    def _create_language_sums(self) -> dict:
        sums = {}
        for org in self.orgs:
            repos = self._load_repos(org)
            for repo_item in repos["repos"]:
                repo_name = repo_item["repo"]
                language = repo_item["primaryLanguage"]

                if language not in sums:
                    sums[language] = []

                sums[language].append(repo_name)

        languages = list(sums.keys())
        for language in languages:
            language_count = len(sums[language])

            if "counts" not in sums:
                sums["counts"] = {}

            sums["counts"][language] = language_count

        return sums


    def _save_summation(self, name: str, sums: dict):
        path = os.path.join("repo-results", f"{name}.json")

        contents = json.dumps(sums, indent=3, sort_keys=True)
        with open(path, "w") as writer:
            writer.write(contents)

    def _load_repos(self, org: str) -> str:
        path = f"repo-results/{org}-repos.json"

        with open(path, "r") as reader:
            items = json.load(reader)
            if len(items) == 1:
                return items[0]

            else:
                all_items = []
                for item in items:
                    all_items.extend(item)

                return all_items



if __name__ == "__main__":
    instance = ResultCruncher()
    instance.create_summations()
    instance.run()
