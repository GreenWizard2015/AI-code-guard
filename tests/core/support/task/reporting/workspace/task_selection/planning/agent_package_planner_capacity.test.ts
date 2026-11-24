import { describe, expect, test } from "@jest/globals";
import { AgentPackagePlanner } from "src/core/support/task/reporting/workspace/task_selection/planning/agent_package_planner";
import { AgentPackagePlannerFindingFactory } from "tests/core/support/task/reporting/workspace/task_selection/agent_package_planner_finding_factory";

describe("agent package capacity and priority", () => {
	const finding_factory = new AgentPackagePlannerFindingFactory();

	test("counts production and test files toward capacity and retains all included-file findings", () => {
		const production_findings = Array.from({ length: 9 }, (_unused, index) => {
			return finding_factory.repeated(`src/production-${index}.ts`, 2, 8);
		}).flat();
		const test_findings = [
			...finding_factory.indexed("tests/test-high.test.ts", 2, 1, 8),
			...finding_factory.indexed("tests/test-low.test.ts", 2, 1, 0),
		];
		const violations = [...production_findings, ...test_findings];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 1, 10);
		const package_files = plan.packages.flatMap((agent_package) => agent_package.files);
		const package_production_files = plan.packages.flatMap((agent_package) => agent_package.production_paths);
		const package_test_files = plan.packages.flatMap((agent_package) => agent_package.test_paths);
		const packaged_findings = plan.packages.flatMap((agent_package) => agent_package.violations);
		const excluded_file_set = new Set(plan.excluded_findings.map((finding) => finding.file()));

		expect({
			package_count: plan.packages.length,
			owned_file_count: package_files.length,
			production_file_count: package_production_files.length,
			test_file_count: package_test_files.length,
			finding_count: packaged_findings.length,
			excluded_files: [...excluded_file_set],
		}).toEqual({
			package_count: 1,
			owned_file_count: 10,
			production_file_count: 9,
			test_file_count: 1,
			finding_count: 20,
			excluded_files: ["tests/test-low.test.ts"],
		});
	});

	test("drops lowest-priority excess files whole", () => {
		const high_priority = Array.from({ length: 10 }, (_unused, index) => {
			return finding_factory.repeated(`src/high-${index}.ts`, 2, 8);
		}).flat();
		const low_priority = [
			...finding_factory.indexed("src/low-a.ts", 3, 1, 1),
			...finding_factory.indexed("src/low-b.ts", 3, 1, 1),
		];
		const violations = [...high_priority, ...low_priority];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 1, 10);
		const packaged_files = plan.packages.flatMap((agent_package) => agent_package.files);
		const excluded_file_list = plan.excluded_findings.map((finding) => finding.file());
		const excluded_files = [...new Set(excluded_file_list)];
		excluded_files.sort();

		expect({
			owned_file_count: packaged_files.length,
			selected_high_files: packaged_files.filter((file) => file.startsWith("src/high-")).length,
			selected_low_files: packaged_files.filter((file) => file.startsWith("src/low-")).length,
			excluded_finding_count: plan.excluded_findings.length,
			excluded_files,
		}).toEqual({
			owned_file_count: 10,
			selected_high_files: 10,
			selected_low_files: 0,
			excluded_finding_count: 6,
			excluded_files: ["src/low-a.ts", "src/low-b.ts"],
		});
	});

	test("chooses the same excluded files for the same priority ordering", () => {
		const high_priority = Array.from({ length: 10 }, (_unused, index) => {
			return finding_factory.repeated(`src/high-${index}.ts`, 2, 8);
		}).flat();
		const low_priority = [
			...finding_factory.indexed("src/low-a.ts", 3, 1, 1),
			...finding_factory.indexed("src/low-b.ts", 3, 1, 1),
		];
		const violations = [...high_priority, ...low_priority];
		const first_planner = new AgentPackagePlanner("/project");
		const second_planner = new AgentPackagePlanner("/project");
		const first_plan = first_planner.plan(violations, [], 1, 10);
		const second_plan = second_planner.plan(violations, [], 1, 10);
		const first_excluded_files = first_plan.excluded_findings.map((finding) => finding.file());
		const second_excluded_files = second_plan.excluded_findings.map((finding) => finding.file());
		first_excluded_files.sort();
		second_excluded_files.sort();

		expect(first_excluded_files).toEqual(second_excluded_files);
	});

	test("retains every finding from each selected file", () => {
		const high_priority = Array.from({ length: 10 }, (_unused, index) => {
			return finding_factory.repeated(`src/high-${index}.ts`, 2, 8);
		}).flat();
		const low_priority = [
			...finding_factory.indexed("src/low-a.ts", 3, 1, 1),
			...finding_factory.indexed("src/low-b.ts", 3, 1, 1),
		];
		const violations = [...high_priority, ...low_priority];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 1, 10);
		const packaged_findings_by_file = new Map<string, number>();
		for (const agent_package of plan.packages) {
			for (const finding of agent_package.violations) {
				const current_count = packaged_findings_by_file.get(finding.file()) ?? 0;
				packaged_findings_by_file.set(finding.file(), current_count + 1);
			}
		}
		const included_files_are_complete = plan.packages.every((agent_package) => {
			return agent_package.files.every((file) => {
				const expected_count = violations.filter((finding) => finding.file() === file).length;
				return packaged_findings_by_file.get(file) === expected_count;
			});
		});

		expect(included_files_are_complete).toBe(true);
	});

	test("keeps linked production and test files together within file capacity", () => {
		const linked_findings = [
			...finding_factory.indexed("src/linked-a.ts", 4, 1, 8),
			...finding_factory.indexed("src/linked-b.ts", 3, 1, 8),
			...finding_factory.indexed("tests/linked.test.ts", 5, 1, 8),
		];
		const independent_findings = Array.from({ length: 9 }, (_unused, index) => {
			return finding_factory.repeated(`src/independent-${index}.ts`, 2, 5);
		}).flat();
		const violations = [...linked_findings, ...independent_findings];
		const links = [{ test_file: "tests/linked.test.ts", production_files: ["src/linked-a.ts", "src/linked-b.ts"] }];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, links, 2, 10);
		const linked_files = ["src/linked-a.ts", "src/linked-b.ts", "tests/linked.test.ts"];
		const linked_package_numbers = linked_files.map((file) => {
			const owner = plan.packages.find((agent_package) => agent_package.files.includes(file));
			if (owner === undefined) {
				return 0;
			}
			return owner.number;
		});
		const each_package_within_file_capacity = plan.packages.every((agent_package) => agent_package.files.length <= 10);
		const linked_package_number_set = new Set(linked_package_numbers);

		expect({
			each_package_within_file_capacity,
			linked_files_have_one_owner:
				linked_package_numbers.every((number) => number > 0) && linked_package_number_set.size === 1,
		}).toEqual({
			each_package_within_file_capacity: true,
			linked_files_have_one_owner: true,
		});
	});

	test("excludes an oversized linked group whole and keeps a feasible package", () => {
		const linked_findings = [
			...finding_factory.indexed("src/linked.ts", 1, 1, 8),
			...Array.from({ length: 10 }, (_unused, index) => {
				return finding_factory.indexed(`tests/linked-${index}.test.ts`, 1, 1, 8);
			}).flat(),
		];
		const independent_findings = Array.from({ length: 9 }, (_unused, index) => {
			return finding_factory.indexed(`src/independent-${index}.ts`, 1, 1, 5);
		}).flat();
		const links = Array.from({ length: 10 }, (_unused, index) => ({
			test_file: `tests/linked-${index}.test.ts`,
			production_files: ["src/linked.ts"],
		}));
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan([...linked_findings, ...independent_findings], links, 4, 10);
		const packaged_files = plan.packages.flatMap((agent_package) => agent_package.files);

		expect({
			package_count: plan.packages.length,
			package_file_count: packaged_files.length,
			linked_files_excluded: plan.excluded_findings.length,
			linked_files_retained: packaged_files.filter((file) => file.startsWith("tests/linked-")).length,
		}).toEqual({ package_count: 1, package_file_count: 9, linked_files_excluded: 11, linked_files_retained: 0 });
	});

	test("retains all findings from included linked and independent files", () => {
		const linked_findings = [
			...finding_factory.indexed("src/linked-a.ts", 4, 1, 8),
			...finding_factory.indexed("src/linked-b.ts", 3, 1, 8),
			...finding_factory.indexed("tests/linked.test.ts", 5, 1, 8),
		];
		const independent_findings = Array.from({ length: 9 }, (_unused, index) => {
			return finding_factory.repeated(`src/independent-${index}.ts`, 2, 5);
		}).flat();
		const violations = [...linked_findings, ...independent_findings];
		const links = [{ test_file: "tests/linked.test.ts", production_files: ["src/linked-a.ts", "src/linked-b.ts"] }];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, links, 2, 10);
		const packaged_file_findings = new Map<string, number>();
		for (const agent_package of plan.packages) {
			for (const finding of agent_package.violations) {
				const current_count = packaged_file_findings.get(finding.file()) ?? 0;
				packaged_file_findings.set(finding.file(), current_count + 1);
			}
		}
		const included_files_are_complete = plan.packages.every((agent_package) =>
			agent_package.files.every((file) => {
				const expected_count = violations.filter((finding) => finding.file() === file).length;
				return packaged_file_findings.get(file) === expected_count;
			}),
		);

		expect(included_files_are_complete).toBe(true);
	});

	test("does not let test diagnostic priority displace higher-priority production files", () => {
		const linked_findings = [
			...finding_factory.indexed("src/low-priority.ts", 1, 1, 1),
			...finding_factory.indexed("tests/linked.test.ts", 1, 1, 8),
		];
		const production_findings = Array.from({ length: 9 }, (_unused, index) => {
			return finding_factory.repeated(`src/high-priority-${index}.ts`, 1, 7);
		}).flat();
		const violations = [...linked_findings, ...production_findings];
		const links = [{ test_file: "tests/linked.test.ts", production_files: ["src/low-priority.ts"] }];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, links, 1, 10);
		const retained_production_files = plan.packages.flatMap((agent_package) => agent_package.production_paths);
		const retained_test_files = plan.packages.flatMap((agent_package) => agent_package.test_paths);
		const excluded_files = plan.excluded_findings.map((finding) => finding.file());

		expect({
			package_count: plan.packages.length,
			retained_production_files,
			retained_test_files,
			excluded_files,
		}).toEqual({
			package_count: 1,
			retained_production_files: expect.arrayContaining(
				Array.from({ length: 9 }, (_unused, index) => `src/high-priority-${index}.ts`),
			),
			retained_test_files: [],
			excluded_files: ["src/low-priority.ts", "tests/linked.test.ts"],
		});
	});
});
