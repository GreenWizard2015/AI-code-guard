import { describe, expect, test } from "@jest/globals";
import { AgentPackagePlanner } from "src/core/support/task/reporting/workspace/task_selection/planning/agent_package_planner";
import { ViolationValue } from "src/model/violation_value";
import { AgentPackagePlannerFindingFactory } from "tests/core/support/task/reporting/workspace/task_selection/agent_package_planner_finding_factory";
import { AgentPackagePlannerSnapshotFixture } from "tests/core/support/task/reporting/workspace/task_selection/planning/agent_package_planner_snapshot_fixture";

describe("agent package planner", () => {
	const finding_factory = new AgentPackagePlannerFindingFactory();

	test("emits the largest feasible package count up to the requested count and covers every finding once", () => {
		const violations = Array.from({ length: 39 }, (_unused, index) => {
			return new ViolationValue({
				file: `src/file-${index}.ts`,
				line: 1,
				message: `finding ${index}`,
				hint: "fix it",
				rule_id: "class-size",
				priority: 7,
			});
		});
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 4, 20);
		const assigned = plan.packages.flatMap((agent_package) => agent_package.violations);
		const assigned_set = new Set(assigned);
		const package_file_counts = plan.packages.map((agent_package) => agent_package.files.length);
		const assigned_file_counts = new Map<string, number>();
		for (const agent_package of plan.packages) {
			for (const file of agent_package.files) {
				assigned_file_counts.set(file, (assigned_file_counts.get(file) ?? 0) + 1);
			}
		}
		const assignment_counts = [...assigned_file_counts.values()];

		expect({
			package_count: plan.packages.length,
			package_file_counts,
			all_packages_within_file_capacity: package_file_counts.every((count) => count <= 20),
			assigned_count: assigned.length,
			unique_assigned_count: assigned_set.size,
			unique_files_assigned_once: assignment_counts.every((count) => count === 1),
		}).toEqual({
			package_count: 3,
			package_file_counts: [13, 13, 13],
			all_packages_within_file_capacity: true,
			assigned_count: violations.length,
			unique_assigned_count: violations.length,
			unique_files_assigned_once: true,
		});
	});

	test("balances priority counts across packages while keeping file counts even", () => {
		const violations = [
			...finding_factory.indexed("src/high-{index}.ts", 10, 1, 8),
			...finding_factory.indexed("src/low-{index}.ts", 10, 1, 1),
		];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 2, 10);
		const package_distribution = plan.packages.map((agent_package) => ({
			file_count: agent_package.files.length,
			high_priority_count: agent_package.violations.filter((finding) => finding.priority() === 8).length,
			low_priority_count: agent_package.violations.filter((finding) => finding.priority() === 1).length,
		}));

		expect(package_distribution).toEqual([
			{ file_count: 10, high_priority_count: 5, low_priority_count: 5 },
			{ file_count: 10, high_priority_count: 5, low_priority_count: 5 },
		]);
	});

	test("retains all linked production and test findings when their four files fit one package", () => {
		const violations = [
			...finding_factory.indexed("src/a.ts", 5, 1, 7),
			...finding_factory.indexed("src/b.ts", 5, 1, 7),
			...finding_factory.indexed("tests/a.test.ts", 40, 1, 7),
			...finding_factory.indexed("src/c.ts", 10, 1, 7),
		];
		const links = [{ test_file: "tests/a.test.ts", production_files: ["src/a.ts", "src/b.ts"] }];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, links, 2, 10);

		const linked_files = ["src/a.ts", "src/b.ts", "tests/a.test.ts"];
		const linked_package_numbers = linked_files.map((file) => {
			const package_owner = plan.packages.find((agent_package) => agent_package.files.includes(file));
			if (package_owner === undefined) {
				return 0;
			}
			return package_owner.number;
		});
		const linked_package_number_set = new Set(linked_package_numbers);
		const linked_package_findings = plan.packages
			.filter((agent_package) => linked_package_number_set.has(agent_package.number))
			.flatMap((agent_package) => agent_package.violations);
		const linked_package_files = plan.packages
			.filter((agent_package) => linked_package_number_set.has(agent_package.number))
			.flatMap((agent_package) => agent_package.files);
		const linked_test_targets = plan.packages
			.filter((agent_package) => linked_package_number_set.has(agent_package.number))
			.flatMap((agent_package) => agent_package.test_target_links);
		expect({
			package_count: plan.packages.length,
			package_file_counts: plan.packages.map((agent_package) => agent_package.files.length),
			linked_packages_have_one_owner: linked_package_number_set.size === 1 && !linked_package_number_set.has(0),
			linked_production_count: linked_package_findings.filter((finding) => {
				return !finding.file().startsWith("tests/");
			}).length,
			linked_test_finding_count: linked_package_findings.filter((finding) => {
				return finding.file().startsWith("tests/");
			}).length,
			linked_files: linked_package_files,
			linked_test_targets,
		}).toEqual({
			package_count: 1,
			package_file_counts: [4],
			linked_packages_have_one_owner: true,
			linked_production_count: 20,
			linked_test_finding_count: 40,
			linked_files: expect.arrayContaining(linked_files),
			linked_test_targets: expect.arrayContaining([
				{ test_file: "tests/a.test.ts", production_files: ["src/a.ts", "src/b.ts"] },
			]),
		});
	});

	test("compresses package-owned sibling files into disjoint folder scopes", () => {
		const violations = [
			...finding_factory.indexed("src/a/file-{index}.ts", 10, 1, 7),
			...finding_factory.indexed("src/b/file-{index}.ts", 10, 1, 7),
		];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 2, 10);

		expect(plan.packages.map((agent_package) => agent_package.path_scopes)).toEqual([["src/a/"], ["src/b/"]]);
	});

	test("splits an oversized folder across packages when needed to reach the requested count", () => {
		const violations = [
			...finding_factory.indexed("src/a/file-{index}.ts", 20, 1, 7),
			...finding_factory.indexed("src/b/file-{index}.ts", 20, 1, 7),
		];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 4, 10);

		expect({
			package_count: plan.packages.length,
			package_file_counts: plan.packages.map((agent_package) => agent_package.files.length),
			within_capacity: plan.packages.every((agent_package) => agent_package.files.length <= 10),
		}).toEqual({ package_count: 4, package_file_counts: [10, 10, 10, 10], within_capacity: true });
	});

	test("keeps existing folder owners and package numbers when a new earlier-sorting folder appears", () => {
		const initial_findings = [
			...finding_factory.indexed("src/a/file-{index}.ts", 10, 1, 7),
			...finding_factory.indexed("src/b/file-{index}.ts", 10, 1, 7),
		];
		const planner = new AgentPackagePlanner("/project");
		const initial_plan = planner.plan(initial_findings, [], 2, 10);
		const previous_assignments = initial_plan.packages.map(({ number, files, path_scopes }) => ({
			package_number: number,
			files,
			path_scopes,
		}));
		const next_findings = [...initial_findings, ...finding_factory.indexed("src/0-new/file-{index}.ts", 10, 1, 7)];
		const next_planner = new AgentPackagePlanner("/project", previous_assignments);
		const next_plan = next_planner.plan(next_findings, [], 3, 10);

		expect(next_plan.packages.map(({ number, path_scopes }) => [number, path_scopes])).toEqual([
			[1, ["src/a/"]],
			[2, ["src/b/"]],
			[3, ["src/0-new/"]],
		]);
	});

	test("fits the 52-finding linked snapshot into two feasible packages", () => {
		const fixture = new AgentPackagePlannerSnapshotFixture(finding_factory);
		const plan = fixture.plan(new AgentPackagePlanner("/project"));
		const package_file_counts = plan.packages.map((agent_package) => agent_package.files.length);
		const package_file_total = package_file_counts.reduce((total, count) => total + count, 0);
		const all_package_file_counts_are_feasible = package_file_counts.every((count) => count >= 10 && count <= 50);

		expect({
			package_count: plan.packages.length,
			package_file_total,
			all_package_file_counts_are_feasible,
		}).toEqual({ package_count: 2, package_file_total: 29, all_package_file_counts_are_feasible: true });
	});

	test("retains all findings and keeps each linked scope in one package", () => {
		const fixture = new AgentPackagePlannerSnapshotFixture(finding_factory);
		const plan = fixture.plan(new AgentPackagePlanner("/project"));
		const packaged_findings = plan.packages.flatMap((agent_package) => agent_package.violations);
		const unique_packaged_findings = new Set(packaged_findings);
		const linked_scopes_have_one_owner = fixture.linked_scopes().every((linked_files) => {
			const package_numbers = linked_files.map((file) => fixture.owner_number(plan.packages, file));
			const unique_package_numbers = new Set(package_numbers);
			return unique_package_numbers.size === 1 && !package_numbers.includes(0);
		});

		expect({
			linked_scopes_have_one_owner,
			packaged_finding_count: packaged_findings.length,
			unique_packaged_finding_count: unique_packaged_findings.size,
			excluded_finding_count: plan.excluded_findings.length,
		}).toEqual({
			linked_scopes_have_one_owner: true,
			packaged_finding_count: 52,
			unique_packaged_finding_count: 52,
			excluded_finding_count: 0,
		});
	});

	test("keeps folder ownership on an identical rerun", () => {
		const violations = [
			...finding_factory.indexed("src/a/file-{index}.ts", 10, 1, 7),
			...finding_factory.indexed("src/b/file-{index}.ts", 10, 1, 7),
		];
		const first_planner = new AgentPackagePlanner("/project");
		const first_plan = first_planner.plan(violations, [], 2, 10);
		const previous_assignments = first_plan.packages.map(({ number, files, path_scopes }) => ({
			package_number: number,
			files,
			path_scopes,
		}));
		const repeated_planner = new AgentPackagePlanner("/project", previous_assignments);
		const repeated_plan = repeated_planner.plan(violations, [], 2, 10);

		expect(repeated_plan.packages.map(({ number, path_scopes }) => [number, path_scopes])).toEqual(
			first_plan.packages.map(({ number, path_scopes }) => [number, path_scopes]),
		);
	});

	test("keeps package numbers with gaps when other folders become clean", () => {
		const initial_findings = [
			...finding_factory.indexed("src/a/file-{index}.ts", 10, 1, 7),
			...finding_factory.indexed("src/b/file-{index}.ts", 10, 1, 7),
			...finding_factory.indexed("src/c/file-{index}.ts", 10, 1, 7),
			...finding_factory.indexed("src/d/file-{index}.ts", 10, 1, 7),
		];
		const planner = new AgentPackagePlanner("/project");
		const initial_plan = planner.plan(initial_findings, [], 4, 10);
		const previous_assignments = initial_plan.packages.map(({ number, files, path_scopes }) => ({
			package_number: number,
			files,
			path_scopes,
		}));
		const active_findings = initial_findings.filter((violation) => {
			return violation.file().startsWith("src/b/") || violation.file().startsWith("src/d/");
		});
		const next_planner = new AgentPackagePlanner("/project", previous_assignments);
		const next_plan = next_planner.plan(active_findings, [], 4, 10);

		expect(next_plan.packages.map(({ number, path_scopes }) => [number, path_scopes])).toEqual([
			[2, ["src/b/"]],
			[4, ["src/d/"]],
		]);
	});

	test("emits one package for any nonempty finding set below the hidden minimum", () => {
		const violations = [...finding_factory.indexed("src/a.ts", 9, 1, 7)];
		const planner = new AgentPackagePlanner("/project");
		const plan = planner.plan(violations, [], 4, 20);
		const packaged_findings = plan.packages.flatMap((agent_package) => agent_package.violations);

		expect({
			package_count: plan.packages.length,
			violations: packaged_findings.length,
			unresolved_constraints: plan.unresolved_partition_constraints,
		}).toEqual({ package_count: 1, violations: 9, unresolved_constraints: 0 });
	});
});
