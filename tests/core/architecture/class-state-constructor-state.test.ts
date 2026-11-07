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
	test("treats typed constructor dependencies as instance state, not readonly fields", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNode = test_fixture._ast_nodes.class_node({
			name: "SourceNameRegistry",
			start: 0,
			end: 20,
			lines: 20,
			sloc: 20,
			interfaces: ["SourceNameRegistryContract"],
			base_class_names: [],
			extends_external_class: false,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			methods: [
				{
					name: "constructor",
					start: 1,
					end: 4,
					argument_count: 1,
					typed_arguments: [{ name: "store", type: "SourceNameStoreContract", kind: "named" }],
				},
			],
			fields: [
				{
					line: 1,
					name: "store",
					value_name: "store",
					type: "SourceNameStoreContract",
					type_kind: "named",
					readonly: true,
					class_variable: false,
					class_scope: false,
					visibility: "private",
				},
			],
			untyped_fields: [],
			dependencies: [],
		});
		const reporter = new ClassStructureReporter({
			violations,
			file_name: new LintFileName("source_name_registry.ts"),
			node,
			suppress_short_class: false,
			mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
			project_class_names: new Set(node.structure.base_class_names),
			project_contract_names: new Set(node.structure.interfaces ?? []),
			project_alias_names: new Set(),
			class_state: {
				constructor_injected_state: true,
				inherited_instance_state: false,
				inherited_state_names: new Set<string>(),
			},
		});
		reporter.report_design();

		expect(violations.some((item) => item.message() === "class is stateless")).toBe(false);
	});

	test("does not treat Python self as constructor-injected state", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const node: AstClassNode = test_fixture._ast_nodes.class_node({
			name: "PythonDuplicateSetup",
			start: 0,
			end: 20,
			lines: 20,
			sloc: 20,
			interfaces: [],
			base_class_names: [],
			extends_external_class: false,
			is_data_class: false,
			type_contract: false,
			protocol: false,
			callback_fields: 0,
			inline_callback_fields: 0,
			methods: [
				{ name: "__init__", start: 1, end: 1, argument_count: 1, has_self: true },
				{ name: "_setup_key", start: 3, end: 8, argument_count: 2, has_self: true },
			],
			fields: [],
			untyped_fields: [],
			dependencies: [],
		});
		const reporter = new ClassStructureReporter({
			violations,
			file_name: new LintFileName("python_duplicate_setup.py"),
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

		expect(violations.map((item) => ({ rule_id: item.rule_id(), message: item.message() }))).toContainEqual({
			rule_id: "stateless-class",
			message: "class is stateless",
		});
	});

	test("accepts Python classes that implement a project Protocol", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/contracts.py": [
					"from typing import Protocol",
					"class ParserContract(Protocol):",
					"    def parse(self, text: str) -> bool: ...",
				].join("\n"),
				"src/parser.py": [
					"from contracts import ParserContract",
					"class Parser(ParserContract):",
					"    def parse(self, text: str) -> bool:",
					"        return bool(text)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const parser_violations = violations.filter((item) => item.file().endsWith("src/parser.py"));

		expect(parser_violations.map((item) => item.rule_id())).not.toContain("local-inheritance");
	});
});
