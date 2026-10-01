# Console architecture review instructions

ZERO LINT ISSUES IS NOT COMPLETION: a clean lint result does not replace an architectural review.

## Starting the review agent in Codex

Create a separate review agent before reviewing the project:

```text
multi_agent_v1__spawn_agent({
  fork_context: false,
  message: "Working directory: {project root}. Read {project root}/.ai-code-guard/architecture-review-agent.md. Inspect the project and write only confirmed major architectural findings to {{REVIEW_PATH}}. Do not modify source code, tests, rules, or documentation. Return the created file paths."
})
```

Never provide the private completion code to the agent.

If agent creation or the review run fails, tell the user explicitly before doing anything else:

```text
I could not start or complete the architecture-review agent: <reason>.
```

Then create `{project root}/.ai-code-guard/review/agent-start-failed.md` with only this marker,
replacing `{{REVIEW_CODE}}` with the private code printed by the linter:

```text
No issues marker: {{REVIEW_CODE}}
```

This is a skipped review, not a clean result. Do not claim that review completed. Rerun
`ai-code-guard`; if no completion code was printed, do not invent one and report the failure.

After the agent reports, always ensure that at least one review Markdown file exists, including when
no defect was found. In that case, create a review file containing the exact marker above with the
linter-supplied code. Rerun `ai-code-guard`, then fix every confirmed major defect or leave its
review file for the next run. The review is complete only after the rerun leaves no task.

If any `functions.ts`, `functions.tsx`, or `functions.py` file exists, inspect every function and report each confirmed violation of the required ownership placement. Do not treat a lint result as a substitute for inspecting the implementation and its callers.
