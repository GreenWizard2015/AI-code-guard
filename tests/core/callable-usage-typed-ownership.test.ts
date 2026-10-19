import "src/linting/orchestration/runtime/global-analysis/composition_model";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint callable usage - typed ownership", () => {
	const test_fixture = new TestFixture();
	test("resolves methods through destructured typed class properties", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"caller.ts": [
					"import { Service } from './source';",
					"interface Parts { renderer: Service; }",
					"class Container {",
					"  private readonly runtime: Parts;",
					"  constructor(runtime: Parts) { this.runtime = runtime; }",
					"  run(): void {",
					"    const { renderer } = this.runtime;",
					"    renderer.once();",
					"  }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
	test("keeps imported classes with the same name bound to their defining module", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": ["export class Worker {", "  run(): void {}", "}"].join("\n"),
				"second.ts": ["export class Worker {", "  run(): void {}", "}"].join("\n"),
				"caller.ts": ["import { Worker } from './first';", "new Worker().run();"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some((violation) =>
				violation.message.includes('method "Worker.run" has insufficient production usage (found 0'),
			),
		).toBe(true);
	});
	test("counts methods bound after typed object destructuring", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": [
					"export class Service {",
					"  once() {}",
					"}",
					"export class OtherService {",
					"  once() {}",
					"}",
				].join("\n"),
				"controller.ts": [
					"import { Service } from './source';",
					"interface Options { service: Service; }",
					"function resolve_options(): Options {",
					"  return { service: new Service() };",
					"}",
					"const { service } = resolve_options();",
					"const callback = service.once.bind(service);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some((violation) =>
				violation.message.includes('method "Service.once" has insufficient production usage (found 0'),
			),
		).toBe(false);
	});
	test("keeps repeated parameter names scoped through nested callbacks", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": [
					"export class Composer {",
					"  submit() {}",
					"}",
					"export type ComposerState = { composer: Composer };",
					"export type OtherState = { value: string };",
				].join("\n"),
				"caller.ts": [
					"import { type ComposerState, type OtherState } from './source';",
					"function submit_composer(state: ComposerState): void {",
					"  const action = () => state.composer.submit();",
					"  action();",
					"}",
					"function read_value(state: OtherState): string {",
					"  return state.value;",
					"}",
					"submit_composer({ composer: { submit() {} } });",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Composer.submit" is used'))).toBe(false);
	});
	test("counts bound Python methods as production usage", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": ["class Service:", "    def once(self):", "        return 1"].join("\n"),
				"one.py": ["from source import Service", "service = Service()", "callback = service.once.bind(service)"].join(
					"\n",
				),
				"two.py": ["from source import Service", "service = Service()", "callback = service.once.bind(service)"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.once" is used'))).toBe(false);
	});
	test("resolves Python typed properties and delegated method aliases", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": [
					"class Dependency:",
					"    def run(self):",
					"        return 1",
					"",
					"class Consumer:",
					"    def __init__(self, dependency: Dependency):",
					"        self.dependency = dependency",
					"",
					"    def execute(self):",
					"        handler = self.dependency.run",
					"        return handler()",
				].join("\n"),
				"one.py": [
					"from source import Consumer, Dependency",
					"consumer = Consumer(Dependency())",
					"dependency = Dependency()",
					"dependency.run()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((violation) => violation.message)).not.toContain(
			'method "Dependency.run" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
		);
	});
	test("resolves Python properties initialized with imported classes", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"worker.py": ["class Worker:", "    def run(self):", "        return None"].join("\n"),
				"consumer.py": [
					"from worker import Worker",
					"",
					"class Consumer:",
					"    def __init__(self):",
					"        self.worker = Worker()",
					"",
					"    def execute(self):",
					"        self.worker.run()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const messages = violations.map((violation) => violation.message);
		expect(messages).not.toContain(
			'method "Worker.run" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
		);
		expect(messages).not.toContain(
			'method "Worker.run" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
		);
	});
	test("counts Python calls through untyped protocol attributes", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": [
					"class Writer:",
					"    def send_json(self):",
					"        return None",
					"",
					"class Dispatcher:",
					"    def __init__(self, handler):",
					"        self.handler = handler",
					"",
					"    def dispatch(self):",
					"        self.handler.send_json()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some((violation) =>
				violation.message.includes('method "Writer.send_json" has insufficient production usage (found 0'),
			),
		).toBe(false);
	});
	test("resolves methods through typed instance fields assigned in constructors", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": ["class Registry:", "    def list_names(self):", "        return []"].join("\n"),
				"transport.py": [
					"from source import Registry",
					"class Transport:",
					"    def __init__(self, registry: Registry):",
					"        self.registry = registry",
					"    def list(self):",
					"        return self.registry.list_names()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Registry.list_names"'))).toBe(false);
	});
	test("resolves methods through nested typed instance properties", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"inner.py": ["class Inner:", "    def entries(self):", "        return []"].join("\n"),
				"outer.py": [
					"from inner import Inner",
					"class Outer:",
					"    def __init__(self):",
					"        self.inner: Inner = Inner()",
					"    def use(self):",
					"        return self.inner.entries()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((violation) => violation.message)).not.toContain(
			'method "Inner.entries" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
		);
	});
	test("keeps Python local instance types scoped to their method", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"options.py": ["class Options:", "    def initialize(self):", "        return self"].join("\n"),
				"caller.py": [
					"from options import Options",
					"class Caller:",
					"    def use(self):",
					"        options: Options = Options()",
					"        return options.initialize()",
					"    def unrelated(self, options: str):",
					"        return options.strip()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((violation) => violation.message)).not.toContain(
			'method "Options.initialize" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
		);
	});
});
