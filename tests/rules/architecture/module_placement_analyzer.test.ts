import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { ModulePlacementAnalyzer } from "src/rules/architecture/module_placement_analyzer";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript module placement project scope", () => {
	test("collects importers outside a worker's assigned files", () => {
		const fixture = new TestFixture();
		const files: Record<string, string> = {
			"a/c/b/parser.ts": "export class Parser {}\n",
		};
		for (let index = 0; index < 799; index += 1) {
			const filler_path = `a/c/fillers/filler-${index}.ts`;
			files[filler_path] = "export {};\n";
		}
		const service_path = "a/c/service.ts";
		const view_path = "a/view.ts";
		files[service_path] = 'import { Parser } from "./b/parser";\nnew Parser();\n';
		files[view_path] = 'import { Parser } from "./c/b/parser";\nnew Parser();\n';
		const direct_placement_files = fixture._project_source.with_in_memory_project(
			files,
			({ root, context, files: project_files, source_texts }) => {
				const options = fixture._project_source.project_source_analysis_options(
					{ root, paths: [...project_files], source_texts },
					context,
					new Set<string>(),
				);
				const analyzer = new ModulePlacementAnalyzer(options);
				return analyzer
					.collect_language_violations(analyzer.collect_importers(), "typescript")
					.map((violation) => violation.file());
			},
			new Map(),
		);

		expect(direct_placement_files).toEqual(["a/c/b/parser.ts"]);
	});

	test("reports placement through the integrated worker analysis", () => {
		const fixture = new TestFixture();
		const files: Record<string, string> = {
			"a/c/b/parser.ts": "export class Parser {}\n",
		};
		for (let index = 0; index < 799; index += 1) {
			const filler_path = `a/c/fillers/filler-${index}.ts`;
			files[filler_path] = "export {};\n";
		}
		const service_path = "a/c/service.ts";
		const view_path = "a/view.ts";
		files[service_path] = 'import { Parser } from "./b/parser";\nnew Parser();\n';
		files[view_path] = 'import { Parser } from "./c/b/parser";\nnew Parser();\n';
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(configuration, options, mode) => configuration.lint_report(options, mode).report.violations,
		);
		const placement_files = violations
			.filter((violation) => violation.rule_id() === "module-placement")
			.map((violation) => violation.file());

		expect(placement_files).toEqual(["a/c/b/parser.ts"]);
	});
});
