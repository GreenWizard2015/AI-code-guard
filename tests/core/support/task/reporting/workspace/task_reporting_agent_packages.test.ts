import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { TaskReportingScenario } from "tests/core/support/task/reporting/workspace/task_reporting_scenario";

describe("agent package task reporting", () => {
	test("writes only a summary when agents mode has no policy-eligible findings", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture({ "src/clean.ts": "const clean = true;\n" });
		const stale_package = fixture.task_path("agent-tasks/agent-01.md");
		fixture._file_io.create_directory(stale_package.slice(0, stale_package.lastIndexOf("/")));
		fixture._file_io.file(stale_package).write_text("stale");
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});

		reporting.format_agent_packages([], {
			batch_size: 10,
			policy: "all",
			skip_review: true,
			agent_mode: { package_count: 2, test_target_links: [] },
		});

		expect({
			no_package_created: !fixture._file_io.file(stale_package).path_exists(),
			summary_explains_empty_selection: fixture
				.task_text("agent-tasks/summary.md")
				.includes("No policy-eligible findings"),
		}).toEqual({ no_package_created: true, summary_explains_empty_selection: true });
	});

	test("creates one package when a nonempty selection has fewer than ten findings", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture({ "src/a.ts": "const a = 1;\n" });
		const violation = scenario.violation("src/a.ts", 1, "class-size", 7);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});

		reporting.format_agent_packages([violation], {
			batch_size: 10,
			policy: "all",
			skip_review: true,
			agent_mode: { package_count: 3, test_target_links: [] },
		});

		expect({
			package_written: fixture._file_io.file(fixture.task_path("agent-tasks/agent-01.md")).path_exists(),
			finding_in_package: fixture.task_text("agent-tasks/agent-01.md").includes("src/a.ts:1"),
			one_package_reported: fixture.task_text("agent-tasks/summary.md").includes("Created packages: 1"),
		}).toEqual({ package_written: true, finding_in_package: true, one_package_reported: true });
	});

	test("keeps every finding from an included file and reports the full issue list", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture({ "src/a.ts": "const a = 1;\n" });
		const violations = Array.from({ length: 15 }, (_unused, index) => {
			const priority = index < 5 ? 3 : 7;
			return scenario.violation("src/a.ts", index + 1, "class-size", priority);
		});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});

		reporting.format_agent_packages(violations, {
			batch_size: 10,
			policy: "all",
			skip_review: true,
			agent_mode: { package_count: 1, test_target_links: [] },
		});

		const package_document = fixture.task_text("agent-tasks/agent-01.md");
		const issue_document = fixture.task_text("issues.md");
		const summary = fixture.task_text("agent-tasks/summary.md");
		const packaged_findings = violations.filter((violation) => {
			return package_document.includes(`\`src/a.ts:${violation.line()}\``);
		});
		const reported_findings = violations.filter((violation) => {
			return issue_document.includes(`Line ${violation.line()}:`);
		});
		expect({
			one_package_written: fixture._file_io.file(fixture.task_path("agent-tasks/agent-01.md")).path_exists(),
			packaged_finding_count: packaged_findings.length,
			priority_counts: [3, 7].map(
				(priority) => packaged_findings.filter((finding) => finding.priority() === priority).length,
			),
			reported_findings: reported_findings.length,
			packaged_count_reported: summary.includes("Packaged findings: 15"),
			excluded_count_reported: summary.includes("Excluded from packages by capacity or linked constraints: 0"),
			requested_one_package: summary.includes("Created packages: 1"),
		}).toEqual({
			one_package_written: true,
			packaged_finding_count: 15,
			priority_counts: [5, 10],
			reported_findings: 15,
			packaged_count_reported: true,
			excluded_count_reported: true,
			requested_one_package: true,
		});
	});

	test.each(["top-category", "all"] as const)("--batch-size counts files with %s policy", (policy) => {
		const scenario = new TaskReportingScenario();
		const files = Object.fromEntries(
			Array.from({ length: 20 }, (_unused, index) => [`src/file-${index}.ts`, "const value = 1;\n"]),
		);
		const violations = Object.keys(files).map((file) => scenario.violation(file, 1, "class-size", 7));
		const fixture = scenario.create_fixture(files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format_agent_packages(violations, {
			batch_size: 10,
			policy,
			skip_review: true,
			agent_mode: { package_count: 2, test_target_links: [] },
		});
		const package_documents = [
			fixture.task_text("agent-tasks/agent-01.md"),
			fixture.task_text("agent-tasks/agent-02.md"),
		];
		const package_file_counts = Array.from(
			package_documents.join("\n").matchAll(/^Files counted toward --batch-size: (\d+)$/gmu),
			(match) => Number(match[1]),
		);
		expect(package_file_counts).toEqual([10, 10]);
		expect(fixture.task_text("agent-tasks/summary.md")).toContain("Created packages: 2");
	});

	test("publishes all findings and replaces stale package files", () => {
		const scenario = new TaskReportingScenario();
		const files = Object.fromEntries(
			Array.from({ length: 20 }, (_unused, index) => [`src/file-${index}.ts`, "const value = 1;\n"]),
		);
		const violations = Object.keys(files).map((file) => scenario.violation(file, 1, "class-size", 7));
		const fixture = scenario.create_fixture(files);
		const stale_package = fixture.task_path("agent-tasks/agent-03.md");
		fixture._file_io.create_directory(stale_package.slice(0, stale_package.lastIndexOf("/")));
		fixture._file_io.file(stale_package).write_text("stale");
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format_agent_packages(violations, {
			batch_size: 10,
			policy: "all",
			skip_review: true,
			agent_mode: { package_count: 2, test_target_links: [] },
		});
		const issues = fixture.task_text("issues.md");
		const package_documents = [
			fixture.task_text("agent-tasks/agent-01.md"),
			fixture.task_text("agent-tasks/agent-02.md"),
		];
		const all_findings_are_packaged = violations.every((violation) =>
			package_documents.some((document) => document.includes(`\`${violation.file()}:${violation.line()}\``)),
		);
		expect({
			all_findings_are_in_issues: violations.every((violation) => issues.includes(violation.file())),
			all_findings_are_packaged,
			stale_package_removed: !fixture._file_io.file(stale_package).path_exists(),
		}).toEqual({
			all_findings_are_in_issues: true,
			all_findings_are_packaged: true,
			stale_package_removed: true,
		});
	});

	test("reports complete package accounting metadata", () => {
		const scenario = new TaskReportingScenario();
		const files = Object.fromEntries(
			Array.from({ length: 10 }, (_unused, index) => [`src/file-${index}.ts`, "const value = 1;\n"]),
		);
		const violations = Object.keys(files).map((file) => scenario.violation(file, 1, "class-size", 7));
		const fixture = scenario.create_fixture(files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format_agent_packages(violations, {
			batch_size: 10,
			policy: "all",
			skip_review: true,
			agent_mode: { package_count: 2, test_target_links: [] },
		});
		const summary = fixture.task_text("agent-tasks/summary.md");
		const metadata = [
			"Packaged findings: 10",
			"Deferred findings: 0",
			"Suppressed findings: 0",
			"Files counted",
			"Production files",
			"Test files",
			"Excluded from packages by capacity or linked constraints: 0",
			"Unresolved partition constraints: 0",
		];
		expect(metadata.every((item) => summary.includes(item))).toBe(true);
	});
});
