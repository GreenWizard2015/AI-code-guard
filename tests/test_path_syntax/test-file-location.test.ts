import { describe, expect, test } from "@jest/globals";
import { TEST_PATH_SUFFIXES } from "src/constants";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

describe("coding-lint test file location rule", () => {
	test("requires test-suffixed files to be below tests", () => {
		const syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const paths = ["feature.test.ts", "feature.spec.ts", "feature_test.py", "test_feature.py"];
		const location_violations = paths.filter(
			(path) =>
				syntax.classify(path).has(TestPathKind.TestFile) && !syntax.classify(path).has(TestPathKind.RootTestsFile),
		);

		expect({
			count: location_violations.length,
			files: location_violations.map((path) => path.split("/").pop()).sort(),
		}).toEqual({ count: 4, files: ["feature.spec.ts", "feature.test.ts", "feature_test.py", "test_feature.py"] });
	});

	test("accepts only root tests and __tests__ directories", () => {
		const syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		expect({
			tests: syntax.classify("tests/feature.test.ts").has(TestPathKind.RootTestsFile),
			jest: syntax.classify("__tests__/feature.spec.ts").has(TestPathKind.RootTestsFile),
			nested_tests: syntax.classify("src/tests/feature.test.ts").has(TestPathKind.RootTestsFile),
			nested_jest: syntax.classify("src/__tests__/feature.spec.ts").has(TestPathKind.RootTestsFile),
		}).toEqual({ tests: true, jest: true, nested_tests: false, nested_jest: false });
	});

	test("rejects nested test directories", () => {
		const syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const paths = ["src/tests/feature.test.ts", "src/__tests__/feature.spec.ts"];
		const nested_tests = paths.filter(
			(path) =>
				syntax.classify(path).has(TestPathKind.TestFile) && !syntax.classify(path).has(TestPathKind.RootTestsFile),
		);

		expect(nested_tests).toEqual(paths);
	});
});
