import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("Python finite variant mapping", () => {
	test("reports a Python enum fallback that collapses unhandled source variants", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from enum import Enum",
					"class Source(Enum): READY = 1; FAILED = 2; PENDING = 3",
					"class Target(Enum): AVAILABLE = 1; ERROR = 2; WAITING = 3",
					"def convert(value: Source) -> Target:",
					"    match value:",
					"        case Source.READY: return Target.AVAILABLE",
					"        case _: return Target.ERROR",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("accepts a Python mapping with an explicit case for every source variant", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from enum import Enum",
					"class Source(Enum): READY = 1; FAILED = 2; PENDING = 3",
					"class Target(Enum): AVAILABLE = 1; ERROR = 2; WAITING = 3",
					"def convert(value: Source) -> Target:",
					"    match value:",
					"        case Source.READY: return Target.AVAILABLE",
					"        case Source.FAILED: return Target.ERROR",
					"        case Source.PENDING: return Target.WAITING",
					'        case _: raise ValueError("unsupported")',
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("accepts a Python fallback that preserves the original enum value", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from enum import Enum",
					"class Source(Enum): READY = 1; FAILED = 2; PENDING = 3",
					"def preserve(value: Source) -> Source:",
					"    match value:",
					"        case Source.READY: return Source.READY",
					"        case _: return value",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("accepts a Python fallback that rejects unmapped enum values", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from enum import Enum",
					"class Source(Enum): READY = 1; FAILED = 2; PENDING = 3",
					"class Target(Enum): AVAILABLE = 1; ERROR = 2; WAITING = 3",
					"def convert(value: Source) -> Target:",
					"    match value:",
					"        case Source.READY: return Target.AVAILABLE",
					'        case _: raise ValueError("unsupported")',
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("resolves enum bases through a qualified module import", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"import enum as enum_module",
					"class Source(enum_module.Enum): READY = 1; FAILED = 2",
					"class Target(enum_module.Enum): AVAILABLE = 1; ERROR = 2",
					"def convert(value: Source) -> Target:",
					"    match value:",
					"        case Source.READY: return Target.AVAILABLE",
					"        case _: return Target.ERROR",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(1);
	});

	test("does not infer finite variants from a class name ending in Enum", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"class ResourceEnum:",
					"    READY = 1",
					"    FAILED = 2",
					"class ResultEnum:",
					"    AVAILABLE = 1",
					"    ERROR = 2",
					"def convert(value: ResourceEnum) -> ResultEnum:",
					"    match value:",
					"        case ResourceEnum.READY: return ResultEnum.AVAILABLE",
					"        case _: return ResultEnum.ERROR",
				].join("\n"),
			},
		);

		expect(violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")).toHaveLength(0);
	});

	test("resolves aliased Python enum imports without accepting lookalike bases", () => {
		const fixture = new TestFixture();
		const aliased_enum_violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"from enum import Enum as VariantBase",
					"class Source(VariantBase): READY = 1; FAILED = 2",
					"class Target(VariantBase): AVAILABLE = 1; ERROR = 2",
					"def convert(value: Source) -> Target:",
					"    match value:",
					"        case Source.READY: return Target.AVAILABLE",
					"        case _: return Target.ERROR",
				].join("\n"),
			},
		);
		const lookalike_violations = fixture.collect_fixture_violations_with(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"functions.py": [
					"class Source(Enum): READY = 1; FAILED = 2",
					"class Target(Enum): AVAILABLE = 1; ERROR = 2",
					"def convert(value: Source) -> Target:",
					"    match value:",
					"        case Source.READY: return Target.AVAILABLE",
					"        case _: return Target.ERROR",
				].join("\n"),
			},
		);

		expect({
			aliased_enum: aliased_enum_violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")
				.length,
			lookalike_base: lookalike_violations.filter((item) => item.rule_id() === "finite-variant-mapping-is-incomplete")
				.length,
		}).toEqual({ aliased_enum: 1, lookalike_base: 0 });
	});
});
