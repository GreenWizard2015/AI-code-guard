import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("source-bound TypeScript rules", () => {
	test("reports retry loops that continue after a failed operation", () => {
		const fixture = new TestFixture();
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const violations = fixture.collect_fixture_violations_with(configuration, {
			"retry.ts": [
				"async function retry(task: () => Promise<void>): Promise<void> {",
				"    while (true) {",
				"        try { await task(); return; }",
				"        catch (error) { continue; }",
				"    }",
				"}",
			].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id() === "retry-without-ownership")).toHaveLength(1);
	});

	test("reports type operations applied to project declarations", () => {
		const fixture = new TestFixture();
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const violations = fixture.collect_fixture_violations_with(configuration, {
			"type-operations.ts": ["type Source = { id: string };", "type SelectedSource = Pick<Source, 'id'>;"].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id() === "typescript-type-operation")).toHaveLength(1);
	});
});
