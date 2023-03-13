import json

from shared.path_helper import PathHelper, FileName
from shared.runnable_class import RunnableClass

class ResultCruncher(RunnableClass):
    def __init__(self) -> None:
        self.key_counts_workflow = "counts-code-scan-workflows"
        self.key_counts_language_supported = "counts-language-supported"
        self.key_counts_language_unsupported = "counts-language-unsupported"
        self.key_across_orgs = "across-orgs"
        self.key_by_org = "by-org"


    def run(self):
        print("Get All Result Counts")
        org_repo_lang_results = None
        with open(PathHelper.get_file_name(FileName.ORG_REPO_LANGS), "r") as reader:
            org_repo_lang_results = json.load(reader)

        results = {
            self.key_counts_workflow: {
                self.key_across_orgs: 0,
                self.key_by_org: {}
            },
            self.key_counts_language_supported: {
                self.key_across_orgs: {},
                self.key_by_org: {},
            },
            self.key_counts_language_unsupported: {
                self.key_across_orgs: {},
                self.key_by_org: {},
            },
        }

        for org_name in org_repo_lang_results:
            org_item = org_repo_lang_results[org_name]

            for repo_name in org_item:
                repo_item = org_item[repo_name]

                primary_language = repo_item["primaryLanguage"]
                if primary_language == "":
                    continue

                languages = primary_language.split(", ")
                if self._has_a_supported_language(languages):
                    # workflow needed
                    results[self.key_counts_workflow][self.key_across_orgs] += 1

                    if org_name not in results[self.key_counts_workflow][self.key_by_org]:
                        results[self.key_counts_workflow][self.key_by_org][org_name] = 1
                    else:
                        results[self.key_counts_workflow][self.key_by_org][org_name] += 1

                for language in languages:
                    if "not-supported" in language:
                        self._add_language_count(results, self.key_counts_language_unsupported, self.key_across_orgs, language)
                        self._add_language_count(results, self.key_counts_language_unsupported, self.key_by_org, language, org_name)

                    else:
                        self._add_language_count(results, self.key_counts_language_supported, self.key_across_orgs, language)
                        self._add_language_count(results, self.key_counts_language_supported, self.key_by_org, language, org_name)


        print("Save results...")
        json_str = json.dumps(results, indent=3, sort_keys=True)
        with open(PathHelper.get_file_name(FileName.COUNTS), "w") as writer:
            writer.write(json_str)

        print("DONE!")


    def _add_language_count(self, results: dict, main_key: str, secondary_key: str, language: str, org_name: str=None):
        if org_name is None:
            if language not in results[main_key][secondary_key]:
                results[main_key][secondary_key][language] = 1
            else:
                results[main_key][secondary_key][language] += 1
        else:
            if org_name not in results[main_key][secondary_key]:
                results[main_key][secondary_key][org_name] = {}

            if language not in results[main_key][secondary_key][org_name]:
                results[main_key][secondary_key][org_name][language] = 1
            else:
                results[main_key][secondary_key][org_name][language] += 1


    def _has_a_supported_language(self, languages) -> bool:
        for language in languages:
            if "not-supported" in language:
                continue

            return True

        return False


if __name__ == "__main__":
    cruncher = ResultCruncher()
    cruncher.run()
