import * as dotenv from "dotenv";
dotenv.config({
  path: __dirname + "/../.env",
});

import { error } from "./utils/globals";
import { repoInspector } from "./utils/repoInspector";

// Loop through repos in repos.json
// Checkout repo
// Look for im-build-dotnet-ci.yml in repo
// Look in file for runs-on and windows-
// update repos.json with the runner type required for code scan
// which will be either Windows or Linux
// An example of a repo using windows is

async function start() {
  try {
    await repoInspector();
  } catch (err) {
    error(err);
  }
  return "success";
}
start();
