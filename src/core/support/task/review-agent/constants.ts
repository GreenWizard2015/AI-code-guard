export const AI_CODE_GUARD_DIRECTORY = ".ai-code-guard";
export const REVIEW_DIRECTORY = "review";
export const RESOLVED_REVIEW_DIRECTORY = "resolved-review";
export const REVIEW_COMPLETION_FILE = "review-complete.md";
export const REVIEW_FAILURE_FILE = "agent-start-failed.md";
export const REVIEW_RUN_LOCK_DIRECTORY = ".review-run-lock";
export const REVIEW_AGENT_DIRECTORY = "agents";
export const REVIEW_STATUS_RESOLVED = "Status: Resolved";
export const ON_REVIEW_DOCUMENT = "on_review.md";
export const AGENT_DOCUMENT_DIRECTORY = "agent";
export const PATCH_ADD_FILE_PREFIX = "*** Add File: ";
export const PATCH_UPDATE_FILE_PREFIX = "*** Update File: ";
export const PATCH_DELETE_FILE_PREFIX = "*** Delete File: ";
export const PATCH_MOVE_FILE_PREFIX = "*** Move to: ";
export const WRITE_TOOL_NAME = "Write";
export const APPLY_PATCH_TOOL_NAME = "apply_patch";
export const HOOK_PRE_TOOL_USE = "PreToolUse";
export const HOOK_POST_TOOL_USE = "PostToolUse";
export const HOOK_SESSION_START = "SessionStart";
export const HOOK_STOP = "Stop";
export const HOOK_AGENT_START = "agent_start";
export const HOOK_AGENT_OUTPUT = "agent_output";
export const HOOK_AGENT_STOP = "agent_stop";
export const SHELL_ESCAPE_AMPERSAND = "_AMPERSAND_";
export const SHELL_ESCAPE_PIPE = "_PIPE_";
export const SHELL_ESCAPE_SEMICOLON = "_SEMICOLON_";
export const SHELL_ESCAPE_CARRIAGE_RETURN = "_CARRIAGE_RETURN_";
export const SHELL_ESCAPE_NEWLINE = "_NEWLINE_";
export const REVIEW_FILES_FROM_OPTION = "--files0-from";
export const REVIEW_HIDDEN_SEARCH_OPTION = "--hidden";
export const REVIEW_IGNORE_FILE_OPTION = "--ignore-file";
export const REVIEW_SEARCH_VALUE_OPTIONS: readonly string[] = [
	"-A",
	"-B",
	"-C",
	"-e",
	"-f",
	"-g",
	"-m",
	"-t",
	"-T",
	"--after-context",
	"--before-context",
	"--context",
	"--file",
	"--glob",
	"--max-count",
	"--regexp",
	"--type",
	"--type-not",
	REVIEW_IGNORE_FILE_OPTION,
];
export const REVIEW_STAGE_MUTATION_REASON = "Review mutations must stay within the active review stage prefix.";
export const REVIEW_COMPLETION_TEXT = "Architecture review completed. No confirmed major architectural defects remain.";
export const REVIEW_SOURCE_IDENTITY_PREFIX = "Source identity: ";
export const REVIEW_NO_AGENT_MESSAGE = "No review agent was selected.";
export const REVIEW_PREFIX_ARGUMENT = "--review-prefix";
export const REVIEW_PHASE_ARGUMENT = "--review-phase";
export const REVIEW_ADD_DIRECTORY_ARGUMENT = "--add-dir";
export const REVIEW_AGENT_TIMEOUT_MESSAGE = "Review agent process timed out.";
export const MAX_RETAINED_AGENT_OUTPUT_CHARACTERS = 8192;
export const ZERO_ISSUES_SUMMARY = "Total issues: 0.\nTotal files: 0.";
export const ARCHITECTURE_REVIEW_INSTRUCTIONS_HEADING = "# Architecture review agent instructions";
