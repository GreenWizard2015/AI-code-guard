import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEST_FILE_SUFFIXES = ['.test.ts', '.test.tsx', '.test.py', '.spec.py', '_test.py'] as const;
export const TYPESCRIPT_TEST_SUFFIXES = ['.test.ts', '.test.tsx'] as const;
export const PYTHON_TEST_SUFFIXES = ['.test.py', '.spec.py', '_test.py'] as const;

export const MAX_CLASS_LINES = 150;
export const MIN_CLASS_LINES = 15;
export const MAX_CLASS_METHODS = 20;
export const MAX_CLASS_INTERFACES = 3;
export const MAX_JEST_TESTS = 15;
export const MAX_TEST_ASSERTIONS = 5;
export const MIN_FUNCTION_LINES = 3;
export const MAX_CALLABLE_CHARACTERS = 100;
export const MAX_FUNCTION_LINES = 15;
export const MIN_FILE_LINES = 15;
export const MAX_FILE_LINES = 500;
export const MIN_REVIEW_LINES = 20;
export const MAX_REVIEW_LINES = 30;
export const MAX_FUNCTION_ARGUMENTS = 5;
export const MIN_ARGUMENT_USES = 1;
export const MIN_SHARED_METHODS = 3;
export const MIN_USAGE_FILES = 1;
export const INFO_FILE_FUNCTIONS = 10;
export const MAX_FILE_FUNCTIONS = 15;
export const MIN_PER_DIRECTORY = 3;
export const MAX_PER_DIRECTORY = 40;
export const MIN_DIRECTORY_CLASSES = 3;
export const MAX_DIRECTORY_CLASSES = 15;

export const IGNORED_DIRS = new Set([
	'.ai-code-guard',
	'dist',
	'node_modules',
	'coverage',
	'__pycache__',
	'.venv',
	'.tox',
]);
export const DEFAULT_TARGET_FILES: string[] = [];

export const REPORTING_PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const REPORTING_HINT = `Solutions, from most to least invasive:
1. Try refactoring all callers and the ownership boundary.
2. If that does not fit, try extracting a focused module or stateful class and updating its dependencies.
3. Then try replacing the local pattern with an explicit function, type, or boundary.
4. Finally try the smallest local code fix.
Attempt every level in order; do not skip directly to the smallest change.
Do not revert a change just because it reveals additional problems; keep the valid improvement and address the new findings separately.
Design refactors carefully so classes remain immutable whenever possible; this is always the priority, and rule hacks are forbidden.
If a problem cannot be fixed locally, analyze it from the perspective of the calling code.`;
