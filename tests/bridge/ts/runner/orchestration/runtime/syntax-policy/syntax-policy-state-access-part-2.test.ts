import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";
import { TYPEOF_CASES } from "tests/core/constants";

describe("coding-lint syntax policy - state and TypeScript access", () => {
	const test_fixture = new TestFixture();
	test("rejects private member access through static key aliases", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"private-key-alias.ts": [
				"class Sample { private token = 1; }",
				"const sample = new Sample();",
				"const private_key = 'token';",
				"const value = sample[private_key];",
			].join("\n"),
		});

		expect(messages).toContain("private class members must not be accessed from outside their class");
	});

	test("rejects private member access through indexed static arrays", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"private-array-key.ts": [
				"class Secret { private token: number = 1; }",
				'const private_keys = ["token"] as const;',
				"const read_token = (sample: Secret): number => sample[private_keys[0]];",
			].join("\n"),
		});

		expect(messages).toContain("private class members must not be accessed from outside their class");
	});

	test("rejects private member access through static object properties", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"private-object-key.ts": [
				"class Secret { private token = 1; }",
				"const sample = new Secret();",
				"const keys = { private_key: 'token' };",
				"const value = sample[keys.private_key];",
			].join("\n"),
		});

		expect(messages).toContain("private class members must not be accessed from outside their class");
	});

	test("does not treat local prototype references as prototype construction", () => {
		const messages = test_fixture.violation_messages({
			"dom-prototype-reference.ts": [
				"function set_value(element: HTMLInputElement, value: string): void {",
				"  let prototype: typeof HTMLInputElement.prototype = HTMLInputElement.prototype;",
				"  prototype = HTMLInputElement.prototype;",
				'  Object.getOwnPropertyDescriptor(prototype, "value");',
				"}",
			].join("\n"),
		});

		expect(messages).not.toContain("avoid prototype-based class construction");
	});

	test("does not treat returned closures as pointless assignments", () => {
		const messages = test_fixture.violation_messages({
			"returned-closure.ts": [
				"function create_loader(): Loader {",
				"  const state = create_state();",
				"  const load = async (): Promise<string> => state.read();",
				"  return { load };",
				"}",
			].join("\n"),
		});

		expect(messages).not.toContain("avoid pointless temporary assignments");
	});

	test("reports repeated typeof checks but allows a single boundary check", () => {
		const single_messages = test_fixture.violation_messages({ "single-typeof.ts": TYPEOF_CASES.single });
		const repeated_messages = test_fixture.violation_messages({ "repeated-typeof.ts": TYPEOF_CASES.repeated });
		expect(single_messages).not.toContain("avoid repeated typeof checks in business logic");
		expect(
			repeated_messages.filter((message) => message === "avoid repeated typeof checks in business logic"),
		).toHaveLength(2);
	});

	test("rejects callable feature-detection fallbacks in TypeScript and Python", () => {
		const typescript_messages = test_fixture.violation_messages({
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
		});
		const python_messages = test_fixture.violation_messages({
			"callable-fallback.py": [
				"def execute(service: Service) -> None:",
				"    if not callable(service.run):",
				"        fallback()",
				"    if callable(service.stop):",
				"        service.stop()",
			].join("\n"),
		});

		const message = "avoid callable feature detection for project-owned interfaces";
		expect(typescript_messages.filter((item) => item === message)).toHaveLength(2);
		expect(python_messages.filter((item) => item === message)).toHaveLength(2);
	});

	test("rejects callable feature detection in while conditions", () => {
		const typescript_messages = test_fixture.violation_messages({
			"callable-while.ts": [
				"interface Handler { run(): void; }",
				"declare const service: Handler;",
				'while (typeof service.run === "function") {',
				"  break;",
				"}",
			].join("\n"),
		});
		const python_messages = test_fixture.violation_messages({
			"callable-while.py": [
				"class Handler:",
				"    def run(self) -> None:",
				"        pass",
				"handler = Handler()",
				"while callable(handler):",
				"    break",
			].join("\n"),
		});

		const message = "avoid callable feature detection for project-owned interfaces";
		expect(typescript_messages).toContain(message);
		expect(python_messages).toContain(message);
	});

	test("rejects Python callable detection through boolean wrappers", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"callable-wrapper.py": [
				"def execute(service: Service) -> None:",
				"    if bool(callable(service.other)):",
				"        service.other()",
			].join("\n"),
		});

		expect(
			messages.filter((item) => item === "avoid callable feature detection for project-owned interfaces"),
		).toHaveLength(1);
	});

	test("allows callable values outside feature-detection if statements", () => {
		const typescript_messages = test_fixture.violation_messages({
			"callable-value.ts": 'function accept(handler: Handler): boolean { return typeof handler === "function"; }',
		});
		const python_messages = test_fixture.violation_messages({
			"callable-value.py": "def accept(handler: Handler) -> bool:\n    return callable(handler)",
		});

		expect(typescript_messages).not.toContain("avoid callable feature detection for project-owned interfaces");
		expect(python_messages).not.toContain("avoid callable feature detection for project-owned interfaces");
	});
});
