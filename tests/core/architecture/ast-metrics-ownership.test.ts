import "src/core/lint_project_context_creator";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import "src/lint_stage_timer";
import { MixCollection } from "src/rules/mix_collection";
import { TestFixture } from "tests/core/test-fixture";
import type { ViolationContract } from "src/reporting_protocols";
import { LintFileName } from "src/core/context/lint_file_name";
import { ClassReporting } from "src/core/support/source-analysis/class_reporting";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import type { AstClassNodeContract } from "src/types";

describe("normalized AST class metrics and ownership", () => {
	test("does not exempt project files from class and function ownership checks", () => {
		const test_fixture = new TestFixture();
		const source = "class Service:\n    pass\n\ndef build():\n    return 1";
		const files = ["src/handlers/request.py", "src/handlers/configuration.py", "src/context.py"];
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			Object.fromEntries(files.map((file) => [file, source])),
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const mixed_module_counts = files.map(
			(file) => violations.filter((item) => item.rule_id === "mixed-module" && item.file.endsWith(file)).length,
		);
		expect(mixed_module_counts).toEqual([1, 1, 1]);
	});

	test("allows exception classes to share a file with parsing functions", () => {
		const mix_collection = new MixCollection();
		const test_fixture = new TestFixture();

		const lengths = ["errors.ts", "errors.py"].map((file) => {
			const violations: ViolationContract[] = [];
			mix_collection.append_mix_violations(
				violations,
				[
					test_fixture.ast_nodes.class_node({
						name: file.endsWith(".py") ? "AgentValidationException" : "AgentValidationError",
						start: 8,
						end: 20,
						base_class_name: file.endsWith(".py") ? "ValueError" : "Error",
						base_class_names: [],
						type_contract: false,
						protocol: false,
						methods: [],
					}),
				],
				[test_fixture.ast_nodes.callable_node({ name: "parse_response", start: 2, end: 6, argument_count: 1 })],
				new LintFileName(file),
			);
			return violations.length;
		});
		expect(lengths).toEqual([0, 0]);
	});

	test("checks short local classes regardless of their names", () => {
		const results = ["RequestHandler", "ProxyServer", "PayloadError"].map((name) => {
			const violations: ViolationContract[] = [];
			const node: AstClassNodeContract = {
				name,
				start: 0,
				end: 1,
				lines: 1,
				sloc: 1,
				interfaces: [],
				base_class_name: "",
				base_class_names: [],
				extends_external_class: false,
				is_data_class: false,
				type_contract: false,
				protocol: false,
				callback_fields: 0,
				inline_callback_fields: 0,
				methods: [],
				fields: [],
				untyped_fields: [],
				dependencies: [],
			};
			const reporter = new ClassStructureReporter(violations, new LintFileName(`${name}.ts`), node);
			reporter.report_sizes();
			return violations.some((item) => item.message.includes("class is too short"));
		});
		expect(results).toEqual([true, true, true]);
	});

	test("skips methods when the class extends an external framework base", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNodeContract = {
			name: "WebMcpProxyHandler",
			start: 0,
			end: 40,
			lines: 40,
			sloc: 40,
			interfaces: [],
			base_class_name: "",
			base_class_names: [],
			extends_external_class: true,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			methods: [test_fixture.ast_nodes.callable_node({ name: "do_GET", start: 10, end: 12, argument_count: 1 })],
			fields: [],
			untyped_fields: [],
			dependencies: [],
		};
		const reporting = new ClassReporting();
		reporting.report_class_methods(violations, new LintFileName("tools/webmcp/core/proxy_handler.py"), node);

		expect(violations.some((item) => item.message.includes("method is too short"))).toBe(false);
	});

	test("skips method length metrics for classes extending external bases", () => {
		const test_fixture = new TestFixture();

		const violations: ViolationContract[] = [];
		const source = [
			"class ExternalHandler extends HttpHandler {",
			"  veryLongExternalHandlerMethodName() { return 1; }",
			"}",
		].join("\n");
		const parsed_violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "external-handler.ts": source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		violations.push(...parsed_violations);

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining("method has"),
				}),
			]),
		);
	});

	test("resolves aliased external bases by their defining module", () => {
		const test_fixture = new TestFixture();
		const files = {
			"local.ts": "export class Base {}",
			"child.ts": [
				'import { ExternalBase as Base } from "external-package";',
				"export class Child extends Base {",
				"  run(): void {}",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).not.toContainEqual(
			expect.objectContaining({
				file: "child.ts",
				message: 'class inherits from local class "Base"',
			}),
		);
	});

	test("keeps project aliases local when the import uses a source-root specifier", () => {
		const test_fixture = new TestFixture();
		const files = {
			"src/base.ts": "export class Base { public value = 1; }",
			"src/child.ts": [
				'import { Base } from "src/base";',
				"export class Child extends Base {",
				"  public value = 2;",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				file: expect.stringContaining("src/child.ts"),
				message: 'class inherits from local class "Base"',
			}),
		);
	});

	test("keeps renamed project bases local", () => {
		const test_fixture = new TestFixture();
		const files = {
			"src/base.ts": "export class Base { public value = 1; }",
			"src/child.ts": [
				'import { Base as RenamedBase } from "src/base";',
				"export class Child extends RenamedBase {",
				"  public value = 2;",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				file: expect.stringContaining("src/child.ts"),
				message: 'class inherits from local class "RenamedBase"',
			}),
		);
	});

	test("keeps namespace-imported project bases local", () => {
		const test_fixture = new TestFixture();
		const files = {
			"src/base.ts": "export class Base { public value = 1; }",
			"src/child.ts": [
				'import * as namespace from "src/base";',
				"export class Child extends namespace.Base {",
				"  public value = 2;",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				file: expect.stringContaining("src/child.ts"),
				message: 'class inherits from local class "namespace.Base"',
			}),
		);
	});

	test("does not treat an external barrel member as a local namespace base", () => {
		const test_fixture = new TestFixture();
		const files = {
			"barrel.ts": 'export { ExternalBase } from "external-package";',
			"child.ts": [
				'import * as namespace from "./barrel";',
				"export class Child extends namespace.ExternalBase {",
				"  public value = 1;",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).not.toContainEqual(
			expect.objectContaining({
				file: expect.stringContaining("child.ts"),
				rule_id: "local-inheritance",
			}),
		);
	});

	test("reports stateless classes and forbids local class inheritance", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNodeContract = {
			name: "Child",
			start: 4,
			end: 20,
			lines: 16,
			sloc: 16,
			interfaces: [],
			base_class_name: "Base",
			base_class_names: ["Base"],
			extends_external_class: false,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			methods: [test_fixture.ast_nodes.callable_node({ name: "run", start: 5, end: 8, argument_count: 0 })],
			fields: [],
			untyped_fields: [],
			dependencies: [],
		};
		const reporter = new ClassStructureReporter(violations, new LintFileName("local.ts"), node);
		reporter.report_design();

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "class is stateless",
					priority: 6,
				}),
				expect.objectContaining({
					message: 'class inherits from local class "Base"',
					priority: 6,
				}),
			]),
		);
	});

	test("allows stateful classes and external inheritance", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNodeContract = {
			name: "Handler",
			start: 0,
			end: 40,
			lines: 40,
			sloc: 40,
			interfaces: [],
			base_class_name: "",
			base_class_names: [],
			extends_external_class: true,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			fields: [
				{
					line: 2,
					name: "client",
					value_name: "Client",
					type: "Client",
					type_kind: "basic",
					readonly: false,
					class_variable: false,
					class_scope: false,
					visibility: "public",
				},
			],
			methods: [test_fixture.ast_nodes.callable_node({ name: "constructor", start: 1, end: 4, argument_count: 1 })],
			untyped_fields: [],
			dependencies: [],
		};
		const reporter = new ClassStructureReporter(violations, new LintFileName("external.ts"), node);
		reporter.report_design();

		expect(violations.some((item) => item.message === "class is stateless")).toBe(false);
		expect(violations.some((item) => item.message.includes("inherits from local class"))).toBe(false);
	});

	test("reports mixins without applying unrelated class design rules", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNodeContract = {
			name: "LoggingMixin",
			start: 0,
			end: 20,
			lines: 20,
			sloc: 20,
			interfaces: [],
			base_class_name: "BaseMixin",
			base_class_names: ["BaseMixin"],
			extends_external_class: false,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			methods: [test_fixture.ast_nodes.callable_node({ name: "log", start: 1, end: 4, argument_count: 1 })],
			fields: [],
			untyped_fields: [],
			dependencies: [],
		};
		const reporter = new ClassStructureReporter(violations, new LintFileName("mixin.py"), node);
		reporter.report_design();

		expect({
			stateless: violations.some((item) => item.message === "class is stateless"),
			inheritance: violations.some((item) => item.message.includes("inherits from local class")),
			mixin: violations.some(
				(item) => item.message === 'class uses mixin pattern "LoggingMixin"' && item.priority === 6,
			),
		}).toEqual({ stateless: false, inheritance: false, mixin: true });
	});
});
