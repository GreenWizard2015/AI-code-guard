import { spawnSync } from "node:child_process";
import { beforeAll, describe, expect, test } from "@jest/globals";
import { AgentPackagePlanner } from "src/core/support/task/reporting/workspace/task_selection/planning/agent_package_planner";
import { AgentPackagePlannerFindingFactory } from "tests/core/support/task/reporting/workspace/task_selection/agent_package_planner_finding_factory";

describe("agent package planner with a large linked scope", () => {
	let child_status: number | null = null;
	let child_error = "";
	let child_output = "";
	const finding_factory = new AgentPackagePlannerFindingFactory();

	beforeAll(() => {
		const child_source = [
			'import { AgentPackagePlanner } from "src/core/support/task/reporting/workspace/task_selection/planning/agent_package_planner";',
			'import { ViolationValue } from "src/model/violation_value";',
			'const finding = (file, line, priority) => new ViolationValue({ file, line, message: `${file}:${line}`, hint: "fix", rule_id: "test-targets", priority });',
			"const linked_files = Array.from({ length: 146 }, (_unused, index) => `src/linked-${index}.ts`);",
			'const violations = [finding("tests/linked.test.ts", 1, 8), ...Array.from({ length: 30 }, (_unused, index) => finding(`src/independent-${index}.ts`, 1, index % 9))];',
			'const links = [{ test_file: "tests/linked.test.ts", production_files: linked_files }];',
			"const plan = new AgentPackagePlanner(process.cwd()).plan(violations, links, 4, 10000);",
			'const linked_package = plan.packages.find((agent_package) => agent_package.files.includes("tests/linked.test.ts"));',
			"const result = { package_count: plan.packages.length, file_counts: plan.packages.map((agent_package) => agent_package.files.length).sort((left, right) => left - right), finding_count: plan.packages.reduce((total, agent_package) => total + agent_package.violations.length, 0), excluded_count: plan.excluded_findings.length, linked_scope_together: linked_package !== undefined && linked_files.every((file) => linked_package.files.includes(file)) };",
			"console.log(JSON.stringify(result));",
		].join("\n");
		const child_result = spawnSync(
			process.execPath,
			["--import", "tsx", "--input-type=module", "--eval", child_source],
			{ cwd: process.cwd(), encoding: "utf8", timeout: 10000 },
		);
		child_status = child_result.status;
		if (child_result.error === undefined) {
			child_error = "";
		} else {
			child_error = child_result.error.message;
		}
		child_output = child_result.stdout;
	});

	test("finishes within the deadline and preserves the complete linked assignment", () => {
		const report = JSON.parse(child_output);
		const planner = new AgentPackagePlanner("/project");
		const ordinary_plan = planner.plan(finding_factory.repeated("src/smoke.ts", 1, 8), [], 1, 10);
		const ordinary_package = ordinary_plan.packages[0];
		let ordinary_finding_count = 0;
		if (ordinary_package !== undefined) {
			ordinary_finding_count = ordinary_package.violations.length;
		}
		expect({
			child_error,
			child_status,
			package_count: report.package_count,
			file_counts: report.file_counts,
			finding_count: report.finding_count,
			excluded_count: report.excluded_count,
			linked_scope_together: report.linked_scope_together,
			ordinary_package_count: ordinary_plan.packages.length,
			ordinary_finding_count,
		}).toEqual({
			child_error: "",
			child_status: 0,
			package_count: 4,
			file_counts: [10, 10, 10, 147],
			finding_count: 31,
			excluded_count: 0,
			linked_scope_together: true,
			ordinary_package_count: 1,
			ordinary_finding_count: 1,
		});
	});

	test("keeps ordinary packages within their file capacity", () => {
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(finding_factory.indexed("src/small-{index}.ts", 10, 1, 8), [], 1, 10);
		const packages = plan.packages;
		const first_package = packages[0];
		let assigned_count = 0;
		if (first_package !== undefined) {
			assigned_count = first_package.violations.length;
		}
		let file_count = 0;
		if (first_package !== undefined) {
			file_count = first_package.files.length;
		}
		expect({ package_count: packages.length, assigned_count, file_count }).toEqual({
			package_count: 1,
			assigned_count: 10,
			file_count: 10,
		});
	});
});
