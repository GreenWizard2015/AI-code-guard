import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { SINGLETON_FILES } from "tests/core/constants/architecture/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("project singleton analysis", () => {
	const fixture = new TestFixture();
	const files = {
		...SINGLETON_FILES,
		"assigned-singleton.ts": [
			"class AssignedService {}",
			"let service: AssignedService | undefined;",
			"service = new AssignedService();",
			"export { service };",
		].join("\n"),
		"wrapped-singleton.py": [
			"from typing import cast",
			"class WrappedService:",
			"    def run(self) -> None:",
			"        return None",
			"service = cast(WrappedService, WrappedService())",
		].join("\n"),
		"conditional-singleton.ts": [
			"class ConditionalService { public run(): void {} }",
			'if (process.env["NODE_ENV"] === "production") {',
			"\tconst service = new ConditionalService();",
			"}",
		].join("\n"),
		"cli.ts": [
			"class CliService { public run(): void {} }",
			"{",
			"\tconst service = new CliService();",
			"\tservice.run();",
			"}",
		].join("\n"),
		"captured-block-singleton.ts": [
			"class CapturedService { public run(): void {} }",
			"export let run_service: () => void = () => undefined;",
			"{",
			"\tconst service = new CapturedService();",
			"\trun_service = (): void => {",
			"\t\tservice.run();",
			"\t};",
			"}",
		].join("\n"),
		"main-singleton.py": [
			"class MainService:",
			"    def run(self) -> None:",
			"        return None",
			'if __name__ == "__main__":',
			"    service = MainService()",
		].join("\n"),
		"captured-block-alias-singleton.ts": [
			"class CapturedAliasService { public run(): void {} }",
			"export let run_service: () => void = () => undefined;",
			"{",
			"\tconst ServiceAlias = CapturedAliasService;",
			"\tconst service = new ServiceAlias();",
			"\trun_service = (): void => {",
			"\t\tservice.run();",
			"\t};",
			"}",
		].join("\n"),
		"composition-block.ts": [
			"class ComposedService { public run(): void {} }",
			"{",
			"\tconst service = new ComposedService();",
			"\tservice.run();",
			"}",
		].join("\n"),
		"registry.py": [
			"from typing import ClassVar, ClassVar as CV",
			'classvar_key = "classvar"',
			"type_aliases = {classvar_key: ClassVar}",
			"ClassVarAlias = CV",
			"class Registry:",
			"    entries: CV[list[str]] = []",
			"    label: typing.ClassVar[str]",
			"    aliases: CV[list[str]] = []",
			"    assigned: ClassVarAlias[list[str]] = []",
			"    mapped_entries: type_aliases[classvar_key][dict[str, str]] = {}",
			"    name: str",
		].join("\n"),
	};

	test("reports singleton-like instances and Python class variables", () => {
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const singleton_violations = violations.filter(
			(item) =>
				item.rule_id() === "singleton" &&
				(item.file().endsWith("registry.py") || Object.keys(SINGLETON_FILES).includes(item.file())),
		);
		expect(
			singleton_violations
				.filter((item) => !item.file().endsWith("registry.py"))
				.map((item) => `${item.file().split("/").at(-1)}:${item.line()}`),
		).toEqual([
			"array-destructured-class-alias.ts:3",
			"assigned-class-alias.ts:3",
			"destructured-class-alias.py:3",
			"destructured-class-alias.ts:3",
			"imported-class-alias.py:3",
			"imported-module-singleton.py:2",
			"imported-singleton-lower.py:2",
			"imported-singleton.py:2",
			"imported-singleton.ts:2",
			"namespace-class-alias.ts:3",
			"qualified-namespace-singleton.ts:2",
			"singleton.py:3",
			"singleton.ts:2",
			"singleton.ts:6",
			"singleton.ts:9",
		]);
		expect(
			singleton_violations.filter((item) => item.file().endsWith("registry.py")).map((item) => item.line()),
		).toEqual([6, 7, 8, 9, 10]);
	});

	test("distinguishes escaped instances from locally owned composition roots", () => {
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const scenario_files = [
			"assigned-singleton.ts",
			"wrapped-singleton.py",
			"conditional-singleton.ts",
			"captured-block-singleton.ts",
			"captured-block-alias-singleton.ts",
		];
		const by_file = new Map(
			violations
				.filter((item) => item.rule_id() === "singleton" && scenario_files.includes(item.file()))
				.map((item) => [item.file(), item.line()]),
		);
		expect(by_file).toEqual(
			new Map([
				["assigned-singleton.ts", 3],
				["wrapped-singleton.py", 5],
				["conditional-singleton.ts", 3],
				["captured-block-singleton.ts", 4],
				["captured-block-alias-singleton.ts", 5],
			]),
		);
	});
});
