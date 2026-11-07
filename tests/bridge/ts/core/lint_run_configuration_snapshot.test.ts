import "src/core/lint_project_context_creator";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { NODE_ENV_VARIABLE } from "src/core/constants";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import { GlobalAnalysisSnapshotScenario } from "tests/core/support/global_analysis_snapshot_scenario";

describe("global analysis cache source snapshots", () => {
	let previous_environment: string | undefined;

	beforeEach(() => {
		previous_environment = process.env[NODE_ENV_VARIABLE];
		process.env[NODE_ENV_VARIABLE] = "production";
	});

	afterEach(() => {
		if (previous_environment === undefined) {
			delete process.env[NODE_ENV_VARIABLE];
		} else {
			process.env[NODE_ENV_VARIABLE] = previous_environment;
		}
	});

	test("constructs an immediately usable Python worker session", async () => {
		const scenario = new GlobalAnalysisSnapshotScenario();
		const configuration = new LintRunConfiguration(scenario.source_io(), scenario.cache_io());
		const session = configuration.active_worker_session();
		const was_active_immediately = session.active();
		let parsed_source_available = false;

		try {
			const response = session
				.worker()
				.batch("configuration-startup", new Map([["startup.py", "value = 1\n"]]))
				.result();
			parsed_source_available = response.batch_id === "configuration-startup" && response.asts.has("startup.py");
		} finally {
			await session.close();
		}

		expect({ was_active_immediately, parsed_source_available }).toEqual({
			was_active_immediately: true,
			parsed_source_available: true,
		});
	});

	test("recognizes a configured Python entry point", () => {
		const scenario = new GlobalAnalysisSnapshotScenario();
		let unused_class_files: string[] = [];
		const configuration = new LintRunConfiguration(scenario.source_io(), scenario.cache_io());
		try {
			scenario.seed_initial_snapshot();
			const result = configuration.lint_report(
				scenario.report_options(scenario.configuration_a()),
				LintReportMode.PROJECT,
			);
			unused_class_files = result.report.violations
				.filter((violation) => violation.rule_id() === "unused-class")
				.map((violation) => violation.file());
		} finally {
			configuration.close_worker_session();
		}
		expect(unused_class_files).toEqual([]);
	});

	test("invalidates cached diagnostics when entry-point registration is removed", () => {
		const scenario = new GlobalAnalysisSnapshotScenario();
		const configuration = new LintRunConfiguration(scenario.source_io(), scenario.cache_io());
		let results: string[][] = [];
		try {
			scenario.seed_initial_snapshot();
			const registered_result = configuration.lint_report(
				scenario.report_options(scenario.configuration_a()),
				LintReportMode.PROJECT,
			);
			const registered_unused_classes = registered_result.report.violations
				.filter((violation) => violation.rule_id() === "unused-class")
				.map((violation) => violation.file());
			scenario.update_cached_configuration();
			const unregistered_result = configuration.lint_report(
				scenario.report_options(scenario.configuration_b()),
				LintReportMode.PROJECT,
			);
			const unregistered_unused_classes = unregistered_result.report.violations
				.filter((violation) => violation.rule_id() === "unused-class")
				.map((violation) => violation.file());
			results = [registered_unused_classes, unregistered_unused_classes];
		} finally {
			configuration.close_worker_session();
		}
		expect(results).toEqual([[], ["tools/webmcp_project/plugin.py"]]);
	});
});
