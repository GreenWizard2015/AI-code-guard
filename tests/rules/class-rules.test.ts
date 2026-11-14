import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { ViolationContract } from "src/reporting_protocols";
import { ClassRules } from "src/rules/class_rules";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { EMPTY_PROJECT_NAMES } from "tests/core/constants";
import { TestFixture } from "tests/core/test-fixture";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("coding-lint class rules", () => {
	const fixture = new TestFixture();

	test("reports multiple Python top-level classes", () => {
		const class_rules = new ClassRules({ root: "", files: new Set(), resolver: new ProjectSourcePython("") });
		const violations: ViolationContract[] = [];
		class_rules.append_python_classes({
			violations,
			file: "models.py",
			lines: ["class First:", "    pass", "", "class Second:", "    pass"],
			parsed_indexes: [0, 3],
			has_module_functions: false,
			has_implementation_classes: true,
			test_file: false,
			type_declarations: [],
		});
		const class_violations = violations.filter((violation) => violation.rule_id() === "top-level-classes");
		expect(class_violations.map((violation) => violation.line())).toEqual([4]);
	});

	test("reports multiple TypeScript top-level classes", () => {
		const text = "export class First {}\nclass Second {}";
		const source_file = ts.createSourceFile("tests/models.test.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).toContain("top-level-classes");
	});

	test("reports type and class separation diagnostics in test files for both languages", () => {
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), fixture.file_io()),
			{
				"tests/test_models.py": [
					"from typing import TypeAlias",
					"ModelOptions: TypeAlias = dict[str, str]",
					"class FirstTest:",
					"    pass",
					"class SecondTest:",
					"    pass",
				].join("\n"),
				"tests/models.test.ts": [
					"type ModelOptions = { name: string };",
					"class FirstTest {}",
					"class SecondTest {}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const relevant = violations
			.filter((violation) => ["module-types-separation", "top-level-classes"].includes(violation.rule_id()))
			.map((violation) => [violation.file(), violation.rule_id()])
			.sort((left, right) => `${left[0]}:${left[1]}`.localeCompare(`${right[0]}:${right[1]}`));

		expect(relevant).toEqual([
			["tests/models.test.ts", "module-types-separation"],
			["tests/models.test.ts", "top-level-classes"],
			["tests/test_models.py", "module-types-separation"],
			["tests/test_models.py", "top-level-classes"],
		]);
	});

	test("reports imported functions assigned as Python class fields", () => {
		const violations = fixture._project_source.with_in_memory_project(
			{
				"helper.py": "def execute():\n    return 1\n\nVALUE = 1\n",
				"model.py": "from .helper import execute, VALUE\n\nclass Service:\n    run = execute\n    value = VALUE\n",
			},
			({ root, context, files }) => {
				const class_rules = new ClassRules({ root, files: new Set(files), resolver: new ProjectSourcePython(root) });
				return class_rules.python_context_fields({ files: [...files], repo_root: root }, context, new LintStageTimer());
			},
			new Map(),
		);
		expect({
			count: violations.length,
			messages: violations.map((violation) => violation.message().includes("run")),
			lines: violations.map((violation) => violation.line()),
		}).toEqual({ count: 1, messages: [true], lines: [4] });
	});

	test("does not apply production mutability rules to test doubles", () => {
		const source_text =
			'class TestElement {\n  id = "";\n  focused = false;\n  focus(): void {\n    this.focused = true;\n  }\n}';
		const ast_file = new TypeScriptAstFile("tests/dom-kit/element.ts", source_text);
		const source_ast = new SourceFileAst(
			{ file: "tests/dom-kit/element.ts", text: source_text },
			ast_file.normalized(),
			ast_file.source_file_node(),
			new Map(),
			new TypeScriptAstTraversal(ast_file.source_file_node()),
		);
		const source_snapshot = source_ast.snapshot();
		const test_context = new ASTVerifierTestContext(source_snapshot.source_file);
		const context_state = test_context.state();
		const rule_scope = context_state.project.rule_scope;
		const linter = new CodingRuleLinter(rule_scope, process.cwd(), new SourceText(), EMPTY_PROJECT_NAMES);
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

	test("reports production class member policy from class rules", () => {
		const source_text = 'class Service { value = ""; run(): void {} }';
		const ast_file = new TypeScriptAstFile("src/service.ts", source_text);
		const source_ast = new SourceFileAst(
			{ file: "src/service.ts", text: source_text },
			ast_file.normalized(),
			ast_file.source_file_node(),
			new Map(),
			new TypeScriptAstTraversal(ast_file.source_file_node()),
		);
		const source_snapshot = source_ast.snapshot();
		const test_context = new ASTVerifierTestContext(source_snapshot.source_file);
		const context_state = test_context.state();
		const rule_scope = context_state.project.rule_scope;
		const linter = new CodingRuleLinter(rule_scope, process.cwd(), new SourceText(), EMPTY_PROJECT_NAMES);
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		const rule_ids = violations.map((violation) => violation.rule_id());

		expect(rule_ids).toEqual(expect.arrayContaining(["typescript-explicit-visibility", "typescript-mutable-field"]));
	});
});
