import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("tuple type rules", () => {
	test("reports positional tuple contracts and aliases in both languages", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode).report,
		);

		expect(execution.violations.filter((item) => item.rule_id === "tuple-type")).toHaveLength(9);
	});

	test("allows named result contracts", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"result.ts": "export interface Result { file: string; name: string; }",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode).report,
		);

		expect(execution.violations.filter((item) => item.rule_id === "tuple-type")).toHaveLength(0);
	});
});
