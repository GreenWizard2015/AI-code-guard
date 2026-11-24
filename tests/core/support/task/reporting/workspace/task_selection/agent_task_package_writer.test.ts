import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AgentTaskPackagePublication } from "src/core/support/task/reporting/workspace/task_selection/agent_task_package_publication";
import { AgentPackageAssignmentStore } from "src/core/support/task/reporting/workspace/task_selection/assignment/ownership/agent_package_assignment_store";
import { ViolationValue } from "src/model/violation_value";
import type { AgentPackagePublicationRequest } from "src/task_selection_types";
import { FailingDirectorySwapIO } from "tests/bridge/ts/core/cache/failing_directory_swap_io";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("agent task package writer", () => {
	/** Responsibilities: _diagnostic fixture values_. **/
	const findings = (prefix: string, count = 10, findings_per_file = 1, priority = 7): ViolationValue[] => {
		return Array.from({ length: count }, (_unused, index) => {
			return Array.from({ length: findings_per_file }, (_unused_finding, finding_index) => {
				return new ViolationValue({
					file: `src/${prefix}-${index}.ts`,
					line: finding_index + 1,
					message: `finding ${prefix}-${index}:${finding_index + 1}`,
					hint: "fix it",
					rule_id: "class-size",
					priority,
				});
			});
		}).flat();
	};
	/** Responsibilities: _publication request values_. **/
	const publish_request = (
		selected_findings: ViolationValue[],
		package_count: number,
	): AgentPackagePublicationRequest => ({
		selected_findings,
		snapshot_findings: selected_findings,
		test_target_links: [],
		package_count,
		batch_size: 10,
		deferred_findings: 0,
		suppressed_findings: 0,
	});
	/** Responsibilities: _swap failure fixture_. **/
	const failing_file_io = (): FailingDirectorySwapIO => new FailingDirectorySwapIO();
	/** Responsibilities: _published package recovery fixture_. **/
	const published_recovery_fixture = (): {
		file_io: FailingDirectorySwapIO;
		previous_request: AgentPackagePublicationRequest;
		previous_text: string;
		root: string;
		workspace: string;
	} => {
		const root = "/virtual/agent-package-writer";
		const workspace = join(root, ".ai-code-guard");
		const file_io = failing_file_io();
		file_io.create_directory(workspace);
		const writer = new AgentTaskPackagePublication(root, file_io);
		const previous_request = publish_request(findings("previous"), 1);
		writer.publish(previous_request);
		const previous_text = file_io.file(join(workspace, "agent-tasks/agent-01.md")).file_text();
		return { file_io, previous_request, previous_text, root, workspace };
	};
	/** Responsibilities: _capacity package publication fixture_. **/
	const capacity_fixture = (): {
		file_io: InMemoryFileIO;
		root: string;
		selected_findings: ViolationValue[];
		writer: AgentTaskPackagePublication;
		workspace: string;
	} => {
		const root = "/virtual/agent-package-capacity";
		const workspace = join(root, ".ai-code-guard");
		const file_io = new InMemoryFileIO();
		file_io.create_directory(workspace);
		const writer = new AgentTaskPackagePublication(root, file_io);
		const selected_findings = [...findings("capacity-high", 10, 2, 8), ...findings("capacity-low", 2, 2, 1)];
		return { file_io, root, selected_findings, writer, workspace };
	};

	test("recovers existing folder ownership from package markdown without a manifest", () => {
		const root = "/virtual/agent-package-legacy";
		const file_io = new InMemoryFileIO();
		const directory = join(root, ".ai-code-guard/agent-tasks");
		file_io.create_directory(directory);
		file_io
			.file(join(directory, "agent-02.md"))
			.write_text("# Agent task 02\n\n## Owned paths\n\n- `src/a/`\n\n## Findings\n");
		const assignment_store = new AgentPackageAssignmentStore(root, file_io);

		expect(assignment_store.previous_assignments()).toEqual([
			{ package_number: 2, files: [], path_scopes: ["src/a/"] },
		]);
	});

	test("writes an assignment manifest matching the published plan", () => {
		const root = "/virtual/agent-package-writer";
		const workspace = join(root, ".ai-code-guard");
		const file_io = new InMemoryFileIO();
		file_io.create_directory(workspace);
		const writer = new AgentTaskPackagePublication(root, file_io);
		const previous_findings = findings("previous");
		const first_request = {
			selected_findings: previous_findings,
			snapshot_findings: previous_findings,
			test_target_links: [],
			package_count: 1,
			batch_size: 20,
			deferred_findings: 0,
			suppressed_findings: 0,
		};
		const previous_plan = writer.publish(first_request);
		const assignment_store = new AgentPackageAssignmentStore(root, file_io);
		const expected_assignments = previous_plan.packages.map(({ number, files, path_scopes }) => ({
			package_number: number,
			files,
			path_scopes,
		}));

		expect(assignment_store.previous_assignments()).toEqual(expected_assignments);
	});

	test("keeps folder package numbers on an identical publication rerun", () => {
		const root = "/virtual/agent-package-stable-rerun";
		const file_io = new InMemoryFileIO();
		file_io.create_directory(join(root, ".ai-code-guard"));
		const writer = new AgentTaskPackagePublication(root, file_io);
		const selected_findings = [...findings("a/file"), ...findings("b/file")];
		const first_plan = writer.publish(publish_request(selected_findings, 2));
		const repeated_plan = writer.publish(publish_request(selected_findings, 2));
		const first_ownership = first_plan.packages.map(({ number, path_scopes }) => [number, path_scopes]);
		const repeated_ownership = repeated_plan.packages.map(({ number, path_scopes }) => [number, path_scopes]);

		expect(repeated_ownership).toEqual(first_ownership);
	});

	test("limits package size by whole files and retains every selected finding in those files", () => {
		const fixture = capacity_fixture();
		const writer = new AgentTaskPackagePublication(fixture.root, fixture.file_io);
		const plan = writer.publish(publish_request(fixture.selected_findings, 1));
		const package_file_set = new Set(plan.packages.flatMap((agent_package) => agent_package.files));
		const package_file_names = [...package_file_set];
		const packaged_file_counts = new Map<string, number>();
		for (const agent_package of plan.packages) {
			for (const finding of agent_package.violations) {
				packaged_file_counts.set(finding.file(), (packaged_file_counts.get(finding.file()) ?? 0) + 1);
			}
		}
		const every_packaged_file_is_complete = package_file_names.every((file) => packaged_file_counts.get(file) === 2);
		const excluded_file_set = new Set(plan.excluded_findings.map((finding) => finding.file()));
		const excluded_file_list = [...excluded_file_set];
		const excluded_files = excluded_file_list.sort();

		expect({
			packaged_count: plan.packages.reduce((total, agent_package) => total + agent_package.violations.length, 0),
			package_file_count: package_file_names.length,
			within_file_capacity: plan.packages.every((agent_package) => agent_package.files.length <= 10),
			every_packaged_file_is_complete,
			excluded_count: plan.excluded_findings.length,
			excluded_files,
		}).toEqual({
			packaged_count: 20,
			package_file_count: 10,
			within_file_capacity: true,
			every_packaged_file_is_complete: true,
			excluded_count: 4,
			excluded_files: ["src/capacity-low-0.ts", "src/capacity-low-1.ts"],
		});
	});

	test("reports selected, packaged, and excluded findings in package documents", () => {
		const fixture = capacity_fixture();
		const writer = new AgentTaskPackagePublication(fixture.root, fixture.file_io);
		writer.publish(publish_request(fixture.selected_findings, 1));
		const summary = fixture.file_io.file(join(fixture.workspace, "agent-tasks/summary.md")).file_text();
		const package_document = fixture.file_io.file(join(fixture.workspace, "agent-tasks/agent-01.md")).file_text();
		expect({
			selected_count: summary.includes("Selected findings: 24"),
			packaged_summary: summary.includes("Packaged findings: 20"),
			excluded_summary: summary.includes("Excluded from packages by capacity or linked constraints: 4"),
			package_document_contains_all_file_diagnostics: package_document.includes("src/capacity-high-9.ts:2"),
		}).toEqual({
			selected_count: true,
			packaged_summary: true,
			excluded_summary: true,
			package_document_contains_all_file_diagnostics: true,
		});
	});

	test("reassigns a cleaned folder and keeps active ownership", () => {
		const root = "/virtual/agent-package-clean-scope";
		const file_io = new InMemoryFileIO();
		file_io.create_directory(join(root, ".ai-code-guard"));
		const writer = new AgentTaskPackagePublication(root, file_io);
		const first_findings = [...findings("a/file"), ...findings("b/file")];
		writer.publish(publish_request(first_findings, 2));

		const only_b_findings = first_findings.filter((finding) => finding.file().startsWith("src/b/"));
		const clean_plan = writer.publish(publish_request(only_b_findings, 1));
		const returned_plan = writer.publish(
			publish_request(
				[...only_b_findings, ...first_findings.filter((finding) => finding.file().startsWith("src/a/"))],
				2,
			),
		);

		expect(clean_plan.packages.map(({ number, path_scopes }) => [number, path_scopes])).toEqual([[1, ["src/b/"]]]);
		expect(returned_plan.packages.map(({ number, path_scopes }) => [number, path_scopes])).toEqual([
			[1, ["src/b/"]],
			[2, ["src/a/"]],
		]);
	});

	test("restores the previous complete package set when the staged directory swap fails", () => {
		const fixture = published_recovery_fixture();
		const next_findings = findings("next");
		const next_request = {
			...fixture.previous_request,
			selected_findings: next_findings,
			snapshot_findings: next_findings,
		};
		const writer = new AgentTaskPackagePublication(fixture.root, fixture.file_io);
		fixture.file_io.arm_staging_failure();
		expect(() => writer.publish(next_request)).toThrow();
		expect({
			package_text: fixture.file_io.file(join(fixture.workspace, "agent-tasks/agent-01.md")).file_text(),
			summary: fixture.file_io.file(join(fixture.workspace, "agent-tasks/summary.md")).file_text(),
		}).toEqual({
			package_text: fixture.previous_text,
			summary: expect.stringContaining("Selected findings: 10"),
		});
	});
});
