import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LintProjectContextStore } from "src/core/lint_project_context_store";
import { SourceText } from "src/source_text";
import type { ProjectSourceOptions } from "src/model/types/types";
import type { ReviewAgentExecutionResult } from "src/types";

export const SOURCE_OPTIONS: ProjectSourceOptions = {
	get context_state(): ProjectSourceOptions["context_state"] {
		return {
			available: false,
			value: new LintProjectContextStore(
				[],
				{
					source_reads: 0,
					typescript_parses: 0,
					python_parses: 0,
					source_records: 0,
				},
				new SourceText(),
			),
		};
	},
	entry_files: [],
};

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const HOOK_TOOL_CONTEXT = { workdir: "", shell: "", login: false };

export const DOCUMENTATION_README = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/rules/README.md");

export const REVIEW_PROGRESS_DOCUMENT = {
	"docs/agent/on_review.md": "Defects remaining to find: {N}. The minimum remaining count is 0.",
};

export const COMPLETED_REVIEW_RESULT: ReviewAgentExecutionResult = {
	provider: "codex",
	process: { exit_code: 0, stdout: "", stderr: "" },
	no_issues: true,
	message: "review completed",
};
