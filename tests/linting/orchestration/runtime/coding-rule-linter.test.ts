import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { SourceText } from "src/source_text";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { LintStageTimer } from "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";

describe("coding rule linter", () => {
	test("rejects console usage through object properties in tests", () => {
		const text =
			"const globals = { console };\nglobals.console.log('result');\ntest('result', () => { expect(true).toBe(true); });";
		const parsed_file = new TypeScriptAstFile("tests/object-console.test.ts", text);
		const source_ast = new SourceFileAst(
			{ file: "tests/object-console.test.ts", text },
			parsed_file.normalized(),
			parsed_file.source_file,
			new Map(),
			parsed_file.traversal,
		);
		const linter = new CodingRuleLinter(process.cwd(), new SourceText());
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		expect(violations.filter((item) => item.rule_id === "typescript-console-in-test")).toHaveLength(1);
	});

	test("rejects parenthesized assertions outside test callbacks", () => {
		const text =
			"expect(value);\n(expect)(value);\nconst check = expect;\ncheck(value);\ntest('result', () => { expect(true).toBe(true); });";
		const parsed_file = new TypeScriptAstFile("tests/example.test.ts", text);
		const source_ast = new SourceFileAst(
			{ file: "tests/example.test.ts", text },
			parsed_file.normalized(),
			parsed_file.source_file,
			new Map(),
			parsed_file.traversal,
		);
		const linter = new CodingRuleLinter(process.cwd(), new SourceText());
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		expect(violations).toEqual([
			expect.objectContaining({
				line: 1,
				message: "test assertions must stay inside test cases",
				rule_id: "assertion-outside-test",
			}),
			expect.objectContaining({
				line: 2,
				message: "test assertions must stay inside test cases",
				rule_id: "assertion-outside-test",
			}),
			expect.objectContaining({
				line: 4,
				message: "test assertions must stay inside test cases",
				rule_id: "assertion-outside-test",
			}),
		]);
	});
});
