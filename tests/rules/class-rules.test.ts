import { ClassRules } from "src/rules/class_rules";
import { TestFixture } from "tests/core/test-fixture";
import ts from "typescript";

import type { ViolationContract } from "src/protocols";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { SourceText } from "src/source_text";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { LintStageTimer } from "src/lint_stage_timer";

describe("coding-lint class rules", () => {
	const fixture = new TestFixture();

	test("reports multiple Python top-level classes", () => {
		const class_rules = new ClassRules({ root: "", files: new Set(), resolver: new ProjectSourcePython() });
		const violations: ViolationContract[] = [];
		class_rules.append_python_classes({
			violations,
			file: "models.py",
			lines: ["class First:", "    pass", "", "class Second:", "    pass"],
			parsed_indexes: [0, 3],
			has_module_functions: false,
			has_implementation_classes: true,
			type_declarations: [],
		});
		const class_violations = violations.filter((violation) => violation.rule_id === "top-level-classes");
		expect(class_violations).toEqual([expect.objectContaining({ line: 4 })]);
	});

	test("reports multiple TypeScript top-level classes", () => {
		const class_rules = new ClassRules({ root: "", files: new Set(), resolver: new ProjectSourcePython() });
		const tsViolations: ViolationContract[] = [];
		class_rules.append_typescript_classes(
			tsViolations,
			"models.ts",
			["export class First {}", "class Second {}"],
			ts.createSourceFile("models.ts", "export class First {}\nclass Second {}", ts.ScriptTarget.Latest, true),
			[0, 1],
		);

		expect(tsViolations).toEqual([
			expect.objectContaining({ message: expect.stringContaining("too many top-level classes") }),
		]);
	});

	test("rejects imported functions assigned as Python class fields", () => {
		const violations = fixture.with_in_memory_project(
			{
				"helper.py": "def execute():\n    return 1\n\nVALUE = 1\n",
				"model.py": "from .helper import execute, VALUE\n\nclass Service:\n    run = execute\n    value = VALUE\n",
			},
			(root, context, files) => {
				const class_rules = new ClassRules({ root, files: new Set(files), resolver: new ProjectSourcePython() });
				return class_rules.collect_context_fields(
					{ files: [...files], repo_root: root },
					context,
					new LintStageTimer(),
				);
			},
			new Map(),
		);
		expect({
			count: violations.length,
			message: violations[0]?.message.includes("run"),
			line: violations[0]?.line,
		}).toEqual({ count: 1, message: true, line: 4 });
	});

	test("rejects imported functions assigned as TypeScript class fields", () => {
		const violations = fixture.with_in_memory_project(
			{
				"helper.ts": "export function execute(): number { return 1; }\nexport const VALUE = 1;\n",
				"model.ts":
					"import { execute, VALUE } from './helper';\n\nclass Service {\n  run = execute;\n  value = VALUE;\n}\n",
			},
			(root, context, files) => {
				const class_rules = new ClassRules({ root, files: new Set(files), resolver: new ProjectSourcePython() });
				return class_rules.collect_context_fields(
					{ files: [...files], repo_root: root },
					context,
					new LintStageTimer(),
				);
			},
			new Map(),
		);
		expect({
			count: violations.length,
			message: violations[0]?.message.includes("run"),
			line: violations[0]?.line,
		}).toEqual({ count: 1, message: true, line: 4 });
	});

	test("preserves cross-file import resolution when reusing the TypeScript AST", () => {
		const result = fixture.with_in_memory_project(
			{
				"tools/coding-lint/helper.ts": "export function execute(): number { return 1; }\n",
				"tools/coding-lint/model.ts": "import { execute } from './helper';\n\nclass Service {\n  run = execute;\n}\n",
			},
			(root, context, files) => {
				const class_rules = new ClassRules({ root, files: new Set(files), resolver: new ProjectSourcePython() });
				return class_rules.collect_context_fields(
					{ files: [...files], repo_root: root },
					context,
					new LintStageTimer(),
				);
			},
			new Map(),
		);
		expect(result).toEqual([
			expect.objectContaining({ file: "tools/coding-lint/model.ts", rule_id: "class-field-import", line: 4 }),
		]);
	});

	test("does not apply production mutability rules to test doubles", () => {
		const source_text =
			'class TestElement {\n  id = "";\n  focused = false;\n  focus(): void {\n    this.focused = true;\n  }\n}';
		const ast_file = new TypeScriptAstFile("tests/dom-kit/element.ts", source_text);
		const source_ast = new SourceFileAst(
			{ file: "tests/dom-kit/element.ts", text: source_text },
			ast_file.normalized(),
			ast_file.source_file,
			new Map(),
			ast_file.traversal,
		);
		const linter = new CodingRuleLinter(process.cwd(), new SourceText());
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "TypeScript class fields should be readonly",
				}),
				expect.objectContaining({
					message: "avoid assigning class fields outside constructors",
				}),
			]),
		);
	});
});
