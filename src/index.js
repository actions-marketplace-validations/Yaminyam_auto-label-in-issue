import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

async function run() {
  try {
    const target = context.payload.pull_request;
    if (target === undefined) {
      throw new Error("Can't get payload. Check you trigger event");
    }
    const {
      assignees,
      number,
      user: { login: author, type },
    } = target;

    if (assignees.length > 0) {
      core.info("Assigning author has been skipped since the pull request is already assigned to someone");
      return;
    }

    if (type === "Bot") {
      core.info("Assigning author has been skipped since the author is a bot");
      return;
    }
    const token = core.getInput("repo-token", { required: true });
    const octokit = getOctokit(token);

    const closing_issue_number_request = await octokit.graphql({
      query: `query {
        repository(owner: "${context.repo.owner}", name: "${context.repo.repo}") {
          pullRequest(number: ${number}) {
              id
              closingIssuesReferences (first: 50) {
                edges {
                  node {
                    id
                    body
                    number
                    title
                  }
                }
              }
          }
        }
      }`,
    });
    const closing_issue_numbers = closing_issue_number_request.repository.pullRequest.closingIssuesReferences.edges.map((edge) => edge.node.number);
    for (const closing_issue_number of closing_issue_numbers) {
      const issue_labels = await octokit.rest.issues.listLabelsOnIssue({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: closing_issue_number,
      });
      const labels = issue_labels.data.map((label) => label.name);
      const result = await octokit.rest.issues.addLabels({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: number,
        labels: labels,
      });
      core.debug(JSON.stringify(result));
      core.info(`@${author} has been assigned to the pull request: #${number}`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
