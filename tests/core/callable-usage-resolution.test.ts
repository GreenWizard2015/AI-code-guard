import "src/linting/composition/composition_model";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import "src/callable_usage";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

import {
	FORWARD_ANNOTATION_FILES,
	LOCAL_CALLABLE_FILES,
	LOCAL_PYTHON_CALLABLE_FILES,
	PROTOCOL_CONTAINER_FILES,
	TYPE_CHECKING_PROPERTY_FILES,
} from "tests/core/constants/callable_usage/constants";

describe("coding-lint callable usage rule", () => {
	const test_fixture = new TestFixture();
	test("keeps local function and interface method usage cases distinct", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": [
					"function localOnly() { return 1; }",
					"function caller() { return localOnly(); }",
					"interface ServicePort {",
					"  execute(value: string): Promise<void>;",
					"}",
					"class Service implements ServicePort {",
					"  execute(value: string): Promise<void> {",
					"    return Promise.resolve();",
					"  }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const messages = violations.map((violation) => violation.message());
		expect(messages).not.toContain(
			'function "localOnly" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
		);
		expect(messages.some((message) => message.includes("ServicePort.execute"))).toBe(false);
	});
	test("resolves Python imports and concrete methods behind protocol containers", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": "def perform() -> int:\n    return 1\n",
				"consumer.py": "from functions import perform\n\nperform()\n",
				...PROTOCOL_CONTAINER_FILES,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const messages = violations.map((violation) => violation.message());
		expect({
			perform_unused: messages.some((message) =>
				message.includes('function "perform" has insufficient production usage'),
			),
			matches_used: messages.includes(
				'method "ConcreteHandler.matches" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			handle_used: messages.includes(
				'method "ConcreteHandler.handle" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			matches_unused: messages.includes(
				'method "ConcreteHandler.matches" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
			),
			handle_unused: messages.includes(
				'method "ConcreteHandler.handle" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
			),
		}).toEqual({
			perform_unused: false,
			matches_used: false,
			handle_used: false,
			matches_unused: false,
			handle_unused: false,
		});
	});
	test("does not report TypeScript and Python callables used only in their defining files", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ ...LOCAL_CALLABLE_FILES, ...LOCAL_PYTHON_CALLABLE_FILES },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const messages = violations.map((violation) => violation.message());
		expect({
			helper: messages.some((message) =>
				message.includes('method "Service.helper" has insufficient production usage (found 0 other production files'),
			),
			ts_hidden: messages.some((message) => message.includes('method "Service.hidden"')),
			python_hidden: messages.some((message) => message.includes('method "Service._hidden"')),
		}).toEqual({ helper: false, ts_hidden: false, python_hidden: false });
	});
	test("resolves Python properties and methods through annotations and local factories", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ ...TYPE_CHECKING_PROPERTY_FILES, ...FORWARD_ANNOTATION_FILES },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const messages = violations.map((violation) => violation.message());
		expect({
			directory_used: messages.some((message) =>
				message.includes('method "BrowserBridgeDirectory.has_tool" has insufficient production usage'),
			),
			transport_used: messages.some((message) =>
				message.includes('method "BrowserBridgeTransport.poll" has insufficient production usage'),
			),
			client_used: messages.some((message) =>
				message.includes('method "Client.initialize" has insufficient production usage'),
			),
		}).toEqual({ directory_used: false, transport_used: false, client_used: false });
	});
	test("resolves methods on objects returned by local method calls", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Observer {", "  observe() {}", "}"].join("\n"),
				"caller.ts": [
					"import { Observer } from './source';",
					"class Coordinator {",
					"  create_observer(): Observer {",
					"    return new Observer();",
					"  }",
					"  run() {",
					"    this.create_observer().observe();",
					"  }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const messages = violations.map((violation) => violation.message());
		expect(messages).not.toContain(
			'method "Observer.observe" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
		);
		expect(messages).not.toContain(
			'method "Observer.observe" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
		);
	});
	test("resolves methods through nullable typed parameters", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": [
					"export class InputElement {",
					"  private readonly element = document.body;",
					"  raw() { return this.element; }",
					"}",
					"export function exclude(input: InputElement | null): HTMLElement | null {",
					"  return input ? input.raw() : null;",
					"}",
				].join("\n"),
				"one.ts": ["import { exclude } from './source';", "exclude(null);"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "InputElement.raw"'))).toBe(false);
	});
	test("resolves methods on class properties initialized by typed factories", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"cron.ts": [
					"export class Cron {",
					"  stop() { return undefined; }",
					"}",
					"export function create_cron(): Cron { return new Cron(); }",
				].join("\n"),
				"controller.ts": [
					"import { create_cron } from './cron';",
					"export class Controller {",
					"  private readonly cron: Cron = create_cron();",
					"  run() { this.cron.stop(); }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((violation) => violation.message())).not.toContain(
			'method "Cron.stop" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
		);
	});
});
