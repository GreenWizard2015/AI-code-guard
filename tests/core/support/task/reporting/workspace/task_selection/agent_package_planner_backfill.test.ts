import { describe, expect, test } from "@jest/globals";
import { AgentPackagePlanner } from "src/core/support/task/reporting/workspace/task_selection/agent_package_planner";
import { AgentPackagePlannerFindingFactory } from "tests/core/support/task/reporting/workspace/task_selection/agent_package_planner_finding_factory";

describe("agent package planner capacity backfill", () => {
	const finding_factory = new AgentPackagePlannerFindingFactory();

	test("counts a multi-finding file once and retains all its findings", () => {
		const violations = [
			...finding_factory.repeated("src/a.ts", 16, 7),
			...finding_factory.repeated("src/b.ts", 10, 7),
			...finding_factory.repeated("src/c.ts", 10, 7),
			...finding_factory.repeated("src/d.ts", 10, 7),
		];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 4, 10);
		expect({
			package_count: plan.packages.length,
			owned_file_count: plan.packages.reduce((total, agent_package) => total + agent_package.files.length, 0),
			packaged_count: plan.packages.reduce((total, agent_package) => total + agent_package.violations.length, 0),
			excluded_count: plan.excluded_findings.length,
		}).toEqual({
			package_count: 1,
			owned_file_count: 4,
			packaged_count: 46,
			excluded_count: 0,
		});
	});

	test("fills four ten-file packages and excludes lower-priority files whole", () => {
		const high_priority_findings = Array.from({ length: 40 }, (_unused, index) => {
			const file = `src/high-${String(index).padStart(2, "0")}.ts`;
			return finding_factory.repeated(file, 2, 8);
		}).flat();
		const low_priority_findings = [
			...finding_factory.repeated("src/low-a.ts", 3, 1),
			...finding_factory.repeated("src/low-b.ts", 3, 1),
		];
		const violations = [...high_priority_findings, ...low_priority_findings];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 4, 10);
		const package_file_counts = plan.packages.map((agent_package) => agent_package.files.length);
		const packaged_files = plan.packages.flatMap((agent_package) => agent_package.files);
		const retained_high_priority_files = packaged_files.filter((file) => file.startsWith("src/high-"));
		const excluded_file_set = new Set(plan.excluded_findings.map((finding) => finding.file()));
		const excluded_file_list = [...excluded_file_set];
		const excluded_files = excluded_file_list.sort();

		expect({
			package_count: plan.packages.length,
			package_file_counts,
			retained_high_priority_file_count: retained_high_priority_files.length,
			excluded_finding_count: plan.excluded_findings.length,
			excluded_files,
		}).toEqual({
			package_count: 4,
			package_file_counts: [10, 10, 10, 10],
			retained_high_priority_file_count: 40,
			excluded_finding_count: 6,
			excluded_files: ["src/low-a.ts", "src/low-b.ts"],
		});
	});
});
