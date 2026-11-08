import { describe, expect, test } from "@jest/globals";
import { TEST_PATH_SUFFIXES } from "src/constants";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { FileNameRules } from "src/rules/support/file_name_rules";
import { TestPathSyntax } from "src/test_path_syntax";

describe("single class file name rule", () => {
	const class_node: AstClassNode = {
		identity: { name: "MyClass", start: 0, end: 1, lines: 2, sloc: 2 },
		structure: { methods: [], interfaces: [], base_class_names: [], dependencies: [] },
		classification: { extends_external_class: false, is_data_class: false, type_contract: false, protocol: false },
		field_analysis: { callback_fields: 0, inline_callback_fields: 0, fields: [], untyped_fields: [] },
	};

	test("requires the snake_case TypeScript file name", () => {
		const rule = new FileNameRules(new TestPathSyntax(TEST_PATH_SUFFIXES));
		const violations: ViolationContract[] = [];

		rule.append(violations, "wrong-name.ts", [class_node]);

		expect(violations).toHaveLength(1);
		expect(
			violations.map((violation) => ({
				rule_id: violation.rule_id(),
				message: violation.message(),
				line: violation.line(),
			})),
		).toEqual([
			{
				rule_id: "single-class-file-name",
				message: 'file with one class must use the file name "my_class.ts"',
				line: 1,
			},
		]);
	});

	test("requires the snake_case Python file name", () => {
		const rule = new FileNameRules(new TestPathSyntax(TEST_PATH_SUFFIXES));
		const violations: ViolationContract[] = [];

		rule.append(violations, "wrong_name.py", [class_node]);

		expect(violations).toHaveLength(1);
		expect(
			violations.map((violation) => ({
				rule_id: violation.rule_id(),
				message: violation.message(),
				line: violation.line(),
			})),
		).toEqual([
			{
				rule_id: "single-class-file-name",
				message: 'file with one class must use the file name "my_class.py"',
				line: 1,
			},
		]);
	});

	test("accepts derived names and ignores multiple classes", () => {
		const rule = new FileNameRules(new TestPathSyntax(TEST_PATH_SUFFIXES));
		const violations: ViolationContract[] = [];

		rule.append(violations, "my_class.ts", [class_node]);
		rule.append(violations, "my_class.d.mts", [class_node]);
		rule.append(violations, "many-classes.ts", [
			class_node,
			{ ...class_node, identity: { ...class_node.identity, name: "Second" } },
		]);

		expect({
			expected_file_name: rule.expected_file_name("MyClass", "my_class.d.mts"),
			violations,
		}).toEqual({ expected_file_name: "my_class.d.mts", violations: [] });
	});

	test("does not apply to tests or facade files", () => {
		const rule = new FileNameRules(new TestPathSyntax(TEST_PATH_SUFFIXES));
		const violations: ViolationContract[] = [];

		rule.append(violations, "tests/my-class.test.ts", [class_node]);
		rule.append(violations, "index.ts", [class_node]);

		expect(violations).toEqual([]);
	});
});
