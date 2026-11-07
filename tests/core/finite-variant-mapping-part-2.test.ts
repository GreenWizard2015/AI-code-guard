import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("finite variant mapping", () => {
	test("reports a Python Literal mapping with a lossy fallback", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from typing import Literal",
					"def convert(value: str) -> str:",
					'    Source = Literal["ready", "failed", "pending"]',
					'    Target = Literal["available", "error", "waiting"]',
					"    def map_value(value: Source) -> Target:",
					"        match value:",
					'            case "ready": return "available"',
					'            case _: return "error"',
					"    return map_value(value)",
					'convert("ready")',
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("does not infer finite variants from an unrelated symbol named Literal", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"def convert(value: str) -> str:",
					'    Source = Literal["ready", "failed"]',
					'    Target = Literal["available", "error"]',
					"    def map_value(value: Source) -> Target:",
					"        match value:",
					'            case "ready": return "available"',
					'            case _: return "error"',
					"    return map_value(value)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("resolves an aliased typing Literal import", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from typing import Literal as Variant",
					"def convert(value: str) -> str:",
					'    Source = Variant["ready", "failed"]',
					'    Target = Variant["available", "error"]',
					"    def map_value(value: Source) -> Target:",
					"        match value:",
					'            case "ready": return "available"',
					'            case _: return "error"',
					"    return map_value(value)",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("reports a TypedDict discriminated-union mapping with a lossy fallback", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from typing import Literal, TypedDict",
					"class Ready(TypedDict):",
					'    kind: Literal["ready"]',
					"class Failed(TypedDict):",
					'    kind: Literal["failed"]',
					"class Pending(TypedDict):",
					'    kind: Literal["pending"]',
					"Source = Ready | Failed | Pending",
					"class Available(TypedDict):",
					'    state: Literal["available"]',
					"class Rejected(TypedDict):",
					'    state: Literal["rejected"]',
					"class Waiting(TypedDict):",
					'    state: Literal["waiting"]',
					"Target = Available | Rejected | Waiting",
					"def convert(value: Source) -> Target:",
					"    match value:",
					'        case {"kind": "ready"}: return {"state": "available"}',
					'        case _: return {"state": "rejected"}',
					"def convert_all(value: Source) -> Target:",
					"    match value:",
					'        case {"kind": "ready"}: return {"state": "available"}',
					'        case {"kind": "failed"}: return {"state": "rejected"}',
					'        case {"kind": "pending"}: return {"state": "waiting"}',
					'        case _: raise ValueError("unknown state")',
					"def convert_without_explicit_cases(value: Source) -> Target:",
					"    match value:",
					'        case _: return {"state": "rejected"}',
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("resolves imported TypeScript discriminated unions", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/contracts.ts": [
					'export type Ready = { kind: "ready" };',
					'export type Failed = { kind: "failed" };',
					"export type Source = Ready | Failed;",
					'export type Available = { state: "available" };',
					'export type Rejected = { state: "rejected" };',
					"export type Target = Available | Rejected;",
				].join("\n"),
				"functions.ts": [
					'import type { Source, Target } from "src/contracts";',
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

	test("does not infer missing cases from enum aliases with duplicate values", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.ts": [
					"enum Source { Ready = 1, AlsoReady = 1, Failed = 2 }",
					"enum Target { Available, Error }",
					"function convert(value: Source): Target {",
					"  switch (value) {",
					"    case Source.Ready: return Target.Available;",
					"    default: return Target.Error;",
					"  }",
					"}",
				].join("\n"),
				"functions.py": [
					"from enum import Enum",
					"class Source(Enum): READY = 1; ALSO_READY = 1; FAILED = 2",
					"class Target(Enum): AVAILABLE = 1; ERROR = 2",
					"def convert(value: Source) -> Target:",
					"    match value:",
					"        case Source.READY: return Target.AVAILABLE",
					"        case _: return Target.ERROR",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("does not count Python Enum names excluded by _ignore_ as variants", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from enum import Enum",
					"class Source(Enum):",
					'    _ignore_ = "Skipped"',
					"    READY = 1",
					"    FAILED = 2",
					"    Skipped = 3",
					"class Target(Enum): AVAILABLE = 1; ERROR = 2",
					"def convert(value: Source) -> Target:",
					"    match value:",
					"        case Source.READY: return Target.AVAILABLE",
					"        case _: return Target.ERROR",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});
});
