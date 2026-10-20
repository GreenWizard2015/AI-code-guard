export const MAX_NAME_WORDS = 3;
export const SNAKE_CASE_PATTERN = /^_?[a-z][a-z0-9]*(?:_[a-z0-9]+)*_?$/u;
export const UPPER_CASE_PATTERN = /^_?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_?$/u;
export const UPPER_SNAKE_CASE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
export const PASCAL_CASE_PATTERN = /^[A-Z][a-zA-Z0-9]*$/u;
export const NUMERIC_NAME_PATTERN = /[0-9]/u;
export const CLASS_REFERENCE_INFO = 5;
export const CLASS_REFERENCE_WARNING = 15;
export const IGNORED_DIRECTORIES = new Set([".git", ".pytest_cache", ".turbo", "__pycache__", "dist", "node_modules"]);
export const IMPORT_RULE_IDS = {
	dynamic: "dynamic-import",
	late: "late-import",
	sys_path_mutation: "python-sys-path-mutation",
	nested: "nested-import",
	relative: "relative-import",
};
export const MODULE_FUNCTION_KIND = "function";
export const MODULE_TYPE_NAME = "types";
export const MODULE_PROTOCOL_NAME = "protocols";
export const MODULE_DECLARATION_FILES: ReadonlySet<string> = new Set([
	"constants.ts",
	"constants.py",
	"types.ts",
	"types.py",
	"protocols.ts",
	"protocols.py",
]);
export const MODULE_CONSTANT_FILES: ReadonlySet<string> = new Set(["constants.ts", "constants.py"]);
export const MODULE_TYPE_FILES: ReadonlySet<string> = new Set(["types.ts", "types.py"]);
export const MODULE_PROTOCOL_FILES: ReadonlySet<string> = new Set(["protocols.ts", "protocols.py"]);
export const PROPERTY_STATE_REQUIRED = "required";
export const PROPERTY_STATE_OPTIONAL = "optional";
export const PROPERTY_STATE_UNKNOWN = "unknown";
export const DIRECTORY_RULE_IDS = {
	minimum: "directory-min-size",
	maximum: "directory-max-size",
	source_subdirectories_maximum: "directory-max-source-subdirectories",
	class_minimum: "directory-class-min-size",
	class_maximum: "directory-class-max-size",
} as const;
