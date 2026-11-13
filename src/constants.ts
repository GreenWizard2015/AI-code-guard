import type { TestPathSuffixes } from "src/testing_protocols";

import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import type { DiagnosticRuleData, TaskReportDiagnosticScope } from "src/model/types";
import type { TypeScriptModuleCache } from "src/module-resolution/types";
import { ARCHITECTURE_RULE_DATA } from "src/rules/catalog/architecture/constants";
import { MODULES_RULE_DATA } from "src/rules/catalog/modules/constants";
import { NAMING_RULE_DATA } from "src/rules/catalog/naming/constants";
import { QUALITY_RULE_DATA } from "src/rules/catalog/quality/constants";
import { TESTING_RULE_DATA } from "src/rules/catalog/testing/constants";
import { TYPES_RULE_DATA } from "src/rules/catalog/types/constants";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { SourceReferenceRelation } from "src/source_types";
import type { ReviewStageDefinition } from "src/task_review_types";
import type { TypeScriptPropertySide } from "src/types";
import ts from "typescript";

export const MISSING_CACHE_VALUE = "<missing>";
export const REMOVED_SKIP_REVIEW_MESSAGE = "--skip-review was removed; omit --review-agent to skip review.";
export const MARKDOWN_TEXT_SUFFIXES: ReadonlySet<string> = new Set([".md", ".markdown", ".mdown", ".mkdn"]);
export const RULE_DOCUMENT_DIRECTORY = "docs/rules";
export const TEST_RUNNER_DIRECTORY = "test-runner";
export const DOCUMENTATION_VALIDATION_DIRECTORY = "documentation_validation";
export const TYPESCRIPT_TREE_METADATA_FLAGS = {
	import_symbol: 1,
	named_symbol: 2,
	import_issue: 4,
	type_declaration: 8,
	property_access: 16,
	identifier: 32,
	literal: 64,
	source_line: 128,
	call_reference: 256,
} as const;
export const RULE_DATA = {
	...TESTING_RULE_DATA,
	...TYPES_RULE_DATA,
	...NAMING_RULE_DATA,
	...ARCHITECTURE_RULE_DATA,
	...MODULES_RULE_DATA,
	...QUALITY_RULE_DATA,
} as const;
export const TASK_REPORT_DIRECTORY_SCOPE: TaskReportDiagnosticScope = "directory";
export const TASK_REPORT_FILE_PLACEMENT_SCOPE: TaskReportDiagnosticScope = "file-placement";
export const UNCLASSIFIED_TASK_REPORT_SCOPE: TaskReportDiagnosticScope = "unclassified";
export const RULE_DATA_BY_ID = new Map<string, DiagnosticRuleData>();
for (const [rule_id, data] of Object.entries(RULE_DATA)) {
	const rule_data: DiagnosticRuleData = {
		task_report_scope: UNCLASSIFIED_TASK_REPORT_SCOPE,
		...data,
	};
	const task_report_scope = rule_data.task_report_scope ?? UNCLASSIFIED_TASK_REPORT_SCOPE;
	const normalized_rule_data = { ...rule_data, task_report_scope };
	RULE_DATA_BY_ID.set(rule_id, normalized_rule_data);
}
export const RULE_LANGUAGE_BY_ID = new Map<string, AstLanguage>(
	Object.entries({
		"typescript-contract-getter": "typescript",
		"typescript-overload": "typescript",
		"typescript-type-assertion": "typescript",
		"python-test-shape": "python",
		"python-test-class-inheritance": "python",
		"python-test-framework-consistency": "python",
		"python-test-assert": "python",
		"python-test-assert-ending": "python",
		"python-test-assertion-alias": "python",
		"python-explicit-parameter-type": "python",
		"python-all-list-assignment": "python",
		"python-explicit-field-type": "python",
		"python-string-type-annotation": "python",
		"typescript-in-operator": "typescript",
		"python-test-assert-statement": "python",
		"python-test-subtest": "python",
		"typescript-static-method": "typescript",
		"typescript-static-field": "typescript",
		"python-static-method": "python",
		"python-class-method": "python",
		"python-data-class-method": "python",
		"python-abstract-class": "python",
		"python-property-setter": "python",
		"python-property": "python",
		"typescript-getter": "typescript",
		"typescript-setter": "typescript",
		"typescript-prototype-assignment": "typescript",
		"python-type-factory": "python",
		"python-type-cast": "python",
		"python-optional-union": "python",
		"python-conditional-type-alias": "python",
		"typescript-type-guard": "typescript",
		"typescript-union-contract-bypass": "typescript",
		"typescript-rest-union-contract": "typescript",
		"typescript-index-signature": "typescript",
		"python-multi-except": "python",
		"typescript-typeof": "typescript",
		"python-isinstance": "python",
		"typescript-instanceof": "typescript",
		"python-object-setattr": "python",
		"typescript-object-prototype-string": "typescript",
		"typescript-object-assign": "typescript",
		"typescript-object-method-call": "typescript",
		"typescript-logical-assignment": "typescript",
		"typescript-conditional-block": "typescript",
		"python-elif": "python",
		"python-assignment-expression": "python",
		"typescript-console-mock-in-test": "typescript",
		"typescript-console-in-test": "typescript",
		"python-direct-class-init": "python",
		"python-call-method": "python",
		"typescript-explicit-visibility": "typescript",
		"typescript-mutable-field": "typescript",
		"typescript-fake-object": "typescript",
		"typescript-object-literal-return": "typescript",
		"typescript-jest-min-size": "typescript",
		"typescript-jest-max-size": "typescript",
		"typescript-jest-describe-count": "typescript",
		"typescript-jest-nested-describe": "typescript",
		"typescript-jest-test-ending": "typescript",
		"typescript-jest-test-lambda": "typescript",
		"typescript-jest-test-expect": "typescript",
		"typescript-jest-type-only-test": "typescript",
		"typescript-bare-type-alias": "typescript",
		"typescript-singular-plural-alias": "typescript",
		"typescript-parameter-property": "typescript",
		"typescript-interface-shape": "typescript",
		"typescript-class-callback-fields": "typescript",
		"typescript-bind": "typescript",
		"typescript-dynamic-runtime-usage": "typescript",
		"python-sys-path-mutation": "python",
		"typescript-module-constant-case": "typescript",
		"typescript-module-variable": "typescript",
		"typescript-namespace-file": "typescript",
		"typescript-unknown-parameter-type": "typescript",
		"typescript-dictionary-return": "typescript",
		"typescript-type-operation": "typescript",
		"typescript-inline-object-type": "typescript",
		"typescript-inline-union-type": "typescript",
		"typescript-module-namespace-dependency": "typescript",
		"typescript-literal-object-access": "typescript",
	} as const),
);
export const LANGUAGE_NEUTRAL_RULE_IDS: ReadonlySet<string> = new Set([
	"ai-code-guard-directory-ignored",
	"numeric-file-name",
]);
export const SHARED_RULE_DOCUMENT_IDS: ReadonlySet<string> = new Set([
	"directory-class-max-size",
	"directory-class-min-size",
	"directory-max-size",
	"directory-max-source-subdirectories",
	"directory-min-size",
]);
export const RULE_DOCUMENT_PATHS_BY_ID = new Map<string, readonly string[]>(
	Object.keys(RULE_DATA).map((rule_id) => {
		const language = RULE_LANGUAGE_BY_ID.get(rule_id);
		if (language !== undefined) {
			const prefix = `${language}-`;
			let document_id = rule_id;
			if (rule_id.startsWith(prefix)) {
				document_id = rule_id.slice(prefix.length);
			}
			return [rule_id, [`${RULE_DOCUMENT_DIRECTORY}/${language}/${document_id}.md`]];
		}
		if (LANGUAGE_NEUTRAL_RULE_IDS.has(rule_id) || SHARED_RULE_DOCUMENT_IDS.has(rule_id)) {
			return [rule_id, [`${RULE_DOCUMENT_DIRECTORY}/${rule_id}.md`]];
		}
		return [
			rule_id,
			[`${RULE_DOCUMENT_DIRECTORY}/typescript/${rule_id}.md`, `${RULE_DOCUMENT_DIRECTORY}/python/${rule_id}.md`],
		];
	}),
);

export const REVIEW_BOUNDARIES_DOCUMENT = "architecture-review-boundaries.md";
export const REVIEW_DATA_LIFECYCLE_DOCUMENT = "architecture-review-data-lifecycle.md";
export const REVIEW_ALGORITHMS_DOCUMENT = "architecture-review-algorithms.md";
export const REVIEW_TESTS_DOCUMENT = "architecture-review-tests.md";
export const REVIEW_ABSTRACTIONS_DOCUMENT = "architecture-review-abstractions.md";

export const TEST_FILE_SUFFIXES = [
	".test.ts",
	".test.tsx",
	".spec.ts",
	".spec.tsx",
	".test.py",
	".spec.py",
	"_test.py",
] as const;
export const TYPESCRIPT_TEST_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"] as const;
export const PYTHON_TEST_SUFFIXES = [".test.py", ".spec.py", "_test.py"] as const;
export const TEST_PATH_SUFFIXES: TestPathSuffixes = {
	test_file: TEST_FILE_SUFFIXES,
	typescript: TYPESCRIPT_TEST_SUFFIXES,
	python: PYTHON_TEST_SUFFIXES,
};

export const MAX_CLASS_LINES = 150;
export const MIN_CLASS_LINES = 15;
export const MAX_CLASS_METHODS = 20;
export const MAX_CLASS_INTERFACES = 3;
export const MIN_TESTS_PER_SUITE = 2;
export const MAX_TESTS_PER_SUITE = 15;
export const MAX_TEST_ASSERTIONS = 5;
export const MIN_JEST_ASSERTIONS = 3;
export const MIN_FUNCTION_LINES = 3;
export const MIN_TEST_LINES = 3;
export const MAX_CALLABLE_CHARACTERS = 100;
export const MAX_FUNCTION_LINES = 15;
export const MAX_TEST_LINES = 15;
export const MIN_FILE_LINES = 15;
export const MAX_FILE_LINES = 500;
export const MIN_REVIEW_LINES = 20;
export const MAX_REVIEW_LINES = 30;
export const REVIEW_FINDING_TARGET = 10;
export const MAX_FUNCTION_ARGUMENTS = 5;
export const MAX_CALLABLE_NESTING_DEPTH = 3;
export const MAX_CALLABLE_BRANCHES = 10;
export const MAX_COMPOSITION_DEPTH = 3;
export const MAX_CONSTRUCTOR_DEPENDENCIES = 5;
export const MAX_IMPORT_FAN_OUT = 20;
export const PYTHON_TESTCASE_BASE = "unittest.TestCase";
export const PYTHON_UNITTEST_FRAMEWORK = "unittest";
export const MODULE_CACHE_KEY_SEPARATOR = "\u0000";
export const MODULE_CACHE_DISK_SCOPE = "disk";
export const MODULE_CACHE_SNAPSHOT_SCOPE = "snapshot";
export const SHARED_MODULE_CACHES = new WeakMap<
	ReadonlyMap<string, ts.SourceFile>,
	WeakMap<ProjectSourceIOContract, TypeScriptModuleCache>
>();
export const IMPORT_KINDS = new Set([ts.SyntaxKind.ImportDeclaration, ts.SyntaxKind.ImportEqualsDeclaration]);
export const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".py"]);
export const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage"]);
export const PROJECT_PREFIXES = ["packages/", "scripts/", "tools/", "tests/"];
export const INSTANCE_PROPERTY_SIDE: TypeScriptPropertySide = "instance";
export const STATIC_PROPERTY_SIDE: TypeScriptPropertySide = "static";
export const VISIBILITY_MODIFIERS = [
	ts.SyntaxKind.PublicKeyword,
	ts.SyntaxKind.ProtectedKeyword,
	ts.SyntaxKind.PrivateKeyword,
];
export const TEMPORAL_FIELD_READ_EFFECT = { read: true, write: false };
export const TEMPORAL_FIELD_WRITE_EFFECT = { read: false, write: true };
export const TEMPORAL_FIELD_READ_WRITE_EFFECT = { read: true, write: true };
export const JEST_DESCRIBE_NAME = "describe";
export const JEST_BEFORE_EACH_NAME = "beforeEach";
export const JEST_AFTER_EACH_NAME = "afterEach";
export const JEST_BEFORE_ALL_NAME = "beforeAll";
export const JEST_AFTER_ALL_NAME = "afterAll";
export const JEST_SHARED_MUTATION_METHODS = new Set(["add", "delete", "push", "set", "update"]);
export const JEST_ANY = "any";
export const JEST_ANY_VALUES = new Set(["any", "anything"]);
export const JEST_SHAPES = new Set(["toEqual", "toStrictEqual"]);
export const JEST_PROPERTY = "toHaveProperty";
export const JEST_DEFINED = "toBeDefined";
export const JEST_EXCEPTIONS = new Set([
	"toThrow",
	"toThrowError",
	"toThrowErrorMatchingSnapshot",
	"toThrowErrorMatchingInlineSnapshot",
]);
export const JEST_INSTANCE = "toBeInstanceOf";
export const JEST_OBJECT = "objectContaining";
export const TYPESCRIPT_OBJECT_STRING_METHOD = "toString";
export const TYPESCRIPT_OBJECT_OWN_PROPERTY_METHOD = "hasOwnProperty";
export const TYPESCRIPT_SAFE_OBJECT_METHOD_NAMES: ReadonlySet<string> = new Set([
	TYPESCRIPT_OBJECT_STRING_METHOD,
	TYPESCRIPT_OBJECT_OWN_PROPERTY_METHOD,
]);
export const DOCUMENTATION_FUNCTIONS_MODULE_NAME = "functions";
export const MIN_ARGUMENT_USES = 1;
export const MIN_SHARED_METHODS = 3;
export const MIN_USAGE_FILES = 1;
export const MIN_PER_DIRECTORY = 3;
export const MAX_PER_DIRECTORY = 40;
export const MAX_SOURCE_SUBDIRECTORIES = 10;
export const MIN_DIRECTORY_CLASSES = 3;
export const MAX_DIRECTORY_CLASSES = 15;

export const REVIEW_STAGES: readonly ReviewStageDefinition[] = [
	{
		id: "boundaries",
		prefix: "review-boundaries-",
		focus: "SOLID, GRASP, separation of concerns, cohesion, coupling, and dependency direction.",
		document: REVIEW_BOUNDARIES_DOCUMENT,
	},
	{
		id: "data-lifecycle",
		prefix: "review-data-lifecycle-",
		focus: "state transitions, ownership, mutation, error handling, and observable behavior.",
		document: REVIEW_DATA_LIFECYCLE_DOCUMENT,
	},
	{
		id: "algorithms",
		prefix: "review-algorithms-",
		focus: "repeated work, unnecessary traversal, scalability risks, and concrete optimization opportunities.",
		document: REVIEW_ALGORITHMS_DOCUMENT,
	},
	{
		id: "tests",
		prefix: "review-tests-",
		focus: "missing important coverage, duplicated stronger invariants, and obsolete tests causing maintenance risk.",
		document: REVIEW_TESTS_DOCUMENT,
	},
	{
		id: "abstractions",
		prefix: "review-abstractions-",
		focus: "domain objects and abstractions that clarify ownership or remove real complexity.",
		document: REVIEW_ABSTRACTIONS_DOCUMENT,
	},
];
export const AI_CODE_GUARD_DIRECTORY = ".ai-code-guard";
export const GITIGNORE_FILE_NAME = ".gitignore";
export const GITIGNORE_PROBE_NAME = ".gitignore-probe";
export const TYPESCRIPT_LANGUAGE: AstLanguage = "typescript";
export const PYTHON_LANGUAGE = "python";
export const PYTHON_SOURCE_EXTENSION = ".py";
export const PYTHON_EXTERNAL_MODULES = new Set([
	"__future__",
	"abc",
	"ast",
	"asyncio",
	"collections",
	"contextlib",
	"copy",
	"dataclasses",
	"enum",
	"functools",
	"hypothesis",
	"io",
	"itertools",
	"json",
	"logging",
	"math",
	"operator",
	"os",
	"pathlib",
	"pytest",
	"re",
	"subprocess",
	"sys",
	"tempfile",
	"threading",
	"time",
	"types",
	"typing",
	"unittest",
]);
export const PYTHON_COLLECTIONS_MODULE = "collections";
export const PYTHON_PROJECT_CONFIGURATION_FILE = "pyproject.toml";
export const NODE_MODULES_DIRECTORY = "node_modules";
export const TESTS_DIRECTORY_PREFIX = "tests/";
export const TESTS_DIRECTORY_FRAGMENT = "/tests/";
export const DUNDER_TESTS_DIRECTORY_PREFIX = "__tests__/";
export const DUNDER_TESTS_DIRECTORY_FRAGMENT = "/__tests__/";
export const DUNDER_TESTS_DIRECTORY_NAME = "__tests__";
export const TYPESCRIPT_PROTOTYPE_NAME = "prototype";
export const PYTHON_CLASSVAR_NAME = "ClassVar";
export const CLI_ENTRY = "src/core/cli.ts";
export const PYTHON_PACKAGE_SUFFIX = "/__init__.py";
export const PYTHON_PACKAGE_MARKER = "__init__.py";
export const CODING_LINT_PATH_PREFIX = "tools/coding-lint/";
export const FUNCTION_MODULE_NAMES: ReadonlySet<string> = new Set(["functions.ts", "functions.tsx", "functions.py"]);
export const TYPESCRIPT_INDEX_MODULE = "index.ts";
export const PYTHON_INDEX_MODULE = "index.py";
export const PROTOCOL_NAME_PREFIX = "prot";
export const TYPESCRIPT_METADATA_STAGE_PREFIX = "startup.project-context.source-records.record-construction.metadata";
export const ERROR_CLASS_NAMES: ReadonlySet<string> = new Set(["Error", "Exception", "BaseException", "ValueError"]);
export const INITIALIZED_REFERENCE_STATE = "initialized";
export const INITIALIZING_REFERENCE_STATE = "initializing";
export const PYTHON_CALLABLE_TYPE_PREFIX = "Callable[[";
export const CALLABLE_TYPE_NAME = "Callable";
export const CALLABLE_BODY_KIND_UNSUPPORTED = "unsupported";
export const CALLABLE_BODY_KIND_EXPRESSION = "expression";
export const CALLABLE_BODY_KIND_DECLARATION = "declaration";
export const TYPE_SCRIPT_CALLABLE_BODY_KINDS = [
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.FunctionExpression,
	ts.SyntaxKind.ArrowFunction,
	ts.SyntaxKind.MethodDeclaration,
	ts.SyntaxKind.Constructor,
	ts.SyntaxKind.GetAccessor,
	ts.SyntaxKind.SetAccessor,
] as const;
export const PYTHON_BRIDGE_DIRECTORY = "src/python-bridge";
export const TYPESCRIPT_CACHE_OWNER = "typescript";
export const PACKAGE_MANIFEST_FILE = "package.json";
export const PYTHON_REQUIREMENTS_FILE = "requirements.txt";
export const TYPESCRIPT_CONFIG_FILE = "tsconfig.json";
export const ERROR_GROUPING_RULE_ID = "exception-grouping";
export const TOP_LEVEL_CLASSES_RULE_ID = "top-level-classes";
export const CONTRACT_FIELDS_RULE_ID = "contract-fields";
export const COLLECTION_TYPE_NAMES: ReadonlySet<string> = new Set([
	"Map",
	"ReadonlyMap",
	"Set",
	"ReadonlySet",
	"WeakMap",
	"WeakSet",
]);
export const PLACEMENT_DIAGNOSTIC_GUIDANCE = "Do not place the module in a directory ignored by Git.";
export const IMPLEMENTATION_RELATION: SourceReferenceRelation = "implementation";
export const MODULE_CLASS_KIND = "class";
export const MODULE_INTERFACE_KIND = "interface";
export const MODULE_PROTOCOL_KIND = "protocol";
export const MODULE_TYPE_KIND = "type";
export const MODULE_CONSTANT_KIND = "constant";
export const MODULE_VARIABLE_KIND = "variable";
export const TYPE_FIELD_SYMBOL_KIND = "type_field";
export const MODULE_ROOT_KIND = "root";
export const PRIVATE_VISIBILITY = "private";
export const PROTECTED_VISIBILITY = "protected";
export const ANONYMOUS_CLASS_NAME = "<anonymous>";
export const PUBLIC_FIELD_KIND = "public field";
export const TYPE_ALIAS_KIND = "type_alias";
export const RESPONSIBILITIES_PREFIX = "Responsibilities:";
export const POLICY_TOP_CATEGORY = "top-category";
export const POLICY_ALL = "all";
export const REPORT_MARKDOWN_HEADER = "| Rule | Problems | Files |";
export const REPORT_MARKDOWN_DIVIDER = "| --- | ---: | ---: |";
export const TWO_COLUMN_MARKDOWN_DIVIDER = "| --- | ---: |";
export const EMPTY_REPORT_MARKDOWN_ROW = "| — | 0 | 0 |";
export const NORMALIZED_AST_CACHE_KEY = "normalized";
export const IGNORED_DIRS = new Set([
	AI_CODE_GUARD_DIRECTORY,
	".git",
	"dist",
	"node_modules",
	"coverage",
	"__pycache__",
	".venv",
	".tox",
]);
export const REPORTING_PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BUILTIN_CONSTRUCTORS = new Set([
	"AbortController",
	"Date",
	"Error",
	"Map",
	"MutationObserver",
	"Path",
	"Promise",
	"RegExp",
	"Set",
	"URL",
	"WeakMap",
	"WeakSet",
]);
export const PYTHON_REFLECTION_CALLS = ["isinstance", "getattr", "setattr", "callable"] as const;
export const PYTHON_ONLY_REFLECTIONS = new Set(["isinstance", "callable"]);
export const PYTHON_TYPE_CALL = "type(";
export const PYTHON_ABSTRACT_METHOD = "abstractmethod";
export const TYPESCRIPT_SCANNER_STAGE = "file-analysis.typescript.scanner-execution";

export const RESPONSIBILITY_ACTION_WORDS = new Set(
	"accept accepts accepted accepting apply applies applied applying build builds built building call calls called calling capture captures captured capturing check checks checked checking classify classifies classified classifying close closes closed closing create creates created creating ensure ensures ensured ensuring execute executes executed executing extract extracts extracted extracting find finds found finding handle handles handled handling hide hides hid hidden hiding identify identifies identified identifying initialize initializes initialized initializing inspect inspects inspected inspecting install installs installed installing load loads loaded loading log logs logged logging match matches matched matching normalize normalizes normalized normalizing observe observes observed observing open opens opened opening parse parses parsed parsing poll polls polled polling prepare prepares prepared preparing provide provides provided providing read reads reading record records recorded recording refresh refreshes refreshed refreshing register registers registered registering remove removes removed removing render renders rendered rendering resolve resolves resolved resolving restore restores restored restoring route routes routed routing run runs ran running select selects selected selecting send sends sent sending serialize serializes serialized serializing set sets setting show shows showed shown showing split splits splitting start starts started starting store stores stored storing submit submits submitted submitting traverse traverses traversed traversing validate validates validated validating wait waits waited waiting write writes wrote written writing return returns returned returning add adds added adding activate activates activated activating adapt adapts adapted adapting append appends appended appending assemble assembles assembled assembling assert asserts asserted asserting attach attaches attached attaching ask asks asked asking calculate calculates calculated calculating clean cleans cleaned cleaning collect collects collected collecting compare compares compared comparing confirm confirms confirmed confirming configure configures configured configuring construct constructs constructed constructing coordinate coordinates coordinated coordinating convert converts converted converting copy copies copied copying decode decodes decoded decoding deduplicate deduplicates deduplicated deduplicating delete deletes deleted deleting describe describes described describing destroy destroys destroyed destroying detect detects detected detecting discover discovers discovered discovering dispatch dispatches dispatched dispatching exercise exercises exercised exercising expose exposes exposed exposing fetch fetches fetched fetching filter filters filtered filtering format formats formatted formatting generate generates generated generating get gets got getting hold holds held holding locate locates located locating map maps mapped mapping merge merges merged merging navigate navigates navigated navigating process processes processed processing project projects projected projecting propagate propagates propagated propagating reject rejects rejected rejecting release releases released releasing use uses used using verify verifies verified verifying visit visits visited visiting walk walks walked walking wrap wraps wrapped wrapping preserve preserves preserved preserving persist persists persisted persisting manage manages managed managing clear clears cleared clearing suppress suppresses suppressed suppressing count counts counted counting retry retries retried retrying paginate paginates paginated paginating stop stops stopped stopping partition partitions partitioned partitioning enforce enforces enforced enforcing raise raises raised raising escape escapes escaped escaping simulate simulates simulated simulating trigger triggers triggered triggering update updates updated updating replace replaces replaced replacing require requires required requiring reset resets resetting represent represents represented representing save saves saved saving scan scans scanned scanning search searches searched searching serve serves served serving sort sorts sorted sorting strip strips stripped stripping synchronize synchronizes synchronized synchronizing track tracks tracked tracking transform transforms transformed transforming".split(
		" ",
	),
);
export const RESPONSIBILITY_NOUN_WORDS = new Set(
	"adapted adds call calls return scan check checks checking compare compared copies copying count counts decoding discovered dispatch filtering formatting handling hidden loading map mapping match matched matches matching merge merging parsed parsing process processing project reading record recorded recording records register rendered rendering represented represents require reset routing scanning search split start starts suppressed tracking traverse traversing unregistered update wrapped wrapping writing query queries".split(
		" ",
	),
);
export const RESPONSIBILITY_ACTION_EXTENSIONS = new Set([
	"list",
	"lists",
	"listed",
	"listing",
	"query",
	"queries",
	"queried",
	"querying",
	"toggle",
	"toggles",
	"toggled",
	"toggling",
	"unregister",
	"unregisters",
	"unregistered",
	"unregistering",
]);
export const RESPONSIBILITY_CONDITION_WORDS = new Set(
	"a an the whether if when that is are was were be been being has have had does do did can could should must may might".split(
		" ",
	),
);
export const EMPTY_AST_NODE_VERIFIERS = [] as const;
export const EMPTY_PATH_MESSAGE = "AST verifier paths must contain at least one predicate.";
