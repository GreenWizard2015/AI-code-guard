import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("nested generic boundaries", () => {
	test("reports nested generic applications across declarations", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nested.ts": ["type Stored = Promise<Array<Result>>;", "type Indexed = Map<string, Promise<Result>>;"].join(
					"\n",
				),
				"nested.py": [
					"from typing import Callable",
					"def load(value: dict[str, list[Result]]) -> None:",
					"    return None",
				].join("\n"),
				"boundaries.ts": [
					"class Registry {",
					"    private cache: Map<string, Set<string>>;",
					"    public values: Promise<Array<Result>>;",
					"    public load(value: Map<string, Promise<Result>>): Promise<Array<Result>> { throw new Error(); }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const nested_types = violations.filter((item) => item.rule_id === "nested-generic-type");
		expect(nested_types).toHaveLength(7);
		expect(nested_types.filter((item) => item.file === "boundaries.ts")).toHaveLength(4);
	});

	test("accepts one generic layer and named inner aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nested.ts": [
					"type ResultBatch = Array<Result>;",
					"type Stored = Promise<ResultBatch>;",
					"type Direct = Promise<Result>;",
				].join("\n"),
				"nested.py": [
					"from typing import Callable",
					"def load(value: dict[str, ResultBatch]) -> None:",
					"    return None",
					"def subscribe(callback: Callable[[Owner, Value], None]) -> None:",
					"    return None",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "nested-generic-type")).toHaveLength(0);
	});
});
