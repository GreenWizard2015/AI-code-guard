import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectNames } from "src/project_analysis_types";
import type { ReviewAgentExecutionResult } from "src/task_review_types";

export const EMPTY_PROJECT_NAMES: ProjectNames = {
	project_class_names: new Set(),
	python_class_names: new Set(),
	typescript_class_names: new Set(),
	project_protocol_names: new Set(),
	project_interface_names: new Set(),
	project_contract_names: new Set(),
	project_type_names: new Set(),
	project_alias_names: new Set(),
	typescript_type_names: new Set(),
	typescript_alias_names: new Set(),
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
