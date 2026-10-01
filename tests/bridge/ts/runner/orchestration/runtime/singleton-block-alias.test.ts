import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("singleton block instance boundaries", () => {
	test("reports block instances through block-local class aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"captured-block-alias-singleton.ts": [
				"class Service { public run(): void {} }",
				"export let run_service: () => void = () => undefined;",
				"{",
				"\tconst ServiceAlias = Service;",
				"\tconst service = new ServiceAlias();",
				"\trun_service = (): void => {",
				"\t\tservice.run();",
				"\t};",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toEqual([expect.objectContaining({ line: 5 })]);
	});

	test("allows an unescaped composition-root instance in a block", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"composition-block.ts": [
				"class Service { public run(): void {} }",
				"{",
				"\tconst service = new Service();",
				"\tservice.run();",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(0);
	});
});
