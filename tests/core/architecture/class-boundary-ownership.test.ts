import "src/core/lint_project_context_creator";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import "src/lint_stage_timer";
import { LintFileName } from "src/core/context/lint_file_name";
import { RULE_IDS } from "src/linting/constants";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { EMPTY_MUTATED_FIELDS } from "src/metrics/constants";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import { MixCollection } from "src/rules/mix_collection";
import { TestFixture } from "tests/core/test-fixture";

describe("class boundary ownership", () => {
	test("does not exempt project files from class and function ownership checks", () => {
		const test_fixture = new TestFixture();
		const source = "class Service:\n    pass\n\ndef build():\n    return 1";
		const files = ["src/handlers/request.py", "src/handlers/configuration.py", "src/context.py"];
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			Object.fromEntries(files.map((file) => [file, source])),
			(production_lint_configuration, options, mode) => {
				const lint_report = production_lint_configuration.lint_report(options, mode);
				return lint_report.report.violations;
			},
		);
		const mixed_module_counts = files.map(
			(file) => violations.filter((item) => item.rule_id() === "mixed-module" && item.file().endsWith(file)).length,
		);
		expect(mixed_module_counts).toEqual([1, 1, 1]);
	});

	test("allows exception classes to share a file with parsing functions", () => {
		const test_fixture = new TestFixture();

		const lengths = ["errors.ts", "errors.py"].map((file) => {
			const violations: ViolationContract[] = [];
			const collection = new MixCollection(
				new LintFileName(file),
				[
					test_fixture._ast_nodes.class_node({
						name: file.endsWith(".py") ? "AgentValidationException" : "AgentValidationError",
						start: 8,
						end: 20,
						base_class_names: [file.endsWith(".py") ? "ValueError" : "Error"],
						type_contract: false,
						protocol: false,
						methods: [],
					}),
				],
				[test_fixture._ast_nodes.callable_node({ name: "parse_response", start: 2, end: 6, argument_count: 1 })],
				new DiagnosticRule(RULE_IDS.mixed_module),
			);
			collection.append_mix_violations(violations);
			return violations.length;
		});
		expect(lengths).toEqual([0, 0]);
	});

	test("checks short local classes regardless of their names", () => {
		const results = ["RequestHandler", "ProxyServer", "PayloadError"].map((name) => {
			const violations: ViolationContract[] = [];
			const test_fixture = new TestFixture();
			const node: AstClassNode = test_fixture._ast_nodes.class_node({
				name,
				start: 0,
				end: 1,
				lines: 1,
				sloc: 1,
				interfaces: [],
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
			});
			const reporter = new ClassStructureReporter({
				violations,
				file_name: new LintFileName(`${name}.ts`),
				node,
				suppress_short_class: false,
				mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
				project_class_names: new Set(node.structure.base_class_names),
				project_contract_names: new Set(node.structure.interfaces ?? []),
				project_alias_names: new Set(),
				class_state: {
					constructor_injected_state: false,
					inherited_instance_state: false,
					inherited_state_names: new Set<string>(),
				},
			});
			reporter.report_sizes();
			return violations.some((item) => item.message().includes("class is too short"));
		});
		expect(results).toEqual([true, true, true]);
	});

	test("skips methods when the class extends an external framework base", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNode = test_fixture._ast_nodes.class_node({
			name: "WebMcpProxyHandler",
			start: 0,
			end: 40,
			lines: 40,
			sloc: 40,
			interfaces: [],
			base_class_names: [],
			extends_external_class: true,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			methods: [{ name: "do_GET", start: 10, end: 12, argument_count: 1 }],
			fields: [],
			untyped_fields: [],
			dependencies: [],
		});
		const reporting = new ClassStructureReporter({
			violations,
			file_name: new LintFileName("tools/webmcp/core/proxy_handler.py"),
			node,
			suppress_short_class: false,
			mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
			project_class_names: new Set(node.structure.base_class_names),
			project_contract_names: new Set(node.structure.interfaces ?? []),
			project_alias_names: new Set(),
			class_state: {
				constructor_injected_state: false,
				inherited_instance_state: false,
				inherited_state_names: new Set<string>(),
			},
		});
		reporting.report_class_methods();

		expect(violations.some((item) => item.message().includes("method is too short"))).toBe(false);
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "external-handler.ts": source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		violations.push(...parsed_violations);

		expect(violations.map((item) => item.message())).not.toEqual(
			expect.arrayContaining([expect.stringContaining("method has")]),
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some(
				(item) => item.file() === "child.ts" && item.message() === 'declaration inherits from non-contract base "Base"',
			),
		).toBe(false);
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some(
				(item) =>
					item.file().includes("src/child.ts") &&
					item.message() === 'declaration inherits from non-contract base "Base"',
			),
		).toBe(true);
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some(
				(item) =>
					item.file().includes("src/child.ts") &&
					item.message() === 'declaration inherits from non-contract base "RenamedBase"',
			),
		).toBe(true);
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some(
				(item) =>
					item.file().includes("src/child.ts") &&
					item.message() === 'declaration inherits from non-contract base "namespace.Base"',
			),
		).toBe(true);
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((item) => item.file().includes("child.ts") && item.rule_id() === "local-inheritance")).toBe(
			false,
		);
	});
});
