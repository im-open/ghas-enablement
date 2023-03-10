import os

from datetime import date
from shared.path_helper import PathHelper

class PrepareBatch:
    def __init__(self) -> None:
        self.batch_lookups = self._create_batch_lookups()


    def run(self):
        value = input(f"Which Batch Number would you like to import next?{os.linesep}")
        batch_number = int(value.strip())

        print(f"Received {batch_number}")
        if batch_number not in self.batch_lookups:
            print(f"ERROR: Could not find batch number {batch_number}")
            return


        batch_path = self.batch_lookups[batch_number]
        print(f"Load {batch_path}...")
        batch_contents = None
        with open(batch_path, "r") as reader:
            batch_contents = reader.read()

        bin_repos = PathHelper.get_bin_repos()
        print(f"Write to {bin_repos}...")
        with open(bin_repos, "w") as writer:
            writer.write(batch_contents)

        print("DONE!")


    def _create_batch_lookups(self):
        batch_lookups = {}
        path_batches = PathHelper.get_batch_dir()

        files = os.listdir(path_batches)
        for file_name in files:
            before_close = file_name.split(")")[0]
            after_open = before_close.split("(")[1]
            batch_number = int(after_open)

            batch_lookups[batch_number] = os.path.join(path_batches, file_name)

        return batch_lookups


if __name__ == "__main__":
    instance = PrepareBatch()
    instance.run()
