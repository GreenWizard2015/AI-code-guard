import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";
import { DECORATED_PLUGIN_SOURCE, SPECIALIZATION_SOURCE } from "tests/core/constants";

describe("coding-lint class metrics rules", () => {
	test("reports class and interface method specialization thresholds", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"specialization.ts": SPECIALIZATION_SOURCE,
		});
		const details = violations.map((item) => [item.message, item.priority, item.rule_id]);
		expect(details).toEqual(
			expect.arrayContaining([
				["class has too few public methods (found 1)", 6, "class-method-min-count"],
				["class has many public methods (found 6)", 1, "class-method-count-info"],
				["class has too many public methods (found 16)", 3, "class-method-max-count"],
			]),
		);
		expect(details.filter((item) => item[0] === "class has many public methods (found 6)")).toHaveLength(2);
	});

	test("reports classes with callback fields declared directly on fields", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"callbacks.ts": [
				"class Callbacks {",
				"  on_one = () => 1;",
				"  on_two = () => 2;",
				"  on_three = () => 3;",
				"  on_four = () => 4;",
				"  run() {}",
				"  reset() {}",
				"}",
			].join("\n"),
		});
		expect(messages).toContain("class has 4 callback fields with default implementations");
	});

	test("reports callback fields initialized through local aliases", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"aliased-callback.ts": [
				"const callback = () => 1;",
				"class AliasedCallbacks {",
				"  handler = callback;",
				"  run() {}",
				"  reset() {}",
				"}",
			].join("\n"),
		});
		expect(messages).toContain("class has 1 callback fields with default implementations");
	});

	test("reports callback fields initialized through array aliases", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"array-aliased-callback.ts": [
				"const [callback] = [() => 1];",
				"class AliasedCallbacks {",
				"  handler = callback;",
				"  run() {}",
				"  reset() {}",
				"}",
			].join("\n"),
		});

		expect(messages).toContain("class has 1 callback fields with default implementations");
	});

	test("does not require a minimum public method count for interface implementations", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"implemented-interface.ts": [
				"interface Contract { run(): void; }",
				"class Adapter implements Contract {",
				"  run() {}",
				"}",
			].join("\n"),
		});

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "class has too few public methods (found 1)",
				}),
			]),
		);
	});

	test("ignores qualified TypeScript interface implementations for the minimum public count", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"qualified-interface.ts": ["class Adapter implements Contract {", "  run() {}", "} "].join("\n"),
		});

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "class has too few public methods (found 1)",
				}),
			]),
		);
	});

	test("does not require a minimum public method count for class inheritance", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"inherited-class.ts": ["class Base {", "  run() {}", "}", "class Adapter extends Base {", "  run() {}", "}"].join(
				"\n",
			),
		});

		expect(violations.filter((item) => item.message === "class has too few public methods (found 1)")).toHaveLength(1);
	});

	test("does not require a minimum public method count for Python protocol implementations", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"implemented-protocol.py": [
				"from typing import Protocol",
				"",
				"class Contract(Protocol):",
				"    def run(self) -> None: ...",
				"",
				"class Adapter(Contract):",
				"    def run(self) -> None:",
				"        return None",
			].join("\n"),
		});

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "class has too few public methods (found 1)",
				}),
			]),
		);
	});

	test("treats decorated Python hook methods as external plugin entry points", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"plugin.py": DECORATED_PLUGIN_SOURCE,
		});

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ rule_id: "class-method-count-info" }),
				expect.objectContaining({ rule_id: "unused-callable" }),
			]),
		);
	});
});
