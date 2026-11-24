import { relative, resolve } from "node:path";
import { MINIMUM_AGENT_BATCH_SIZE } from "src/core/constants";
import { INVALID_FINDING_PARTITION_MESSAGE } from "src/core/support/task/reporting/workspace/task_selection/constants";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	AgentPackageBoundsValidation,
	AgentPackageFileRecordRequest,
	AgentPackagePlan,
	AgentPackagePlanValidatorContract,
	AgentPackageSelectionValidation,
	AgentPackageSizeValidation,
	AgentPackageValidationOwnership,
	AgentWorkPackage,
} from "src/task_selection_types";
import type { TestTargetLink } from "src/task_types";

/** Responsibilities: _package integrity_, _diagnostic ownership_. **/
export class AgentPackagePlanIntegrity implements AgentPackagePlanValidatorContract {
	private readonly _root: string;

	/** Responsibilities: _scope intersection_. **/
	private scopes_overlap(left: string, right: string): boolean {
		const left_directory = left.endsWith("/");
		const right_directory = right.endsWith("/");
		if (left === right) {
			return true;
		}
		if (left_directory && right.startsWith(left)) {
			return true;
		}
		return right_directory && left.startsWith(right);
	}

	/** Responsibilities: _scope-pair ownership_. **/
	private validate_scope_pair(left_scopes: readonly string[], right_scopes: readonly string[]): void {
		for (const left of left_scopes) {
			for (const right of right_scopes) {
				if (this.scopes_overlap(left, right)) {
					throw new Error(`Agent path scopes ${left} and ${right} overlap.`);
				}
			}
		}
	}

	/** Responsibilities: _linked file ownership_. **/
	private validate_link_ownership(
		link: TestTargetLink,
		file_owners: ReadonlyMap<string, number>,
		package_index: number,
	): void {
		const linked_files = [link.test_file, ...link.production_files];
		for (const file of linked_files) {
			const owner = file_owners.get(file);
			if (owner !== undefined && owner !== package_index) {
				throw new Error(`Test target ${link.test_file} crosses agent package ownership at ${file}.`);
			}
		}
	}

	/** Responsibilities: _cross-package scope ownership_. **/
	private validate_scope_ownership(packages: readonly AgentWorkPackage[]): void {
		for (let left_index = 0; left_index < packages.length; left_index += 1) {
			const left_package = packages[left_index];
			if (left_package === undefined) {
				continue;
			}
			for (let right_index = left_index + 1; right_index < packages.length; right_index += 1) {
				const right_package = packages[right_index];
				if (right_package === undefined) {
					continue;
				}
				this.validate_scope_pair(left_package.path_scopes, right_package.path_scopes);
			}
		}
	}

	/** Responsibilities: _test target ownership_. **/
	private validate_test_links(plan: AgentPackagePlan, file_owners: ReadonlyMap<string, number>): void {
		for (const [index, agent_package] of plan.packages.entries()) {
			for (const link of agent_package.test_target_links) {
				this.validate_link_ownership(link, file_owners, index);
			}
		}
	}

	/** Responsibilities: _diagnostic identity_. **/
	private finding_identity(violation: ViolationContract): string {
		return JSON.stringify([
			violation.file().replaceAll("\\", "/"),
			violation.line(),
			violation.rule_id(),
			violation.priority(),
			violation.message(),
		]);
	}

	/** Responsibilities: _diagnostic frequencies_. **/
	private finding_counts(findings: readonly ViolationContract[]): Map<string, number> {
		const counts = new Map<string, number>();
		for (const finding of findings) {
			const identity = this.finding_identity(finding);
			counts.set(identity, (counts.get(identity) ?? 0) + 1);
		}
		return counts;
	}

	/** Responsibilities: _package diagnostic ownership_. **/
	private record_package_findings(agent_package: AgentWorkPackage, findings: Map<string, number>): void {
		for (const finding of agent_package.violations) {
			const identity = this.finding_identity(finding);
			findings.set(identity, (findings.get(identity) ?? 0) + 1);
			const finding_path = relative(this._root, resolve(this._root, finding.file())).replaceAll("\\", "/");
			if (!agent_package.files.includes(finding_path)) {
				throw new Error(`Finding path ${finding.file()} is absent from its package ownership list.`);
			}
		}
	}

	/** Responsibilities: _violation accounting_. **/
	private validate_finding_partition(
		selected_findings: readonly ViolationContract[],
		packaged_findings: ReadonlyMap<string, number>,
		excluded_findings: readonly ViolationContract[],
	): void {
		const expected = this.finding_counts(selected_findings);
		const accounted = new Map(packaged_findings);
		for (const finding of excluded_findings) {
			const identity = this.finding_identity(finding);
			accounted.set(identity, (accounted.get(identity) ?? 0) + 1);
		}
		if (expected.size !== accounted.size) {
			throw new Error(INVALID_FINDING_PARTITION_MESSAGE);
		}
		for (const [identity, count] of expected) {
			if (accounted.get(identity) !== count) {
				throw new Error(INVALID_FINDING_PARTITION_MESSAGE);
			}
		}
	}

	/** Responsibilities: _package size_. **/
	private validate_package_size(request: AgentPackageSizeValidation): void {
		const { agent_package, batch_size, package_count } = request;
		const package_files = new Set(agent_package.files);
		const count = package_files.size;
		let minimum = MINIMUM_AGENT_BATCH_SIZE;
		if (package_count === 1 && count < MINIMUM_AGENT_BATCH_SIZE) {
			minimum = count === 0 ? 0 : 1;
		}
		if (count < minimum || count > batch_size) {
			throw new Error(`Agent package ${agent_package.number} is outside the ${minimum}–${batch_size} file limit.`);
		}
	}

	/** Responsibilities: _package file ownership_. **/
	private record_files(request: AgentPackageFileRecordRequest): void {
		const { agent_package, index, files } = request;
		for (const file of agent_package.files) {
			if (files.has(file)) {
				throw new Error(`File ${file} is assigned to more than one agent package.`);
			}
			files.set(file, index);
		}
	}

	/** Responsibilities: _package ownership records_. **/
	private package_ownership(
		packages: readonly AgentWorkPackage[],
		batch_size: number,
	): AgentPackageValidationOwnership {
		const findings = new Map<string, number>();
		const files = new Map<string, number>();
		for (const [index, agent_package] of packages.entries()) {
			this.validate_package_size({ agent_package, batch_size, package_count: packages.length });
			this.record_package_findings(agent_package, findings);
			this.record_files({ agent_package, index, files });
		}
		return { findings, files };
	}

	/** Responsibilities: _plan bounds_. **/
	private validate_bounds(request: AgentPackageBoundsValidation): void {
		if (request.package_count > request.requested_count) {
			throw new Error("Agent package plan exceeds the requested package count.");
		}
		if (request.unresolved_partition_constraints !== 0) {
			throw new Error("Agent package plan reports unresolved partition constraints.");
		}
	}

	/** Responsibilities: _package presence_. **/
	private validate_selection_shape(request: AgentPackageSelectionValidation): void {
		if (request.selected_findings.length === 0 && request.plan.packages.length > 0) {
			throw new Error("Agent package plan contains packages for an empty finding set.");
		}
		if (request.selected_findings.length > 0 && request.plan.packages.length === 0) {
			throw new Error("Agent package plan does not cover the selected findings.");
		}
	}

	/** Responsibilities: _plan root and validators_. **/
	public constructor(root: string) {
		this._root = root;
	}

	/** Responsibilities: _complete plan validation_. **/
	public validate(plan: AgentPackagePlan, selected_findings: readonly ViolationContract[]): void {
		this.validate_bounds({
			package_count: plan.packages.length,
			requested_count: plan.requested_count,
			unresolved_partition_constraints: plan.unresolved_partition_constraints,
		});
		this.validate_selection_shape({ plan, selected_findings });
		if (selected_findings.length === 0) {
			return;
		}
		const ownership = this.package_ownership(plan.packages, plan.batch_size);
		this.validate_finding_partition(selected_findings, ownership.findings, plan.excluded_findings);
		this.validate_scope_ownership(plan.packages);
		this.validate_test_links(plan, ownership.files);
	}
}
