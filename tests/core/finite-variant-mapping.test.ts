import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("finite variant mapping", () => {
	test("reports a TypeScript enum fallback that collapses unhandled source variants", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"enum Source { Ready, Failed, Pending }",
					"enum Target { Available, Error, Waiting }",
					"function convert(value: Source): Target {",
					"  switch (value) {",
					"    case Source.Ready: return Target.Available;",
					"    default: return Target.Error;",
					"  }",
					"}",
					"function convert_all(value: Source): Target {",
					"  switch (value.kind) {",
					'    case "ready": return { state: "available", value: value.value };',
					'    case "failed": return { state: "rejected", reason: value.reason };',
					'    case "pending": return { state: "waiting" };',
					'    default: throw new Error("unknown state");',
					"  }",
					"}",
					"function convert_without_explicit_cases(value: Source): Target {",
					"  switch (value.kind) {",
					'    default: return { state: "rejected", reason: "unknown" };',
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("accepts a TypeScript mapping with an explicit case for every source variant", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"enum Source { Ready, Failed, Pending }",
					"enum Target { Available, Error, Waiting }",
					"function convert(value: Source): Target {",
					"  switch (value) {",
					"    case Source.Ready: return Target.Available;",
					"    case Source.Failed: return Target.Error;",
					"    case Source.Pending: return Target.Waiting;",
					"  }",
					'  throw new Error("unsupported");',
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("accepts a TypeScript fallback that preserves the original enum value", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"enum Source { Ready, Failed, Pending }",
					"function preserve(value: Source): Source {",
					"  switch (value) {",
					"    case Source.Ready: return Source.Ready;",
					"    default: return value;",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("accepts a TypeScript fallback that rejects unmapped enum values", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"enum Source { Ready, Failed, Pending }",
					"enum Target { Available, Error, Waiting }",
					"function convert(value: Source): Target {",
					"  switch (value) {",
					"    case Source.Ready: return Target.Available;",
					"    default: throw new Error(String(value));",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("does not infer finite variants from an ordinary string parameter", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"function convert(value: string): string {",
					'  switch (value) { case "ready": return "available"; default: return "unavailable"; }',
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("reports a TypeScript literal-union mapping with a lossy fallback", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					'type Source = "ready" | "failed" | "pending";',
					'type Target = "available" | "error" | "waiting";',
					"function convert(value: Source): Target {",
					"  switch (value) {",
					'    case "ready": return "available";',
					'    default: return "error";',
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("reports lossy mappings between statically declared discriminated unions", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					'type Ready = { kind: "ready"; value: string };',
					'type Failed = { kind: "failed"; reason: string };',
					'type Pending = { kind: "pending"; };',
					"type Source = Ready | Failed | Pending;",
					'type Available = { state: "available"; value: string };',
					'type Rejected = { state: "rejected"; reason: string };',
					'type Waiting = { state: "waiting"; };',
					"type Target = Available | Rejected | Waiting;",
					"function convert(value: Source): Target {",
					"  switch (value.kind) {",
					'    case "ready": return { state: "available", value: value.value };',
					'    default: return { state: "rejected", reason: "unknown" };',
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("resolves discriminated unions when branch declarations follow the union", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"type Source = Ready | Failed;",
					"type Target = Available | Rejected;",
					'type Ready = { kind: "ready" };',
					'type Failed = { kind: "failed" };',
					'type Available = { state: "available" };',
					'type Rejected = { state: "rejected" };',
					"function convert(value: Source): Target {",
					"  switch (value.kind) {",
					'    case "ready": return { state: "available" };',
					'    default: return { state: "rejected" };',
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("resolves imported TypeScript enums when checking variant coverage", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/states.ts": "export enum SourceState { Ready, Failed }\nexport enum TargetState { Available, Error }",
				"functions.ts": [
					'import { SourceState, TargetState } from "src/states";',
					"function convert(value: SourceState): TargetState {",
					"  switch (value) {",
					"    case SourceState.Ready: return TargetState.Available;",
					"    default: return TargetState.Error;",
					"  }",
					"}",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});
});
