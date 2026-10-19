import { SingleClassFileNameRule } from "src/rules/support/single_class_file_name_rule";
import { describe, expect, test } from "@jest/globals";
import { CLASS_NODE } from "tests/bridge/ts/rules/support/constants";
import type { ViolationContract } from "src/protocols";

describe("single class file name rule", () => {
	test("requires the snake_case TypeScript file name", () => {
		const rule = new SingleClassFileNameRule();
		const violations: ViolationContract[] = [];

		rule.append(violations, "wrong-name.ts", [CLASS_NODE]);

		expect(violations).toHaveLength(1);
		expect(violations[0]).toEqual(
			expect.objectContaining({
				rule_id: "single-class-file-name",
				message: 'file with one class must use the file name "my_class.ts"',
				line: 1,
			}),
		);
	});

	test("requires the snake_case Python file name", () => {
		const rule = new SingleClassFileNameRule();
		const violations: ViolationContract[] = [];

		rule.append(violations, "wrong_name.py", [CLASS_NODE]);

		expect(violations).toHaveLength(1);
		expect(violations[0]).toEqual(
			expect.objectContaining({
				rule_id: "single-class-file-name",
				message: 'file with one class must use the file name "my_class.py"',
				line: 1,
			}),
		);
	});

	test("accepts the class-derived name and ignores multiple classes", () => {
		const rule = new SingleClassFileNameRule();
		const violations: ViolationContract[] = [];

		rule.append(violations, "my_class.ts", [CLASS_NODE]);
		rule.append(violations, "many-classes.ts", [CLASS_NODE, { ...CLASS_NODE, name: "Second" }]);

		expect(violations).toEqual([]);
	});

	test("does not apply to tests or facade files", () => {
		const rule = new SingleClassFileNameRule();
		const violations: ViolationContract[] = [];

		rule.append(violations, "tests/my-class.test.ts", [CLASS_NODE]);
		rule.append(violations, "index.ts", [CLASS_NODE]);

		expect(violations).toEqual([]);
	});
});
