import type { AgentPackagePlanner } from "src/core/support/task/reporting/workspace/task_selection/planning/agent_package_planner";
import type { ViolationValue } from "src/model/violation_value";
import type { AgentPackagePlan } from "src/task_selection_types";
import type { TestTargetLink } from "src/task_types";
import type { AgentPackagePlannerFindingFactory } from "tests/core/support/task/reporting/workspace/task_selection/agent_package_planner_finding_factory";

/** Responsibilities: _52-finding planner snapshot_, _linked package scopes_. **/
export class AgentPackagePlannerSnapshotFixture {
	private readonly _finding_factory: AgentPackagePlannerFindingFactory;

	/** Responsibilities: _reporting snapshot findings_. **/
	private reporting_findings(): ViolationValue[] {
		const production_files = ["src/reporting/a.ts", "src/reporting/b.ts", "src/reporting/c.ts"];
		return production_files.flatMap((file) => this._finding_factory.repeated(file, 3, 5));
	}

	/** Responsibilities: _planner snapshot findings_. **/
	private planner_findings(): ViolationValue[] {
		const production_findings: ViolationValue[] = [];
		for (let index = 0; index < 8; index += 1) {
			const file = `src/planner-${index}.ts`;
			let finding_count = 1;
			if (index < 7) {
				finding_count = 2;
			}
			production_findings.push(...this._finding_factory.repeated(file, finding_count, 7));
		}
		const test_files = ["tests/planner-0.test.ts", "tests/planner-1.test.ts", "tests/planner-2.test.ts"];
		const test_findings: ViolationValue[] = [];
		for (const [index, test_file] of test_files.entries()) {
			let finding_count = 8;
			if (index < 2) {
				finding_count = 9;
			}
			test_findings.push(...this._finding_factory.repeated(test_file, finding_count, 7));
		}
		return [...production_findings, ...test_findings];
	}

	/** Responsibilities: _independent snapshot findings_. **/
	private independent_findings(): ViolationValue[] {
		return [
			...this._finding_factory.repeated("src/cli_application.ts", 1, 3),
			...this._finding_factory.repeated("tests/core/task-review-process-status.test.ts", 1, 2),
		];
	}

	/** Responsibilities: _snapshot test links_. **/
	private links(): TestTargetLink[] {
		const reporting_test_files = Array.from({ length: 13 }, (_unused, index) => `tests/reporting-${index}.test.ts`);
		const reporting_production_files = ["src/reporting/a.ts", "src/reporting/b.ts", "src/reporting/c.ts"];
		const reporting_links = reporting_test_files.map((test_file) => ({
			test_file,
			production_files: reporting_production_files,
		}));
		const planner_test_files = ["tests/planner-0.test.ts", "tests/planner-1.test.ts", "tests/planner-2.test.ts"];
		const planner_production_files = Array.from({ length: 8 }, (_unused, index) => `src/planner-${index}.ts`);
		const planner_links = planner_test_files.map((test_file) => ({
			test_file,
			production_files: planner_production_files,
		}));
		return [...reporting_links, ...planner_links];
	}

	/** Responsibilities: _snapshot fixture values_. **/
	public constructor(finding_factory: AgentPackagePlannerFindingFactory) {
		this._finding_factory = finding_factory;
	}

	/** Responsibilities: _complete 52-finding snapshot plan_. **/
	public plan(planner: AgentPackagePlanner): AgentPackagePlan {
		const violations = [...this.reporting_findings(), ...this.planner_findings(), ...this.independent_findings()];
		return planner.plan(violations, this.links(), 4, 50);
	}

	/** Responsibilities: _linked file groups_. **/
	public linked_scopes(): string[][] {
		return this.links().map((link) => [link.test_file, ...link.production_files]);
	}

	/** Responsibilities: _package owner number_. **/
	public owner_number(packages: AgentPackagePlan["packages"], file: string): number {
		for (const agent_package of packages) {
			if (agent_package.files.includes(file)) {
				return agent_package.number;
			}
		}
		return 0;
	}
}
