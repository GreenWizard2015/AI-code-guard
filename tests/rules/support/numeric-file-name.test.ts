import { describe, expect, test } from "@jest/globals";
import { TEST_PATH_SUFFIXES } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import { FileNameRules } from "src/rules/support/file_name_rules";
import { TestPathSyntax } from "src/test_path_syntax";

describe("numeric file name rule", () => {
	test("rejects numeric parts other than powers of two from sixteen onward", () => {
		const rule = new FileNameRules(new TestPathSyntax(TEST_PATH_SUFFIXES));
		const violations: ViolationContract[] = [];
		const files = ["record2.ts", "record8.ts", "record24.py", "record16-v3.ts"];
		for (const file of files) {
			rule.append_numeric(violations, file);
		}

		expect(violations.map((violation) => violation.file())).toEqual(files);
	});

	test("allows descriptive names and powers of two from sixteen onward", () => {
		const rule = new FileNameRules(new TestPathSyntax(TEST_PATH_SUFFIXES));
		const violations: ViolationContract[] = [];
		const files = ["record.ts", "record16.ts", "cache32.py", "snapshot64.d.ts"];
		for (const file of files) {
			rule.append_numeric(violations, file);
		}

		expect(violations).toEqual([]);
	});
});
