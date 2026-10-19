export const RULE_DOCUMENT_DIRECTORY = "docs/rules";
export const RULE_DOCUMENT_SUFFIX = ".md";
export const TYPESCRIPT_EXTENSION = ".ts";
export const PYTHON_EXTENSION = ".py";
export const TYPESCRIPT_TEST_SUFFIX = ".test.ts";
export const PYTHON_TEST_SUFFIX = "_test.py";
export const TEST_DIRECTORY = "tests";
export const ERROR_MARKER_PATTERN = /([ \t]*)(?:#|\/\/)[ \t]*<- error[ \t]*$/gmu;
export const MARKDOWN_RANGE_ERROR = "Markdown range count must be a safe integer no greater than 10000.";
export const MARKDOWN_LOOP_VALUE_ERROR = "Markdown loop values must be scalars or objects with scalar properties.";
export const MARKDOWN_LOOP_OBJECT_ERROR = "Markdown loop objects must contain identifier keys and scalar values.";
export const MARKDOWN_CONSTANT_ERROR = "Markdown constants must have unique names and JSON values.";
export const DOCUMENTATION_REPORT_HEADER = "| Rule | Problems | Files |";
export const DOCUMENTATION_REPORT_DIVIDER = "| --- | ---: | ---: |";
export const EMPTY_DOCUMENTATION_REPORT_ROW = "| — | 0 | 0 |";
export const DOCUMENTATION_EXCLUDED_SIZE_RULES: ReadonlySet<string> = new Set([
	"file-min-size",
	"file-max-size",
	"directory-min-size",
	"directory-max-size",
	"directory-max-source-subdirectories",
	"directory-class-min-size",
	"directory-class-max-size",
]);
export const DOCUMENTATION_PROJECT_ANALYSIS_RULES: ReadonlySet<string> = new Set(["missing-import", "unused-file"]);
export const RESPONSIBILITY_RULE_PREFIX = "responsibilities";
