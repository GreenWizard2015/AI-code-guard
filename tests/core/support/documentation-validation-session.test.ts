import { describe, expect, test } from "@jest/globals";
import { DocumentationValidationSession } from "src/core/support/documentation_validation_session";
import { LintReportMode } from "src/core/types";
import { DocumentationValidationSessionScenario } from "tests/core/support/documentation_validation_session_scenario";

describe("documentation example project diagnostics", () => {
	test("returns the project diagnostic and enables project analysis", () => {
		const scenario = new DocumentationValidationSessionScenario();
		const session = new DocumentationValidationSession(scenario, scenario);
		const violations = session.lint(scenario.repo_root(), "cli.py", "unused-file", [
			{ path: "cli.py", text: "pass\n" },
		]);

		expect({ violations, ...scenario.lint_state() }).toEqual({
			violations: [scenario.expected_violation()],
			lint_mode: LintReportMode.IN_MEMORY_PROJECT,
			project_analysis_enabled: true,
		});
	});

	test("uses the report without rescanning its project context", () => {
		const scenario = new DocumentationValidationSessionScenario();
		const session = new DocumentationValidationSession(scenario, scenario);
		session.lint(scenario.repo_root(), "cli.py", "unused-file", [{ path: "cli.py", text: "pass\n" }]);

		expect(scenario.context_counts()).toEqual({ source_record: 0, files: 0, source_io: 0 });
	});

	test("does not acquire a worker session for direct documentation linting", () => {
		const scenario = new DocumentationValidationSessionScenario();
		const session = new DocumentationValidationSession(scenario, scenario);
		session.lint(scenario.repo_root(), "cli.py", "unused-file", [{ path: "cli.py", text: "pass\n" }]);

		expect(scenario.worker_session_was_not_requested()).toBe(true);
	});
});
