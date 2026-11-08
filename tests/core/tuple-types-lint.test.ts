import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("tuple type rules", () => {
	test("reports positional tuple contracts across languages and aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"readonly.ts": "export type Result = readonly [file: string, name: string];",
				"positional.ts": "export type Result = [string, number];",
				"python-tuple.py": 'def resolve() -> tuple[str, int]:\n    return "file", 1\n',
				"python-alias.py": [
					"from typing import Tuple",
					"TupleAlias = Tuple",
					"def resolve(value: TupleAlias[str, int]) -> TupleAlias[str, int]:",
					"    return value",
					"TupleDestructured, ignored = (Tuple, None)",
					"def resolve_destructured(value: TupleDestructured[str, int]) -> TupleDestructured[str, int]:",
					"    return value",
					"TupleStar, *ignored = (Tuple, None, None)",
					"def resolve_star(value: TupleStar[str, int]) -> TupleStar[str, int]:",
					"    return value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const tuple_locations = violations
			.filter((item) => item.rule_id() === "tuple-type")
			.map((item) => `${item.file()}:${item.line()}`)
			.sort();
		expect(tuple_locations).toEqual([
			"positional.ts:1",
			"python-alias.py:3",
			"python-alias.py:3",
			"python-alias.py:6",
			"python-alias.py:6",
			"python-alias.py:9",
			"python-alias.py:9",
			"python-tuple.py:1",
			"readonly.ts:1",
		]);
	});

	test("accepts named result contracts", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "named-result.ts": "export interface NamedResult { file: string; name: string; }" },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const named_result_locations = violations
			.filter((item) => item.file() === "named-result.ts" && item.rule_id() === "tuple-type")
			.map((item) => `${item.file()}:${item.line()}`);

		expect(named_result_locations).toEqual([]);
	});
});
