import {
	REVIEW_ABSTRACTIONS_DOCUMENT,
	REVIEW_ALGORITHMS_DOCUMENT,
	REVIEW_BOUNDARIES_DOCUMENT,
	REVIEW_DATA_LIFECYCLE_DOCUMENT,
	REVIEW_TESTS_DOCUMENT,
} from "src/constants";

export const REVIEW_PRIMARY_DOCUMENT = REVIEW_BOUNDARIES_DOCUMENT;
export const REVIEW_COMMON_DOCUMENT = "allowed-operations.md";
export const REVIEW_CLEANUP_COMMON_DOCUMENT = "cleanup-allowed-operations.md";
export const REVIEW_FINDING_DOCUMENT = "review-finding-rules.md";
export const REVIEW_PREAMBLE_DOCUMENT = "architecture-review-preamble.md";
export const REVIEW_DOCUMENT_NAMES: readonly string[] = [
	REVIEW_PRIMARY_DOCUMENT,
	REVIEW_DATA_LIFECYCLE_DOCUMENT,
	REVIEW_ALGORITHMS_DOCUMENT,
	REVIEW_TESTS_DOCUMENT,
	REVIEW_ABSTRACTIONS_DOCUMENT,
];
export const REVIEW_PREAMBLE_PLACEHOLDER = "{{REVIEW_PREAMBLE}}";
export const ALLOWED_OPERATIONS_PLACEHOLDER = "{{ALLOWED_OPERATIONS}}";
export const REVIEW_PATH_PLACEHOLDER = "{{REVIEW_PATH}}";
export const ISSUES_DOCUMENT_NAME = "issues.md";
export const REPORT_DOCUMENT_NAME = "report.md";
export const REPORT_RULE_DISPLAY_LIMIT = 10;
export const REPORT_OTHER_RULES_LABEL = "Others";
export const LINT_OUTPUT_DOCUMENT_NAME = "lint-output.md";
export const LINT_OUTPUT_DOCUMENT = "lint-output";
export const SOURCE_UNAVAILABLE = "(source unavailable)";
export const TASK_PUBLICATION_TRANSACTION_PREFIX = ".ai-code-guard-task-";
export const TASK_PUBLICATION_JOURNAL_PREPARED = "prepared";
export const TASK_PUBLICATION_JOURNAL_COMMITTED = "committed";
export const TASK_PUBLICATION_JOURNAL_PHASES: ReadonlySet<string> = new Set([
	TASK_PUBLICATION_JOURNAL_PREPARED,
	TASK_PUBLICATION_JOURNAL_COMMITTED,
]);
export const TASK_PUBLICATION_JOURNAL_RULE_FLAGS: ReadonlySet<string> = new Set(["0", "1"]);
