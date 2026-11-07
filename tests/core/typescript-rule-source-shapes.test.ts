import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/io/source_text";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript rule source shapes", () => {
	test("reports behavior-bearing inline return types", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new InMemoryFileIO()),
			{
				"inline-result.ts": [
					"export function create_result(): { value(): string } {",
					'    return { value: () => "ready" };',
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "typescript-dictionary-return")).toHaveLength(1);
	});

	test("reports qualified TypeScript utility type operations", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new InMemoryFileIO()),
			{
				"qualified-operation.ts": [
					"type Source = { id: string };",
					"declare namespace Contracts { type Pick<T, K extends keyof T> = { [P in K]: T[P] }; }",
					"type SelectedSource = Contracts.Pick<Source, 'id'>;",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "typescript-type-operation")).toHaveLength(1);
	});

	test("does not treat a generic type parameter as a project contract", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new InMemoryFileIO()),
			{ "generic-operation.ts": 'type Selected<T> = Pick<T, "id">;' },
		);

		expect(violations.filter((item) => item.rule_id() === "typescript-type-operation")).toHaveLength(0);
	});

	test("accepts parenthesized Callable aliases and reports nested generic types once", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new InMemoryFileIO()),
			{
				"parenthesized-types.ts": [
					"type CallableHandler = ((value: string) => void);",
					"type Stored = Promise<(Array<Set<Result>>)>;",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "callable-type-alias")).toHaveLength(0);
		expect(violations.filter((item) => item.rule_id() === "nested-generic-type")).toHaveLength(1);
	});
});
