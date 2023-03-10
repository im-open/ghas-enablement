from enum import Enum
from pydoc import locate
from shared.path_helper import PathHelper
from shared.runnable_class import RunnableClass

class ToolName(Enum):
    PREPARE_REPO = "prepare_repo.PrepareRepo"
    PREPARE_BATCH = "prepare_batch.PrepareBatch"
    REPOS_BATCHER = "repos_batcher.ReposBatcher"
    CREATE_STATS = "result_cruncher.ResultCruncher"

class MainClass:
    def __init__(self) -> None:
        pass

    def run(self):
        print("")
        print("Type the number of the tool to run and click ENTER")
        for index, the_enum in enumerate(ToolName):
            print(f"{index+1} - {the_enum.name}")

        print("")
        number = int(input().strip())
        index_to_load = (number - 1)

        module_path = None
        for index, the_enum in enumerate(ToolName):
            if index_to_load == index:
                module_path = the_enum.value
                break

        if module_path == None:
            print(f"ERROR: Could not find Tool {number}")
            return

        the_module = locate(module_path)
        if not the_module:
            print(f"ERROR: Could not load {module_path}")
            return

        print(f"Running {module_path}...")
        print("")
        runnable_class: RunnableClass = the_module()
        runnable_class.run()

if __name__ == "__main__":
    main = MainClass()
    main.run()
