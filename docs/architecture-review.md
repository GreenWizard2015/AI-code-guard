# Console architecture review instructions

ZERO LINT ISSUES IS NOT COMPLETION: a clean lint result does not replace an architectural review.

The primary agent MUST start a separate review subagent and give it the copied `architecture-review-agent.md` instruction. The primary agent MUST grant that subagent read access to the project code and write access to the project root's `.ai-code-guard/review/` directory. The subagent must write review Markdown files only to `{{REVIEW_PATH}}` and report its findings to the primary agent.

The primary agent must not provide the private completion code to the subagent. After the subagent reports, the primary agent must fix every confirmed major architectural defect or leave its review file for the next run, then run `ai-code-guard` again.

If the subagent reports no confirmed major architectural defect, the primary agent must create at least one review Markdown file containing this exact line, replacing the placeholder with the private completion code supplied by the linter:

No issues marker: {{REVIEW_CODE}}

The primary agent must not invent or alter the completion code. The review is complete only when the rerun confirms that no review task remains.


If any `functions.ts`, `functions.tsx`, or `functions.py` file exists, inspect every function and report each confirmed violation of the required ownership placement. Do not treat a lint result as a substitute for inspecting the implementation and its callers.