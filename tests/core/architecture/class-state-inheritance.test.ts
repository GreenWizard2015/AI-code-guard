import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { LintFileName } from "src/core/context/lint_file_name";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { EMPTY_MUTATED_FIELDS } from "src/metrics/constants";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { TestFixture } from "tests/core/test-fixture";

describe("class state ownership", () => {
	test("does not inherit state from readonly collections without mutation", () => {
		const test_fixture = new TestFixture();
		const files = {
			"src/static_cache.ts": [
				"class StaticCache {",
				"  private static values: Map<string, number> = new Map();",
				"}",
			].join("\n"),
			"src/readonly_cache.ts": [
				"class ReadonlyCache {",
				"  private readonly values: WeakMap<object, string> = new WeakMap();",
				"  public get(key: object): string | undefined { return this.values.get(key); }",
				"}",
				"class ReadonlyCacheView extends ReadonlyCache {",
				"  public lookup(key: object): string | undefined { return this.get(key); }",
				"}",
			].join("\n"),
			"src/mutated_cache.ts": [
				"class MutatedReadonlyCache {",
				"  private readonly values: WeakMap<object, string> = new WeakMap();",
				"  public put(key: object, value: string): void { this.values.set(key, value); }",
				"}",
				"class MutatedReadonlyCacheView extends MutatedReadonlyCache {}",
			].join("\n"),
			"src/injected_state.ts": [
				"interface ValueStoreContract { read(): string; }",
				"class InjectedState {",
				"  private readonly store: ValueStoreContract;",
				"  public constructor(store: ValueStoreContract) { this.store = store; }",
				"  public read(): string { return this.store.read(); }",
				"}",
				"class InheritedInjectedState extends InjectedState {",
				"  public read_again(): string { return this.read(); }",
				"}",
			].join("\n"),
			"src/unused_constructor.ts": [
				"interface StoreContract { read(): string; }",
				"class UnusedConstructorArgument {",
				"  public constructor(store: StoreContract) {}",
				"}",
				"class UnusedConstructorChild extends UnusedConstructorArgument {}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const stateless_classes = violations
			.filter((item) => item.rule_id() === "stateless-class")
			.map((item) => ({ file: item.file(), line: item.line() }))
			.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

		expect(stateless_classes).toEqual([
			{ file: "src/readonly_cache.ts", line: 1 },
			{ file: "src/readonly_cache.ts", line: 5 },
			{ file: "src/static_cache.ts", line: 1 },
			{ file: "src/unused_constructor.ts", line: 2 },
			{ file: "src/unused_constructor.ts", line: 5 },
		]);
	});

	test("resolves inherited state by module symbol including imported aliases", () => {
		const test_fixture = new TestFixture();
		const files = {
			"src/stateful/base.ts": ["export class SharedBase {", "  private value = 1;", "}"].join("\n"),
			"src/stateless/base.ts": "export class SharedBase {}",
			"src/alias_catalog.ts": ["export class StatefulBase {}", "export class StatelessBase {}"].join("\n"),
			"src/stateful/child.ts": [
				'import { SharedBase as StatefulBase } from "./base";',
				"export class StatefulChild extends StatefulBase {}",
			].join("\n"),
			"src/stateful/grandchild.ts": [
				'import { StatefulChild } from "./child";',
				"export class StatefulGrandchild extends StatefulChild {}",
			].join("\n"),
			"src/stateless/child.ts": [
				'import { SharedBase as StatelessBase } from "./base";',
				"export class StatelessChild extends StatelessBase {}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const stateless_classes = violations
			.filter((item) => item.rule_id() === "stateless-class")
			.map((item) => ({ file: item.file(), line: item.line() }))
			.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

		expect(stateless_classes).toEqual([
			{ file: "src/alias_catalog.ts", line: 1 },
			{ file: "src/alias_catalog.ts", line: 2 },
			{ file: "src/stateless/base.ts", line: 1 },
			{ file: "src/stateless/child.ts", line: 2 },
		]);
	});

	test("allows stateful classes and external inheritance", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNode = test_fixture._ast_nodes.class_node({
			name: "Handler",
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
			methods: [{ name: "constructor", start: 1, end: 4, argument_count: 1 }],
			untyped_fields: [],
			dependencies: [],
		});
		const reporter = new ClassStructureReporter({
			violations,
			file_name: new LintFileName("external.ts"),
			node,
			suppress_short_class: false,
			mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
			project_class_names: new Set(),
			project_contract_names: new Set(),
			project_alias_names: new Set(),
			class_state: {
				constructor_injected_state: false,
				inherited_instance_state: false,
				inherited_state_names: new Set<string>(),
			},
		});
		reporter.report_design();

		expect(violations.some((item) => item.message() === "class is stateless")).toBe(false);
		expect(violations.some((item) => item.message().includes("inherits from non-contract base"))).toBe(false);
	});

	test("reports concrete inheritance alongside independent stateless diagnostics", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNode = test_fixture._ast_nodes.class_node({
			name: "LoggingAdapter",
			start: 0,
			end: 20,
			lines: 20,
			sloc: 20,
			interfaces: [],
			base_class_names: ["Base"],
			extends_external_class: false,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			methods: [{ name: "log", start: 1, end: 4, argument_count: 1 }],
			fields: [],
			untyped_fields: [],
			dependencies: [],
		});
		const reporter = new ClassStructureReporter({
			violations,
			file_name: new LintFileName("adapter.py"),
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
		reporter.report_design();

		expect({
			stateless: violations.some((item) => item.message() === "class is stateless"),
			inheritance: violations.some((item) => item.message().includes("inherits from non-contract base")),
		}).toEqual({ stateless: true, inheritance: true });
	});
});
