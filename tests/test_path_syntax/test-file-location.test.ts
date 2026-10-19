import { describe, expect, test } from "@jest/globals";
import { TestPathSyntax } from "src/test_path_syntax";

describe("coding-lint test file location rule", () => {
	test("requires test-suffixed files to be below tests", () => {
		const syntax = new TestPathSyntax();
		const paths = ["feature.test.ts", "feature.spec.ts", "feature_test.py", "test_feature.py"];
		const location_violations = paths.filter((path) => syntax.test_file(path) && !syntax.test_file(path, true));

		expect({
			count: location_violations.length,
			files: location_violations.map((path) => path.split("/").pop()).sort(),
		}).toEqual({ count: 4, files: ["feature.spec.ts", "feature.test.ts", "feature_test.py", "test_feature.py"] });
	});

	test("accepts only root tests and __tests__ directories", () => {
		const syntax = new TestPathSyntax();
		expect({
			tests: syntax.test_file("tests/feature.test.ts", true),
			jest: syntax.test_file("__tests__/feature.spec.ts", true),
			nested_tests: syntax.test_file("src/tests/feature.test.ts", true),
			nested_jest: syntax.test_file("src/__tests__/feature.spec.ts", true),
		}).toEqual({ tests: true, jest: true, nested_tests: false, nested_jest: false });
	});

	test("rejects nested test directories", () => {
		const syntax = new TestPathSyntax();
		const paths = ["src/tests/feature.test.ts", "src/__tests__/feature.spec.ts"];
		const nested_tests = paths.filter((path) => syntax.test_file(path) && !syntax.test_file(path, true));

		expect(nested_tests).toEqual(paths);
	});
});
