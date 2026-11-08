import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("nested generic boundaries", () => {
	test("reports nested generic applications in declarations and signatures", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
		const nested_type_locations = violations
			.filter((item) => item.rule_id() === "nested-generic-type")
			.map((item) => `${item.file()}:${item.line()}`)
			.sort();
		expect(nested_type_locations).toEqual([
			"boundaries.ts:2",
			"boundaries.ts:3",
			"boundaries.ts:4",
			"boundaries.ts:4",
			"nested.py:2",
			"nested.ts:1",
			"nested.ts:2",
		]);
	});

	test("accepts named aliases at generic boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"accepted-types.ts": [
					"type ImporterNameBuckets = Map<string, Result[]>;",
					"type ImporterBuckets = Map<string, ImporterNameBuckets>;",
					"type ResultBatch = Array<Result>;",
					"type Stored = Promise<ResultBatch>;",
					"type Direct = Promise<Result>;",
				].join("\n"),
				"accepted-types.py": [
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
		const nested_type_locations = violations
			.filter((item) => item.rule_id() === "nested-generic-type")
			.map((item) => `${item.file()}:${item.line()}`);

		expect(nested_type_locations).toEqual([]);
	});
});
