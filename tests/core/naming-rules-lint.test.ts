import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";
import {
	EXTERNAL_NAME_FILES,
	IGNORED_EXTERNAL_NAMES,
	PYTHON_ALIAS_FILES,
	REPORTED_PROJECT_NAMES,
	TYPESCRIPT_DECLARATION_FILES,
} from "tests/core/constants/callable_usage/constants";

describe("naming rules integration", () => {
	test("validates TypeScript symbols, properties, methods, and external names", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"underscores.ts": [
					"function _module_helper() { return 1; }",
					"class Service {",
					"  _public_helper() { return 1; }",
					"  private _private_helper() { return 1; }",
					"}",
					"const _ = 1; const __ = 2; const _constant = 1; let _variable = 1;",
					"function _module_function(_parameter: string) { return _parameter; }",
					"class Names { _field = 1; private _private_method() { return 1; } protected _protected_method() { return 1; } public _public_method() { return 1; } }",
				].join("\n"),
				"words.ts": [
					"const VALID_NAME = 1; const module_name = 1; const storeFailedTaskResult = () => VALID_NAME;",
					"function four_word_function_name() { return VALID_NAME; } function valid_function() { return VALID_NAME; }",
					"class Sample { method_with_local_constant() { const local_name = 1; return local_name; } storeFailedTaskResult = 1; storeFailedTaskResult() { return VALID_NAME; } }",
				].join("\n"),
				"type-fields.ts": "type InputShape = { fileName: string; projectClassNames?: ReadonlySet<string>; };",
				"records.ts":
					"export type PythonLintInput = { file_name: string; text: string; project_class_names?: ReadonlySet<string>; project_protocol_names?: ReadonlySet<string>; project_type_names?: ReadonlySet<string>; normalized_ast?: object; }; export type LintSourceRecord = { absolutePath: string; relativePath: string; fileName: string; text: string; language: string; typescriptAst?: object; normalizedAst: object; };",
				"tests/source.test.ts": "function storeFailedTaskResultWithExtraWords() { return 1; }",
				"methods.ts": [
					"declare const facebook_module: { sendAndReceive: (value: unknown) => unknown };",
					'facebook_module.sendAndReceive({ externalId: "message" });',
					"interface NavigationPort { get_stale_input(): HTMLElement | null; getStaleComposerInput(): HTMLElement | null; }",
					"class ExternalHandler extends HttpHandler { veryLongExternalHandlerMethodName() { return 1; } }",
					"class ProjectHandler {} class DerivedHandler extends ProjectHandler { veryLongProjectMethodName() { return 1; } }",
				].join("\n"),
				"external-runtime.ts": EXTERNAL_NAME_FILES["source.ts"],
				"declarations.ts": TYPESCRIPT_DECLARATION_FILES["source.ts"],
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((violation) => violation.message);

		expect({
			expected_messages: messages,
			private_method_reported: messages.some((message) => message.includes("_private_method")),
			long_test_symbol_reported: messages.some((message) => message.includes("storeFailedTaskResultWithExtraWords")),
			ignored_external_names_reported: IGNORED_EXTERNAL_NAMES.some((name) =>
				messages.some((message) => message.includes(`"${name}"`)),
			),
			reported_project_names_present: REPORTED_PROJECT_NAMES.every((name) =>
				messages.some((message) => message.includes(`"${name}"`)),
			),
		}).toEqual({
			expected_messages: expect.arrayContaining([
				'constant "_constant" must not use a leading underscore',
				'variable "_variable" must not use a leading underscore',
				'module function "_module_function" must not use a leading underscore',
				'protected method "_protected_method" must not use a leading underscore',
				'public method "_public_method" must not use a leading underscore',
				'function "four_word_function_name" must use snake_case and has too many words (found 4)',
				'module-level constant "module_name" must use UPPER_SNAKE_CASE',
				'field "projectClassNames" must use snake_case and has too many words (found 3)',
				'method "getStaleComposerInput" must use snake_case and has too many words (found 4)',
				'type "invalid_type" must use PascalCase without underscores',
				'type "_InvalidInterface" must not use a leading underscore',
			]),
			private_method_reported: false,
			long_test_symbol_reported: false,
			ignored_external_names_reported: false,
			reported_project_names_present: true,
		});
	});

	test("applies leading-underscore and TypeAlias naming rules to Python", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"symbols.py": [
					"_constant = 1",
					"_ = 2",
					"__ = 3",
					"class Service:",
					"    _field = 1",
					"    def _private_method(self) -> None:",
					"        return None",
					"    def __init__(self) -> None:",
					"        return None",
					"from typing import TypeAlias",
					PYTHON_ALIAS_FILES["source.py"],
					"",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((violation) => violation.message);

		expect({
			expected_messages: messages,
			field_reported: messages.includes('field "_field" must use snake_case and has too many words (found 1)'),
			magic_method_reported: messages.includes('public method "__init__" must not use a leading underscore'),
		}).toEqual({
			expected_messages: expect.arrayContaining([
				'variable "_constant" must not use a leading underscore',
				'type alias "valid_alias" must use PascalCase without underscores',
				'type_alias "_PrivateAlias" must not use a leading underscore',
			]),
			field_reported: false,
			magic_method_reported: false,
		});
	});
});
