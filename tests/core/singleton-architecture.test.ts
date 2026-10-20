import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";
import { SINGLETON_FILES } from "tests/core/constants/architecture/constants";

describe("project singleton analysis", () => {
	test("reports singleton-like instances and Python class variables", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				...SINGLETON_FILES,
				"registry.py": [
					"from typing import ClassVar as CV",
					"ClassVarAlias = ClassVar",
					"class Registry:",
					"    entries: ClassVar[list[str]] = []",
					"    label: typing.ClassVar[str]",
					"    aliases: CV[list[str]] = []",
					"    assigned: ClassVarAlias[list[str]] = []",
					"    name: str",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const singleton_violations = violations.filter((item) => item.rule_id === "singleton");
		expect(singleton_violations.filter((item) => !item.file.endsWith("registry.py"))).toHaveLength(15);
		expect(singleton_violations.filter((item) => item.file.endsWith("registry.py")).map((item) => item.line)).toEqual([
			4, 5, 6, 7,
		]);
	});

	test("distinguishes escaped instances from locally owned composition roots", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"assigned-singleton.ts": [
					"class Service {}",
					"let service: Service | undefined;",
					"service = new Service();",
					"export { service };",
				].join("\n"),
				"wrapped-singleton.py": [
					"from typing import cast",
					"class Service:",
					"    def run(self) -> None:",
					"        return None",
					"service = cast(Service, Service())",
				].join("\n"),
				"conditional-singleton.ts": [
					"class Service { public run(): void {} }",
					'if (process.env.NODE_ENV === "production") {',
					"\tconst service = new Service();",
					"}",
				].join("\n"),
				"cli.ts": [
					"class Service { public run(): void {} }",
					"{",
					"\tconst service = new Service();",
					"\tservice.run();",
					"}",
				].join("\n"),
				"captured-block-singleton.ts": [
					"class Service { public run(): void {} }",
					"export let run_service: () => void = () => undefined;",
					"{",
					"\tconst service = new Service();",
					"\trun_service = (): void => {",
					"\t\tservice.run();",
					"\t};",
					"}",
				].join("\n"),
				"main-singleton.py": [
					"class Service:",
					"    def run(self) -> None:",
					"        return None",
					'if __name__ == "__main__":',
					"    service = Service()",
				].join("\n"),
				"captured-block-alias-singleton.ts": [
					"class Service { public run(): void {} }",
					"export let run_service: () => void = () => undefined;",
					"{",
					"\tconst ServiceAlias = Service;",
					"\tconst service = new ServiceAlias();",
					"\trun_service = (): void => {",
					"\t\tservice.run();",
					"\t};",
					"}",
				].join("\n"),
				"composition-block.ts": [
					"class Service { public run(): void {} }",
					"{",
					"\tconst service = new Service();",
					"\tservice.run();",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const by_file = new Map(
			violations.filter((item) => item.rule_id === "singleton").map((item) => [item.file, item.line]),
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
