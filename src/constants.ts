import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { TESTING_RULE_DATA } from "src/rules/catalog/testing/constants";
import { TYPES_RULE_DATA } from "src/rules/catalog/types/constants";
import { NAMING_RULE_DATA } from "src/rules/catalog/naming/constants";
import { ARCHITECTURE_RULE_DATA } from "src/rules/catalog/architecture/constants";
import { MODULES_RULE_DATA } from "src/rules/catalog/modules/constants";
import { QUALITY_RULE_DATA } from "src/rules/catalog/quality/constants";
import type { TypeScriptModuleCache } from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { AstLanguage, ReviewStageDefinition, SourceReferenceRelation, TypeScriptPropertySide } from "src/types";

export const MISSING_CACHE_VALUE = "<missing>";
export const REMOVED_SKIP_REVIEW_MESSAGE = "--skip-review was removed; omit --review-agent to skip review.";
export const MARKDOWN_TEXT_SUFFIXES: ReadonlySet<string> = new Set([".md", ".markdown", ".mdown", ".mkdn"]);
export const RULE_DOCUMENT_DIRECTORY = "docs/rules";

export const RULE_DATA = {
	...TESTING_RULE_DATA,
	...TYPES_RULE_DATA,
	...NAMING_RULE_DATA,
	...ARCHITECTURE_RULE_DATA,
	...MODULES_RULE_DATA,
	...QUALITY_RULE_DATA,
} as const;
export const RULE_DATA_BY_ID = new Map(Object.entries(RULE_DATA));
export const RULE_LANGUAGE_BY_ID = new Map<string, AstLanguage>(
	Object.entries({
		"typescript-overload": "typescript", "typescript-type-assertion": "typescript",
		"python-test-shape": "python", "python-test-class-inheritance": "python",
		"python-test-framework-consistency": "python", "python-test-assert": "python",
		"python-test-assert-ending": "python", "python-test-assertion-alias": "python",
		"python-explicit-parameter-type": "python", "python-explicit-field-type": "python",
		"python-string-type-annotation": "python", "typescript-in-operator": "typescript",
		"python-test-assert-statement": "python", "python-test-subtest": "python",
		"typescript-static-method": "typescript", "typescript-static-field": "typescript",
		"python-static-method": "python", "python-class-method": "python",
		"python-data-class-method": "python", "python-abstract-class": "python",
		"python-property-setter": "python", "python-property": "python",
		"typescript-prototype-assignment": "typescript", "python-type-factory": "python",
		"python-optional-union": "python", "python-conditional-type-alias": "python",
		"typescript-type-guard": "typescript", "typescript-union-contract-bypass": "typescript",
		"typescript-rest-union-contract": "typescript", "typescript-index-signature": "typescript",
		"python-multi-except": "python", "typescript-typeof": "typescript", "python-isinstance": "python",
		"typescript-instanceof": "typescript", "python-object-setattr": "python",
		"typescript-object-prototype-string": "typescript", "typescript-object-assign": "typescript",
		"typescript-object-method-call": "typescript", "typescript-logical-assignment": "typescript",
		"typescript-conditional-block": "typescript", "python-elif": "python",
		"python-assignment-expression": "python", "typescript-console-mock-in-test": "typescript",
		"typescript-console-in-test": "typescript", "python-direct-class-init": "python",
		"python-call-method": "python", "typescript-explicit-visibility": "typescript",
		"typescript-mutable-field": "typescript", "typescript-fake-object": "typescript",
		"typescript-object-literal-return": "typescript", "typescript-jest-min-size": "typescript",
		"typescript-jest-max-size": "typescript", "typescript-jest-describe-count": "typescript",
		"typescript-jest-nested-describe": "typescript", "typescript-jest-test-ending": "typescript",
		"typescript-jest-test-lambda": "typescript", "typescript-jest-test-expect": "typescript",
		"typescript-jest-type-only-test": "typescript", "typescript-bare-type-alias": "typescript",
		"typescript-singular-plural-alias": "typescript", "typescript-parameter-property": "typescript",
		"typescript-interface-shape": "typescript", "typescript-class-callback-fields": "typescript",
		"typescript-bind": "typescript", "typescript-dynamic-runtime-usage": "typescript",
		"python-sys-path-mutation": "python", "typescript-module-constant-case": "typescript",
		"typescript-module-variable": "typescript", "typescript-namespace-file": "typescript",
		"typescript-unknown-parameter-type": "typescript", "typescript-dictionary-return": "typescript",
		"typescript-type-operation": "typescript", "typescript-inline-object-type": "typescript",
		"typescript-inline-union-type": "typescript",
	} as const),
);
export const LANGUAGE_NEUTRAL_RULE_IDS: ReadonlySet<string> = new Set(["ai-code-guard-directory-ignored"]);
export const SHARED_RULE_DOCUMENT_IDS: ReadonlySet<string> = new Set([
	"directory-class-max-size", "directory-class-min-size", "directory-max-size",
	"directory-max-source-subdirectories", "directory-min-size",
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
			[
				`${RULE_DOCUMENT_DIRECTORY}/typescript/${rule_id}.md`,
				`${RULE_DOCUMENT_DIRECTORY}/python/${rule_id}.md`,
			],
		];
	}),
);

export const TEST_SCOPE_DIRECTORIES = {
	categories: ["architecture", "bridge", "ts"],
	levels: ["unit", "units", "unit-tests", "unit_tests", "component", "components", "module", "modules", "integration", "integrations", "int", "integration-tests", "integration_tests", "component-integration", "component_integration", "unit-integration", "unit_integration", "system-integration", "system_integration", "e2e", "end-to-end", "end_to_end", "end2end", "system"],
	acceptance: ["acceptance", "user-acceptance", "user_acceptance", "uat", "operational-acceptance", "operational_acceptance", "oat", "contractual-acceptance", "contractual_acceptance", "regulatory-acceptance", "regulatory_acceptance", "alpha", "beta"],
	types: ["functional", "behavioral", "behavioural", "feature", "confirmation", "non-functional", "non_functional", "regression", "regressions", "regression-tests", "regression_tests"],
	performance: ["performance", "benchmark", "benchmarks", "load", "stress", "capacity", "scalability", "spike", "endurance", "soak", "volume"],
	smoke: ["smoke", "sanity", "confidence", "intake", "pretest", "build-verification", "build_verification"],
	quality: ["functional-suitability", "functional_suitability", "performance-efficiency", "performance_efficiency", "compatibility", "usability", "interaction-capability", "interaction_capability", "reliability", "security", "maintainability", "portability", "flexibility", "safety", "availability", "recoverability", "fault-tolerance", "fault_tolerance", "maturity", "co-existence", "co_existence", "interoperability", "user-experience", "user_experience", "ux", "accessibility", "installability", "adaptability", "replaceability", "modifiability", "testability", "modularity", "reusability", "analysability", "analysis"],
	operational: ["operational", "recovery", "failover", "backup", "restore", "disaster-recovery", "disaster_recovery", "installation", "upgrade", "uninstallation", "migration", "conversion", "localization", "internationalization", "compliance", "conformance", "regulatory", "resilience", "chaos", "fault-injection", "fault_injection"],
	security: ["penetration", "pen-testing", "pen_testing", "vulnerability", "fuzz", "fuzzing", "security-audit", "security_audit", "hardening", "authentication", "authorization", "identity-access-management", "identity_access_management", "sast", "dast", "iast", "dynamic-analysis", "dynamic_analysis", "static-analysis", "static_analysis", "policy-based", "policy_based", "risk-based", "risk_based", "requirements-based", "requirements_based", "standards-based", "standards_based", "vulnerability-based", "vulnerability_based", "recertification", "reconciliation"],
	approaches: ["api", "contract", "gui", "ui", "database", "static", "dynamic", "manual", "automated", "black-box", "black_box", "white-box", "white_box", "grey-box", "grey_box", "gray-box", "gray_box", "specification-based", "specification_based", "structure-based", "structure_based", "experience-based", "experience_based"],
	techniques: ["exploratory", "ad-hoc", "ad_hoc", "checklist-based", "checklist_based", "error-guessing", "error_guessing", "use-case", "use_case", "boundary-value", "boundary_value", "equivalence-partitioning", "equivalence_partitioning", "decision-table", "decision_table", "state-transition", "state_transition", "pairwise", "model-based", "model_based", "property-based", "property_based", "mutation", "confirmation", "confirmation-tests", "confirmation_tests"],
} as const;

export const RULE_IDS = {
	assertion_outside_test: "assertion-outside-test",
	static_method: "python-static-method",
	class_method: "python-class-method",
	data_class_method: "python-data-class-method",
	abstract_class: "python-abstract-class",
	dynamic_type: "dynamic-type",
	broad_except: "broad-except",
	object_setattr: "python-object-setattr",
	empty_contract: "empty-contract",
	temporary_result_access: "temporary-result-access",
	direct_class_init: "python-direct-class-init",
	call_method: "python-call-method",
	branch_duplication: "branch-duplication",
	private_member: "private-member",
	class_method_min_count: "class-method-min-count",
	class_method_max_count: "class-method-max-count",
	class_method_count_info: "class-method-count-info",
	typescript_static_method: "typescript-static-method",
	typescript_static_field: "typescript-static-field",
	typescript_prototype_assignment: "typescript-prototype-assignment",
	complex_constructor: "complex-constructor",
	field_in_constructor: "field-in-constructor",
	typescript_explicit_visibility: "typescript-explicit-visibility",
	typescript_mutable_field: "typescript-mutable-field",
	proxy_callable: "proxy-callable",
	typescript_type_guard: "typescript-type-guard",
	proxy_lambda: "proxy-lambda",
	typescript_bind: "typescript-bind",
	tuple_type: "tuple-type",
	mutable_field_assignment: "mutable-field-assignment",
	explicit_return_type: "explicit-return-type",
	typescript_in_operator: "typescript-in-operator",
	callable_feature_detection: "callable-feature-detection",
	type_warning: "type-warning",
	method_order_public: "method-order-public",
	method_order_constructor_after: "method-order-constructor-after",
	method_order_constructor_before: "method-order-constructor-before",
	inline_generic_type: "inline-generic-type",
	duplicate_type_shape: "duplicate-type-shape",
	fixture_complexity: "fixture-complexity",
	repeated_literal: "repeated-literal",
	callback_contract_size: "callback-contract-size",
	nested_generic_type: "nested-generic-type",
	shared_parameter_type: "shared-parameter-type",
	shared_parameter_combination: "shared-parameter-combination",
	typescript_namespace_file: "typescript-namespace-file",
	mixed_module: "mixed-module",
	typescript_bare_type_alias: "typescript-bare-type-alias",
	class_field_import: "class-field-import",
	callable_branch_count: "callable-branch-count",
	hidden_global_state: "hidden-global-state",
	temporal_coupling: "temporal-coupling",
	duplicate_error_translation: "duplicate-error-translation",
	public_state_exposure: "public-state-exposure",
	pointless_assignment: "pointless-assignment",
	typescript_dictionary_return: "typescript-dictionary-return",
	retry_without_ownership: "retry-without-ownership",
	incomplete_cache_key: "incomplete-cache-key",
	python_test_assertion: "python-test-assert-statement",
	exception_raising: "exception-raising",
	python_test_subtest: "python-test-subtest",
	test_order_dependency: "test-order-dependency",
	class_reference_warning: "class-reference-warning",
	class_reference_info: "class-reference-info",
	naming_type: "naming-type",
	naming: "naming",
	multiple_result_shapes: "multiple-result-shapes",
	typescript_object_prototype_string: "typescript-object-prototype-string",
	typescript_object_assign: "typescript-object-assign",
	typescript_object_method_call: "typescript-object-method-call",
	typescript_fake_object: "typescript-fake-object",
	logical_chain_size: "logical-chain-size",
	mixed_boolean_precedence: "mixed-boolean-precedence",
	mixed_arithmetic_precedence: "mixed-arithmetic-precedence",
	typescript_console_mock_in_test: "typescript-console-mock-in-test",
	typescript_console_in_test: "typescript-console-in-test",
	test_file_location: "test-file-location",
	test_file_organization: "test-file-organization",
	test_targets: "test-targets",
	test_production_usage: "test-production-usage",
	unnecessary_undefined_check: "unnecessary-undefined-check",
} as const;
export const PYTHON_RULE_IDS = {
	assertion_outside_test: RULE_IDS.assertion_outside_test,
	static_method: RULE_IDS.static_method,
	class_method: RULE_IDS.class_method,
	data_class_method: RULE_IDS.data_class_method,
	abstract_class: RULE_IDS.abstract_class,
	dynamic_type: RULE_IDS.dynamic_type,
	broad_except: RULE_IDS.broad_except,
	object_setattr: RULE_IDS.object_setattr,
	empty_contract: RULE_IDS.empty_contract,
	temporary_result_access: RULE_IDS.temporary_result_access,
	direct_class_init: RULE_IDS.direct_class_init,
	call_method: RULE_IDS.call_method,
	branch_duplication: RULE_IDS.branch_duplication,
	private_member: RULE_IDS.private_member,
} as const;

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
export const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".py"]);
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
export const TYPESCRIPT_LANGUAGE = "typescript";
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
export const NODE_MODULES_DIRECTORY = "node_modules";
export const EXTERNAL_DIRECTORY = "external";
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
export const PROTOCOL_NAME_PREFIX = "proto";
export const TYPESCRIPT_METADATA_STAGE_PREFIX = "startup.project-context.source-records.metadata";
export const ERROR_CLASS_NAMES: ReadonlySet<string> = new Set(["Error", "Exception", "BaseException"]);
export const ERROR_CLASS_SUFFIXES: readonly string[] = ["Error", "Exception"];
export const INITIALIZED_REFERENCE_STATE = "initialized";
export const INITIALIZING_REFERENCE_STATE = "initializing";
export const PYTHON_CALLABLE_TYPE_PREFIX = "Callable[[";
export const CALLABLE_BODY_KIND_UNSUPPORTED = "unsupported";
export const CALLABLE_BODY_KIND_EXPRESSION = "expression";
export const CALLABLE_BODY_KIND_DECLARATION = "declaration";
export const TYPESCRIPT_LEGACY_TEST_SUFFIX = "_test.ts";
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
export const MODULE_ROOT_KIND = "root";
export const PRIVATE_VISIBILITY = "private";
export const PROTECTED_VISIBILITY = "protected";
export const ANONYMOUS_CLASS_NAME = "<anonymous>";
export const PUBLIC_FIELD_KIND = "public field";
export const TYPE_ALIAS_KIND = "type_alias";
export const RESPONSIBILITIES_PREFIX = "Responsibilities:";
export const POLICY_TOP_CATEGORY = "top-category";
export const POLICY_ALL = "all";
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
