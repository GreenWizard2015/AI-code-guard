import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

export const TEST_SCOPE_DIRECTORIES = {
	levels: [
		"unit",
		"units",
		"unit-tests",
		"unit_tests",
		"component",
		"components",
		"module",
		"modules",
		"integration",
		"integrations",
		"int",
		"integration-tests",
		"integration_tests",
		"component-integration",
		"component_integration",
		"unit-integration",
		"unit_integration",
		"system-integration",
		"system_integration",
		"e2e",
		"end-to-end",
		"end_to_end",
		"end2end",
		"system",
	],
	acceptance: [
		"acceptance",
		"user-acceptance",
		"user_acceptance",
		"uat",
		"operational-acceptance",
		"operational_acceptance",
		"oat",
		"contractual-acceptance",
		"contractual_acceptance",
		"regulatory-acceptance",
		"regulatory_acceptance",
		"alpha",
		"beta",
	],
	types: [
		"functional",
		"behavioral",
		"behavioural",
		"feature",
		"confirmation",
		"non-functional",
		"non_functional",
		"regression",
		"regressions",
		"regression-tests",
		"regression_tests",
	],
	performance: [
		"performance",
		"benchmark",
		"benchmarks",
		"load",
		"stress",
		"capacity",
		"scalability",
		"spike",
		"endurance",
		"soak",
		"volume",
	],
	smoke: ["smoke", "sanity", "confidence", "intake", "pretest", "build-verification", "build_verification"],
	quality: [
		"functional-suitability",
		"functional_suitability",
		"performance-efficiency",
		"performance_efficiency",
		"compatibility",
		"usability",
		"interaction-capability",
		"interaction_capability",
		"reliability",
		"security",
		"maintainability",
		"portability",
		"flexibility",
		"safety",
		"availability",
		"recoverability",
		"fault-tolerance",
		"fault_tolerance",
		"maturity",
		"co-existence",
		"co_existence",
		"interoperability",
		"user-experience",
		"user_experience",
		"ux",
		"accessibility",
		"installability",
		"adaptability",
		"replaceability",
		"modifiability",
		"testability",
		"modularity",
		"reusability",
		"analysability",
		"analysis",
	],
	operational: [
		"operational",
		"recovery",
		"failover",
		"backup",
		"restore",
		"disaster-recovery",
		"disaster_recovery",
		"installation",
		"upgrade",
		"uninstallation",
		"migration",
		"conversion",
		"localization",
		"internationalization",
		"compliance",
		"conformance",
		"regulatory",
		"resilience",
		"chaos",
		"fault-injection",
		"fault_injection",
	],
	security: [
		"penetration",
		"pen-testing",
		"pen_testing",
		"vulnerability",
		"fuzz",
		"fuzzing",
		"security-audit",
		"security_audit",
		"hardening",
		"authentication",
		"authorization",
		"identity-access-management",
		"identity_access_management",
		"sast",
		"dast",
		"iast",
		"dynamic-analysis",
		"dynamic_analysis",
		"static-analysis",
		"static_analysis",
		"policy-based",
		"policy_based",
		"risk-based",
		"risk_based",
		"requirements-based",
		"requirements_based",
		"standards-based",
		"standards_based",
		"vulnerability-based",
		"vulnerability_based",
		"recertification",
		"reconciliation",
	],
	approaches: [
		"api",
		"contract",
		"gui",
		"ui",
		"database",
		"static",
		"dynamic",
		"manual",
		"automated",
		"black-box",
		"black_box",
		"white-box",
		"white_box",
		"grey-box",
		"grey_box",
		"gray-box",
		"gray_box",
		"specification-based",
		"specification_based",
		"structure-based",
		"structure_based",
		"experience-based",
		"experience_based",
	],
	techniques: [
		"exploratory",
		"ad-hoc",
		"ad_hoc",
		"checklist-based",
		"checklist_based",
		"error-guessing",
		"error_guessing",
		"use-case",
		"use_case",
		"boundary-value",
		"boundary_value",
		"equivalence-partitioning",
		"equivalence_partitioning",
		"decision-table",
		"decision_table",
		"state-transition",
		"state_transition",
		"pairwise",
		"model-based",
		"model_based",
		"property-based",
		"property_based",
		"mutation",
		"confirmation",
		"confirmation-tests",
		"confirmation_tests",
	],
} as const;

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
export const MIN_PER_DIRECTORY = 3;
export const MAX_PER_DIRECTORY = 40;
export const MIN_DIRECTORY_CLASSES = 3;
export const MAX_DIRECTORY_CLASSES = 15;

export const IGNORED_DIRS = new Set([
	".ai-code-guard",
	"dist",
	"node_modules",
	"coverage",
	"__pycache__",
	".venv",
	".tox",
]);
export const DEFAULT_TARGET_FILES: string[] = [];

export const REPORTING_PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const REPORTING_HINT = `Solutions, from most to least invasive:
1. Try refactoring all callers and the ownership boundary.
2. If that does not fit, try extracting a focused module or stateful class and updating its dependencies.
3. Then try replacing the local pattern with an explicit function, type, or boundary.
4. Finally try the smallest local code fix.
Attempt every level in order; do not skip directly to the smallest change.
Do not revert a change just because it reveals additional problems; keep the valid improvement and address the new findings separately.
Design refactors carefully so classes remain immutable whenever possible; this is always the priority, and rule hacks are forbidden.
If a problem cannot be fixed locally, analyze it from the perspective of the calling code.`;
