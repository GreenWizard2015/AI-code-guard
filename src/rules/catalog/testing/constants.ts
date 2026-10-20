export const TESTING_RULE_DATA = {
	"assertion-outside-test": {
		message: "test assertions must stay inside test cases",
		hint: 'in test files, keep expect inside test("name", () => {}) in TypeScript and assert or unittest self.assert* inside def test_* in Python. Production files are outside this rule.',
		priority: 6,
	},
	"test-file-location": {
		message: "test file must be inside a root tests or __tests__ directory",
		hint: "move the test file below the project-root /tests/ or /__tests__/ path. Do not: keep a test-named file in a production directory or nested test directory.",
		priority: 7,
	},
	"test-file-organization": {
		message: "test file is not organized below its source module",
		hint: "place the file under tests or __tests__, include the matching module path from the project root or src, and optionally use a unit or integration directory before the module or before the test file.",
		priority: 7,
	},
	"test-targets": {
		message: "test imports do not identify a source root",
		hint: "Import at least one production module outside tests or __tests__. The common source root of those imports must match the test path. Target existence is not checked.",
		priority: 7,
	},
	"test-production-usage": {
		message: "test does not use an imported production class or function",
		hint: "Exercise at least one imported production class or function in every test body. Do not: count setup outside the test, side-effect imports, or test-support imports as production behavior.",
		priority: 6,
	},
	"production-test-import": {
		message: "production file imports test file {target}",
		hint: "Move shared code into a production module or keep the import inside tests. Do not: make production code depend on tests.",
		priority: 7,
	},
	"typescript-type-assertion": {
		message: "do not use TypeScript type assertions",
		hint: "narrow with an AST/type predicate, validate at the boundary, or change the contract so the type is known. Do not: silence the compiler with as Type or <Type>value.",
		priority: 5,
	},
	"python-test-shape": {
		message: "python tests must be class methods",
		hint: "move the test into a Test* class and keep it as a method. Do not: define top-level pytest test functions.",
		priority: 6,
	},
	"python-test-class-inheritance": {
		message: "Python test class must inherit from unittest.TestCase",
		hint: "make every Python test class inherit from exactly one fully qualified unittest.TestCase. Do not: use pytest, project helpers, multiple bases, or no base class.",
		priority: 6,
	},
	"python-test-framework-consistency": {
		message: "use unittest in every Python test file",
		hint: "import unittest and use unittest.TestCase for Python tests. Do not: use pytest as the test framework.",
		priority: 6,
	},
	"python-test-assert": {
		message: "Python unittest test must contain a direct self.assert* assertion",
		hint: "Add self.assert* directly to the unittest test method body. Do not: hide it in a helper, condition, or nested function.",
		priority: 6,
	},
	"python-test-assert-ending": {
		message: "Python unittest assertions must be the final consecutive statements",
		hint: "Move every self.assert* call to the end of the unittest test method and keep assertions together at test level. Do not: put assertions inside conditions or execute code after the final assertion.",
		priority: 6,
	},
	"python-test-assertion-alias": {
		message: "Python tests must not alias unittest assertions",
		hint: "Call self.assert* directly in the test method. Do not: store assertions in variables, tuples, lists, or mappings before calling them.",
		priority: 6,
	},
	"python-test-assert-statement": {
		message: "Python tests must not use bare assert statements",
		hint: "Use unittest self.assert* methods so the test has an explicit assertion contract. Do not: use Python assert statements in tests.",
		priority: 6,
	},
	"python-test-subtest": {
		message: "Python tests must not use self.subTest",
		hint: "use parameterized.expand(...) for parameterized cases. Do not: group cases with with self.subTest(...).",
		priority: 6,
	},
	"test-assertion-grouping": {
		message: "group 3 or more test assertions in one object literal",
		hint: "Combine related actual and expected values into object literals and compare them with one assertion. Do not: repeat separate assertions for one result shape.",
		priority: 2,
	},
	"test-too-many-assertions": {
		message: "test has too many assertions and is too complex",
		hint: "Split the test into smaller atomic tests with one focused behavior each. Do not: keep unrelated assertions in one test.",
		priority: 3,
	},
	"test-order-dependency": {
		message: "multiple tests mutate shared module state {name}",
		hint: "Create fresh state inside each test or reset it in explicit test setup. Do not: let test cases depend on the order of mutations to one module-level collection.",
		priority: 4,
	},
	"test-time-dependency": {
		message: "test depends on uncontrolled time or randomness",
		hint: "Inject a clock or deterministic random source into unit tests. Do not: read real time, sleep, or generate unseeded randomness in a test body.",
		priority: 2,
	},
	"fixture-complexity": {
		message: "test fixture setup is too complex",
		hint: "Move cohesive setup into a named fixture object or helper with one responsibility. Do not: keep unrelated environment, data, and transport setup in one lifecycle hook.",
		priority: 3,
	},
	"test-duplicate-setup": {
		message: "test contains consecutive duplicate setup statements",
		hint: "remove the duplicate setup statement or extract shared setup into one explicit fixture. Do not: repeat the same top-level setup operation consecutively before assertions.",
		priority: 4,
	},
	"typescript-console-mock-in-test": {
		message: "do not mock console in tests",
		hint: "assert the returned value or collected diagnostics directly. Do not: mock console methods to verify behavior.",
		priority: 6,
	},
	"typescript-console-in-test": {
		message: "do not use console in tests",
		hint: "assert the returned value or collected diagnostics directly. Do not: call console methods from a Jest test.",
		priority: 6,
	},
	"test-min-count": {
		message: "test suite has too few test methods (found {count})",
		hint: "Add a focused test method or remove an unnecessary suite. Do not: add a placeholder test to satisfy the minimum.",
		priority: 6,
	},
	"test-max-count": {
		message: "test suite has too many test methods (found {count})",
		hint: "Split the suite by cohesive behavior. Do not: keep unrelated test methods in one suite.",
		priority: 3,
	},
	"typescript-jest-test-ending": {
		message: "Jest test must end with an expect assertion",
		hint: "Finish every Jest test callback with an expect assertion. Do not: leave cleanup, logging, or other statements after the final assertion.",
		priority: 6,
	},
	"typescript-jest-test-lambda": {
		message: "Jest test must use an arrow-function callback",
		hint: 'Write each Jest test as test("...", () => {}). Do not: pass a function declaration or function expression as the test callback.',
		priority: 6,
	},
	"typescript-jest-test-expect": {
		message: "Jest test must contain a direct expect assertion",
		hint: "Add an expect assertion directly to the Jest test callback. Do not: hide it in a helper callback, condition, or nested function.",
		priority: 6,
	},
	"typescript-jest-type-only-test": {
		message: "Jest test checks only type or object shape",
		hint: "Assert the actual returned value or observable behavior. Do not: check only types, fields, methods, or object shape.",
		priority: 6,
	},
	"test-exception-only": {
		message: "test checks only that an exception is raised",
		hint: "Assert the returned value or observable behavior. If there is no direct result, test the next public boundary, such as the server response instead of the request handler. Do not: test only that an internal call throws.",
		priority: 6,
	},
	"test-only-usage": {
		message: '{kind} "{label}" is referenced only from tests',
		hint: "Add a real production use or remove/refactor the declaration; test references alone do not establish production usage.",
		priority: 7,
	},
	"unasserted-async-completion": {
		message: "test starts a local async operation without observing its completion",
		hint: "Await or return the local async operation in the test. Do not: leave a direct local async call as a standalone test statement.",
		priority: 4,
	},
	"test-max-size": {
		message: "test is too long",
		hint: "split the test into smaller tests that each verify one behavior. Do not: bypass the limit with nested callbacks, compressed expressions, or arbitrary wrappers.",
		priority: 3,
	},
	"test-min-size": {
		message: "test is too short",
		hint: "add the missing behavior assertion or combine the test with a meaningful scenario. Do not: add padding only to satisfy the size limit.",
		priority: 7,
	},
} as const;
