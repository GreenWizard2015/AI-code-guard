import "src/core/lint_project_context_creator";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { LintStageTimer } from "src/lint_stage_timer";
import { CONTROL_FLOW_SOURCE, PYTHON_CALLABLE_SOURCE } from "tests/core/constants/ast_analysis/constants";
import { TestFixture } from "tests/core/test-fixture";
describe("parsePythonAst", () => {
	test("sends source code with the explicit bridge source prefix", () => {
		const bridge = new PythonAstBridge();
		const options = bridge.bridge_options("class Item:\n    pass\n");

		expect(options.input).toBe("code:class Item:\n    pass\n");
	});

	test("parses multiple source texts through one batch bridge request", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.batch_ast({
			texts: ["class First:\n    pass\n", "def second():\n    pass\n"],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [],
			repo_root: "",
		});

		expect(
			parsed.map((item) => ({
				classes: item.source.classes.map((node) => node.identity.name),
				functions: item.source.functions.map((node) => node.identity.name),
			})),
		).toEqual([
			{ classes: ["First"], functions: [] },
			{ classes: [], functions: ["second"] },
		]);
	});

	test("extracts classes, methods, async functions, and argument counts", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(PYTHON_CALLABLE_SOURCE);

		expect({
			language: parsed.source.language,
			classes: parsed.source.classes.map((node) => node.identity.name),
			methods: parsed.source.classes.map((class_node) =>
				class_node.structure.methods.map((node) => [node.identity.name, node.metrics.argument_count]),
			),
			sloc: parsed.source.classes.map((class_node) => class_node.identity.sloc),
			lines: parsed.source.classes.map((class_node) => class_node.identity.lines),
			argument_uses: parsed.source.classes.flatMap((class_node) =>
				class_node.structure.methods.flatMap((method) => method.signature.argument_uses),
			),
		}).toEqual({
			language: "python",
			classes: ["Service"],
			methods: [
				[
					["__init__", 2],
					["run", 3],
				],
			],
			sloc: [5],
			lines: [5],
			argument_uses: expect.arrayContaining([expect.objectContaining({ name: "first", count: 4 })]),
		});
	});

	test("extracts functions and callable metrics", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());
		const parsed = python_ast_parser.source_ast(PYTHON_CALLABLE_SOURCE);
		expect({
			functions: parsed.source.functions.map((node) => [node.identity.name, node.metrics.argument_count]),
			methods_have_characters: parsed.source.classes
				.flatMap((node) => node.structure.methods)
				.every((node) => node.metrics.characters > 0),
			functions_have_characters: parsed.source.functions.every((node) => node.metrics.characters > 0),
			parse_issues: parsed.source.parse_issues,
		}).toEqual({
			functions: [
				["build", 2],
				["load", 2],
			],
			methods_have_characters: true,
			functions_have_characters: true,
			parse_issues: [],
		});
	});

	test("preserves generic argument annotations", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			[
				"class Result:",
				"    pass",
				"",
				"def collect(items: list[Result], fallback: Result, limit: int):",
				"    return items, fallback, limit",
			].join("\n"),
		);

		expect(parsed.source.functions.map((function_node) => function_node.signature.typed_arguments)).toEqual([
			[
				{ name: "items", type: "list[Result]", kind: "generic" },
				{ name: "fallback", type: "Result", kind: "named" },
				{ name: "limit", type: "int", kind: "basic" },
			],
		]);
	});

	test("collects import aliases for reference normalization", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			[
				"from model import RequestData as RequestAlias",
				"import package as package_alias",
				"",
				"def read(value: RequestAlias):",
				"    return value",
			].join("\n"),
		);

		expect(parsed.references.reference_aliases).toEqual([
			{ name: "RequestAlias", target: "RequestData" },
			{ name: "package_alias", target: "package" },
		]);
	});

	test("returns syntax errors as parse diagnostics", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast("def broken(:\n    pass\n");

		expect({
			classes: parsed.source.classes,
			functions: parsed.source.functions,
			issue_count: parsed.source.parse_issues.length,
			issues: parsed.source.parse_issues.map((issue) => ({
				line: issue.line,
				has_message: issue.message.length > 0,
			})),
			module_constant_spans: parsed.module_declarations.module_constant_spans,
			module_type_spans: parsed.module_declarations.module_type_spans,
			module_protocol_spans: parsed.module_declarations.module_protocol_spans,
			module_instances: parsed.control_flow.module_instances,
			type_members: parsed.references.type_members,
		}).toEqual({
			classes: [],
			functions: [],
			issue_count: 1,
			issues: [{ line: 0, has_message: true }],
			module_constant_spans: [],
			module_type_spans: [],
			module_protocol_spans: [],
			module_instances: [],
			type_members: new Map(),
		});
	});

	test("recognizes documented annotation-only classes as type contracts", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			["class Payload:", '    """External payload shape."""', "    value: str"].join("\n"),
		);

		expect(parsed.source.classes.map((class_node) => class_node.classification.type_contract)).toEqual([true]);
	});

	test("counts callable body lines independently from SLOC", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			[
				"def run_edit_flow(",
				"    editor: Editor,",
				"    input: Input,",
				") -> Result:",
				"    # Comments do not add callable SLOC.",
				"    return execute(editor, input)",
			].join("\n"),
		);

		expect(parsed.source.functions.map((function_node) => function_node.metrics)).toEqual([
			expect.objectContaining({ lines: 1, sloc: 2 }),
		]);
	});

	test("ignores callable docstrings in size metrics and statements", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			[
				"def documented():",
				'    """',
				"    This documentation must not affect callable metrics.",
				'    """',
				"    return 1",
			].join("\n"),
		);

		expect({
			metrics: parsed.source.functions.map((function_node) => function_node.metrics),
			statements: parsed.source.functions.map((function_node) => function_node.signature.statements),
		}).toEqual({
			metrics: [expect.objectContaining({ lines: 1, sloc: 2 })],
			statements: [[{ kind: "return", line: 4 }]],
		});
	});

	test("counts class body lines independently from its declaration", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			["class Service(", "    Base,", "):", "    def run(self) -> None:", "        execute()"].join("\n"),
		);

		expect(parsed.source.classes.map((class_node) => class_node.identity)).toEqual([
			expect.objectContaining({ lines: 2 }),
		]);
	});

	test("ignores class docstrings in class size metrics", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			[
				"class Service:",
				'    """',
				"    This documentation must not affect class metrics.",
				'    """',
				"    def run(self) -> None:",
				"        return None",
			].join("\n"),
		);

		expect(
			parsed.source.classes.map((class_node) => ({
				identity: class_node.identity,
				methods: class_node.structure.methods.map((method) => method.metrics),
			})),
		).toEqual([
			{
				identity: expect.objectContaining({ lines: 2, sloc: 3 }),
				methods: [expect.objectContaining({ lines: 1, sloc: 2 })],
			},
		]);
	});

	test("counts dataclass decorators and fields as four lines and four SLOC", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			[
				"@dataclass",
				"class PythonReferenceCollector:",
				"    tree: ast.Module",
				"    _state: PythonReferenceState = field(default_factory=PythonReferenceState)",
			].join("\n"),
		);

		expect(parsed.source.classes.map((class_node) => class_node.identity)).toEqual([
			expect.objectContaining({ lines: 4, sloc: 4 }),
		]);
	});

	test("counts nested control statements in callable SLOC", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(
			["def walk(items: list[str]) -> None:", "    for item in items:", "        if item:", "            return"].join(
				"\n",
			),
		);

		expect(parsed.source.functions.map((function_node) => function_node.metrics)).toEqual([
			expect.objectContaining({ sloc: 4 }),
		]);
	});

	test("counts a single call in each control-flow body as two SLOC", () => {
		const fixture = new TestFixture();
		const python_ast_parser = new PythonAstData(fixture.python_ast_options());

		const parsed = python_ast_parser.source_ast(CONTROL_FLOW_SOURCE);

		expect(parsed.source.functions.map((node) => node.metrics.sloc)).toEqual([3, 3, 3, 3, 3, 4, 4]);
	});
});
