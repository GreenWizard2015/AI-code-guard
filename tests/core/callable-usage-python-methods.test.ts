import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python callable usage", () => {
	const test_fixture = new TestFixture();

	test("keeps same-named methods owned by different modules", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.py": ["class Worker:", "    def run(self) -> None:", "        return None"].join("\n"),
				"second.py": ["class Worker:", "    def run(self) -> None:", "        return None"].join("\n"),
				"caller.py": ["from first import Worker", "worker = Worker()", "worker.run()"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some(
				(violation) => violation.file.endsWith("second.py") && violation.message.includes('method "Worker.run"'),
			),
		).toBe(true);
	});

	test("counts methods invoked through structural contracts", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"contract.py": [
					"from typing import Protocol",
					"class WorkerContract(Protocol):",
					"    def run(self) -> None: ...",
				].join("\n"),
				"worker.py": ["class Worker:", "    def run(self) -> None:", "        return None"].join("\n"),
				"caller.py": [
					"from contract import WorkerContract",
					"def call(worker: WorkerContract) -> None:",
					"    worker.run()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some(
				(violation) => violation.file.endsWith("/worker.py") && violation.message.includes('method "Worker.run"'),
			),
		).toBe(false);
	});
});
