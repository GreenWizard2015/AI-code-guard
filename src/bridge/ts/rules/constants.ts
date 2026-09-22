export const MAX_NAME_WORDS = 3;
export const SNAKE_CASE_PATTERN = /^_?[a-z][a-z0-9]*(?:_[a-z0-9]+)*_?$/u;
export const UPPER_CASE_PATTERN = /^_?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_?$/u;
export const PASCAL_CASE_PATTERN = /^[A-Z][a-zA-Z0-9]*$/u;
export const CLASS_REFERENCE_INFO = 5;
export const CLASS_REFERENCE_WARNING = 15;
export const IGNORED_DIRECTORIES = new Set([
	'.git',
	'.pytest_cache',
	'.turbo',
	'__pycache__',
	'dist',
	'node_modules',
]);
export const IMPORT_RULE_IDS = {
	dynamic: 'dynamic-import',
	late: 'late-import',
	sys_path_mutation: 'python-sys-path-mutation',
	nested: 'nested-import',
	relative: 'relative-import',
};
