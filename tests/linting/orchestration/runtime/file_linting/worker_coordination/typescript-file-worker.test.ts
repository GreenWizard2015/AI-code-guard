import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TypeScriptWorkerShardPlanner } from "src/linting/orchestration/runtime/file_linting/worker_coordination/type_script_worker_shard_planner";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript file worker execution", () => {
	test("keeps file diagnostics and merges one project finding across worker shards", () => {
		const fixture = new TestFixture();
		const files = Object.fromEntries(
			Array.from({ length: 799 }, (_, index) => [`source-${index}.ts`, `export const value_${index} = ${index};`]),
		);
		const assertion_file_name = "assertion.ts";
		files[assertion_file_name] = "const value = input as string;";
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(configuration, options, mode) => configuration.lint_report(options, mode).report.violations,
		);
		const type_assertions = violations.filter((violation) => violation.rule_id() === "typescript-type-assertion");
		const directory_findings = violations.filter(
			(violation) => violation.file().length === 0 && violation.rule_id() === "directory-max-size",
		);
		const shard_planner = new TypeScriptWorkerShardPlanner();
		const worker_count = shard_planner.worker_count(Object.keys(files).length);

		expect({
			type_assertions: type_assertions.map((violation) => `${violation.file()}:${violation.line()}`),
			directory_finding_count: directory_findings.length,
			worker_count,
		}).toEqual({
			type_assertions: ["assertion.ts:1"],
			directory_finding_count: 1,
			worker_count: 4,
		});
	});

	test("keeps projects below 200 files serial and starts one worker at the threshold", () => {
		const shard_planner = new TypeScriptWorkerShardPlanner();
		const worker_counts = [shard_planner.worker_count(199), shard_planner.worker_count(200)];

		expect(worker_counts).toEqual([0, 1]);
	});

	test("collects module placement imports from files assigned to other shards", () => {
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
