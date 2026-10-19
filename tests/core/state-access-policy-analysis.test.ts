import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TYPEOF_CASES } from "tests/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("state access policy analysis", () => {
	test("resolves static private keys without flagging safe prototype and closure uses", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"private-key-alias.ts": [
					"class Sample { private token = 1; }",
					"const sample = new Sample();",
					"const private_key = 'token';",
					"const value = sample[private_key];",
				].join("\n"),
				"private-array-key.ts": [
					"class Secret { private token: number = 1; }",
					'const private_keys = ["token"] as const;',
					"const read_token = (sample: Secret): number => sample[private_keys[0]];",
				].join("\n"),
				"private-object-key.ts": [
					"class Secret { private token = 1; }",
					"const sample = new Secret();",
					"const keys = { private_key: 'token' };",
					"const value = sample[keys.private_key];",
				].join("\n"),
				"dom-prototype-reference.ts": [
					"function set_value(element: HTMLInputElement, value: string): void {",
					"  let prototype: typeof HTMLInputElement.prototype = HTMLInputElement.prototype;",
					"  prototype = HTMLInputElement.prototype;",
					'  Object.getOwnPropertyDescriptor(prototype, "value");',
					"}",
				].join("\n"),
				"returned-closure.ts": [
					"function create_loader(): Loader {",
					"  const state = create_state();",
					"  const load = async (): Promise<string> => state.read();",
					"  return { load };",
					"}",
				].join("\n"),
				"single-typeof.ts": TYPEOF_CASES.single,
				"repeated-typeof.ts": TYPEOF_CASES.repeated,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect({
			private_access: messages.filter(
				(message) => message === "private class members must not be accessed from outside their class",
			).length,
			prototype_construction: messages.includes("avoid prototype-based class construction"),
			temporary_assignments: messages.includes("avoid pointless temporary assignments"),
			repeated_typeof: messages.filter((message) => message === "avoid repeated typeof checks in business logic")
				.length,
		}).toEqual({ private_access: 3, prototype_construction: false, temporary_assignments: false, repeated_typeof: 2 });
	});

	test("detects callable feature checks only in conditional control flow across languages", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"callable-fallback.ts": [
					"function execute(service: Service): void {",
					'  if (typeof service.run !== "function") {',
					"    fallback();",
					"  }",
					'  if (typeof service.stop === "function") {',
					"    service.stop();",
					"  }",
					"}",
				].join("\n"),
				"callable-fallback.py": [
					"def execute(service: Service) -> None:",
					"    if not callable(service.run):",
					"        fallback()",
					"    if callable(service.stop):",
					"        service.stop()",
				].join("\n"),
				"callable-while.ts": [
					"interface Handler { run(): void; }",
					"declare const service: Handler;",
					'while (typeof service.run === "function") {',
					"  break;",
					"}",
				].join("\n"),
				"callable-while.py": [
					"class Handler:",
					"    def run(self) -> None:",
					"        pass",
					"handler = Handler()",
					"while callable(handler):",
					"    break",
				].join("\n"),
				"callable-wrapper.py": [
					"def execute(service: Service) -> None:",
					"    if bool(callable(service.other)):",
					"        service.other()",
				].join("\n"),
				"callable-value.ts": 'function accept(handler: Handler): boolean { return typeof handler === "function"; }',
				"callable-value.py": "def accept(handler: Handler) -> bool:\n    return callable(handler)",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const message = "avoid callable feature detection for project-owned interfaces";
		expect(violations.filter((item) => item.message === message)).toHaveLength(7);
	});
});
