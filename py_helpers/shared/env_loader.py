import os

from typing import List

class EnvLoader:
    def __init__(self) -> None:
        self.github_pat: str = None
        self.batch_orgs: List[str] = None
        self.repos_per_batch: int = None

class EnvLoaderHelper:
    @staticmethod
    def load_envs() -> EnvLoader:
        envs = EnvLoader()
        envs.github_pat = os.getenv("GITHUB_API_TOKEN")
        envs.batch_orgs = os.getenv("BATCH_ORGS").split(",")
        envs.repos_per_batch = int(os.getenv("REPOS_PER_BATCH"))


        return envs
