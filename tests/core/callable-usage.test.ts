import "src/linting/orchestration/runtime/global-analysis/composition_model";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";
import { TYPESCRIPT_USAGE_FILES, PYTHON_USAGE_FILES } from "tests/core/constants/callable_usage/constants";

describe("coding-lint callable usage rule", () => {
	const test_fixture = new TestFixture();

	test("reports TypeScript functions and methods with no external production callers", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			TYPESCRIPT_USAGE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const existing_rule_violations = violations.filter(
			(violation) => !violation.rule_id.startsWith("responsibilities"),
		);
		const messages = existing_rule_violations.map((violation) => violation.message);
		expect({
			once: messages.includes(
				'function "once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			test_only: messages.includes('function "testOnly" is referenced only from tests'),
			service_once: messages.includes(
				'method "Service.once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			private_function: messages.some((message) => message.includes('function "_privateFunction" is used')),
			private_method: messages.some((message) => message.includes('method "Service.privateOnce" is used')),
			twice: messages.some((message) => message.includes('function "twice" is used')),
			service_twice: messages.some((message) => message.includes('method "Service.twice" is used')),
			info_only: existing_rule_violations.some((violation) => {
				if (!violation.message.includes('function "once"')) {
					return false;
				}
				return violation.priority !== 1;
			}),
		}).toEqual({
			once: false,
			test_only: true,
			service_once: false,
			private_function: false,
			private_method: false,
			twice: false,
			service_twice: false,
			info_only: false,
		});
	});
	test("applies the same rule to Python functions and methods", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			PYTHON_USAGE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const existing_rule_violations = violations.filter(
			(violation) => !violation.rule_id.startsWith("responsibilities"),
		);
		const messages = existing_rule_violations.map((violation) => violation.message);
		expect({
			once: messages.includes(
				'function "once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			service_once: messages.includes(
				'method "Service.once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			local_only: messages.some((message) => message.includes('function "local_only"')),
			private_function: messages.some((message) => message.includes('function "_private_function" is used')),
			private_method: messages.some((message) => message.includes('method "Service._private_method" is used')),
			twice: messages.some((message) => message.includes('function "twice" is used')),
			service_twice: messages.some((message) => message.includes('method "Service.twice" is used')),
		}).toEqual({
			once: false,
			service_once: false,
			local_only: false,
			private_function: false,
			private_method: false,
			twice: false,
			service_twice: false,
		});
	});
	test("reports TypeScript functions and methods referenced only from tests", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts":
					"export function read_value(): number { return 1; } export class Service { read() { return 1; } other() { return 2; } }",
				"tests/usage.test.ts":
					"import { read_value, Service } from '../source'; const service = new Service(); read_value(); service.read();",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			test_only_count: violations.filter((violation) => violation.rule_id === "test-only-usage").length,
			unused_callable_messages: violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.message),
		}).toEqual({
			test_only_count: 2,
			unused_callable_messages: [
				'method "Service.other" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
			],
		});
	});
	test("reports Python functions and methods referenced only from tests", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py":
					"def read_value() -> int: return 1\nclass Service:\n def read(self) -> int: return 1\n def other(self) -> int: return 2",
				"tests/test_usage.py":
					"from source import Service, read_value\nservice = Service()\nread_value()\nservice.read()",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			test_only_count: violations.filter((violation) => violation.rule_id === "test-only-usage").length,
			unused_callable_messages: violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.message),
		}).toEqual({
			test_only_count: 2,
			unused_callable_messages: [
				'method "Service.other" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
			],
		});
	});
	test("counts bound methods as production usage", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service.once.bind(service);",
				].join("\n"),
				"two.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service.once.bind(service);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
	test("counts statically indexed methods as production usage when bound", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service['once'].bind(service);",
				].join("\n"),
				"two.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service['once'].bind(service);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
	test("counts wrapped statically indexed methods as production usage when bound", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service['once']!.bind(service);",
				].join("\n"),
				"two.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service['once']!.bind(service);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
	test("does not treat a method call with a satisfies object as Function.bind", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": [
					"export interface Actions { onMoreRequested: () => void; }",
					"export class Service {",
					"  bind(actions: Actions): void {}",
					"}",
				].join("\n"),
				"caller.ts": [
					"import { Actions, Service } from './source';",
					"function bind_actions(view: Service): void {",
					"  view.bind({ onMoreRequested: () => undefined } satisfies Actions);",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.bind" is used'))).toBe(false);
	});
	test("counts methods called through static element access", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  run(): void {}", "}"].join("\n"),
				"consumer.ts": [
					"import { Service } from './source';",
					"declare const service: Service;",
					"service['run']();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.run"'))).toBe(false);
	});
	test("counts methods bound from object-literal instance containers", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const waiters = { current: new Service() };",
					"const callback = waiters.current.once.bind(waiters.current);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
	test("resolves bound methods from object-literal identifier containers", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const waiters = { current: service };",
					"const callback = waiters.current.once.bind(waiters.current);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
	test("resolves methods through typed getters", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  once() {}", "}"].join("\n"),
				"caller.ts": [
					"import { Service } from './source';",
					"class Container {",
					"  get service(): Service { return new Service(); }",
					"  run(): void { this.service.once(); }",
					"}",
					"new Container().run();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
	test("resolves methods through typed object parameters", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"caller.ts": [
					"import { Service } from './source';",
					"type Parts = { service: Service };",
					"function attach(parts: Parts): void {",
					"  parts.service.once();",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
});
