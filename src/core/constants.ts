import { CLI_ENTRY } from "src/constants";

export const SKIPPED_PATH_PARTS = ["/dist/", "/node_modules/", "/coverage/", "/__pycache__/", "/.venv/", "/.tox/"];
export const AST_ANALYSIS_CACHE_VERSION = 15;
export const FILE_ANALYSIS_CACHE_VERSION = 2;
export const GLOBAL_ANALYSIS_CACHE_VERSION = 2;
export const LINT_EXECUTION_CACHE_VERSION = 2;
export const CACHE_DIRECTORY = "cache";
export const CACHE_DIRECTORY_ENTRY_KIND = "directory";
export const LINT_EXECUTION_CACHE_DIRECTORY = "lint-execution";
export const LINT_EXECUTION_CACHE_FILE = "lint-result.json";
export const MINIMUM_AGENT_BATCH_SIZE = 10;
export const CLI_ENTRY_FILE = process.argv[1];
export const IS_CLI_ENTRY =
	process.argv.length >= 2 && CLI_ENTRY_FILE !== undefined && CLI_ENTRY_FILE.endsWith(CLI_ENTRY);
export const INVALID_AGENT_BATCH_SIZE_MESSAGE = "Invalid --batch-size value with --agents: expected at least 10.";
export const CACHE_INPUT_STABILITY_ATTEMPTS = 3;
export const INPUT_TOPOLOGY_CHANGED_MESSAGE =
	"Lint input topology changed while preparing the complete-analysis cache.";
export const CACHE_INPUT_CONFIRMATION_STAGE = "startup.cache-input-confirmation";
export const NODE_ENV_VARIABLE = "NODE_ENV";
export const PATH_ENV_VARIABLE = "PATH";
export const COVERAGE_PARALLEL_MODE_ARGUMENT = "--parallel-mode";
export const COVERAGE_MODULE = "coverage";
export const COVERAGE_RUN_COMMAND = "run";
export const EMPTY_SOURCE_TEXTS: ReadonlyMap<string, string> = new Map<string, string>();
