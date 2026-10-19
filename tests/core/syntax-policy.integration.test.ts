import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { INVALID_POLICY_SOURCES } from "tests/bridge/ts/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("syntax policy integration", () => {
	test("reports invalid defaults, aliases, overloads, and contracts", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			INVALID_POLICY_SOURCES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((violation) => violation.message);
		const contract_field_messages = violations
			.filter((violation) => violation.rule_id === "contract-fields")
			.map((violation) => violation.message);

		expect({
			complex_defaults: messages.filter((message) => message === "avoid complex default parameter values").length,
			bare_aliases: messages.filter((message) => message === "avoid bare type aliases").length,
			empty_contracts: messages.filter((message) => message === "avoid empty protocols and interfaces").length,
			constructor_fields: messages.filter((message) => message === "declare TypeScript constructor fields explicitly")
				.length,
			visibility: messages.some((message) => message === "class members must declare visibility explicitly"),
			parameter_property: violations.filter((violation) => violation.rule_id === "typescript-parameter-property")
				.length,
			contract_fields: contract_field_messages,
			unrelated_method_rule: messages.includes("avoid methods without a class"),
		}).toEqual({
			complex_defaults: 2,
			bare_aliases: 2,
			empty_contracts: 2,
			constructor_fields: 2,
			visibility: true,
			parameter_property: 2,
			contract_fields: [
				'protocol "UserStore" must not declare mutable field "cache"',
				'protocol "UserStore" must not declare mutable field "enabled"',
				'interface "UserStore" must not declare mutable field "cache"',
			],
			unrelated_method_rule: false,
		});
	});

	test("accepts primitive defaults, structural aliases, and contract methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"valid.ts": [
					'function build(name = "", count = 0, enabled = false, value = null, values = [], options = {}) {}',
					"type RuntimeShape = { value: string };",
					"interface ServiceContract { run(): void; }",
				].join("\n"),
				"valid.py": [
					'def build(name = "", count = 0, enabled = False, value = None, values = [], options = {}):',
					"    return name, count, enabled, value, values, options",
					"",
					"from typing import Protocol",
					"class ServiceContract(Protocol):",
					"    def run(self) -> None: ...",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const restricted_messages = [
			"avoid complex default parameter values",
			"avoid bare type aliases",
			"avoid empty protocols and interfaces",
			"declare TypeScript constructor fields explicitly",
			"class members must declare visibility explicitly",
		];

		expect(violations.filter((violation) => restricted_messages.includes(violation.message))).toEqual([]);
	});
});
