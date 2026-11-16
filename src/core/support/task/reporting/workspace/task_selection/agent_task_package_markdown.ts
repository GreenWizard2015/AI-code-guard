import { createHash } from "node:crypto";
import { TEST_PATH_SUFFIXES } from "src/constants";
import {
	AGENT_PACKAGE_EMPTY_PATH_LIST_ROW,
	AGENT_PACKAGE_FINDINGS_HEADING,
	AGENT_PACKAGE_FOCUSED_CHECKS,
	AGENT_PACKAGE_NO_FINDINGS_MESSAGE,
	AGENT_PACKAGE_OWNED_PATHS_HEADING,
	AGENT_PACKAGE_PRODUCTION_PATHS_HEADING,
	AGENT_PACKAGE_PROJECT_CHECKS,
	AGENT_PACKAGE_REQUIRED_CHECKS_HEADING,
	AGENT_PACKAGE_SUMMARY_HEADING,
	AGENT_PACKAGE_TEST_PATHS_HEADING,
	AGENT_PACKAGE_TEST_TARGET_LINKS_HEADING,
} from "src/core/support/task/reporting/workspace/task_selection/constants";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type {
	AgentPackageSummaryRequest,
	AgentTaskPackageMarkdownContract,
	AgentWorkPackage,
} from "src/task_selection_types";
import type {
	AgentPackageDetailRequest,
	AgentPackageDocumentContext,
	AgentPackageSummaryCountsRequest,
	TestTargetLink,
} from "src/task_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _task document rendering_, _snapshot identity_. **/
export class AgentTaskPackageMarkdown implements AgentTaskPackageMarkdownContract {
	private readonly _test_path_syntax: TestPathSyntaxContract;

	/** Responsibilities: _path row formatting_. **/
	private path_rows(paths: readonly string[]): string[] {
		if (paths.length === 0) {
			return [AGENT_PACKAGE_EMPTY_PATH_LIST_ROW];
		}
		return paths.map((path) => `- \`${path}\``);
	}

	/** Responsibilities: _target import rows_. **/
	private test_target_rows(test_target_links: readonly TestTargetLink[]): string[] {
		if (test_target_links.length === 0) {
			return [AGENT_PACKAGE_EMPTY_PATH_LIST_ROW];
		}
		return test_target_links.map(
			(link) => `- \`${link.test_file}\` → ${link.production_files.map((path) => `\`${path}\``).join(", ")}`,
		);
	}

	/** Responsibilities: _task heading rows_. **/
	private package_heading_rows(
		package_number: number,
		snapshot_fingerprint: string,
		finding_count: number,
		file_count: number,
	): string[] {
		return [
			`# Agent task ${String(package_number).padStart(2, "0")}`,
			"",
			`Snapshot: \`${snapshot_fingerprint}\``,
			`Findings: ${finding_count}`,
			`Files counted toward --batch-size: ${file_count}`,
			"",
		];
	}

	/** Responsibilities: _package path sections_. **/
	private package_path_rows(
		owned_paths: readonly string[],
		production_paths: readonly string[],
		test_paths: readonly string[],
	): string[] {
		return [
			AGENT_PACKAGE_OWNED_PATHS_HEADING,
			"",
			...this.path_rows(owned_paths),
			"",
			AGENT_PACKAGE_PRODUCTION_PATHS_HEADING,
			"",
			...this.path_rows(production_paths),
			"",
			AGENT_PACKAGE_TEST_PATHS_HEADING,
			"",
			...this.path_rows(test_paths),
		];
	}

	/** Responsibilities: _package summary table_. **/
	private package_summary_rows(packages: readonly AgentWorkPackage[]): string[] {
		if (packages.length === 0) {
			return [AGENT_PACKAGE_NO_FINDINGS_MESSAGE];
		}
		const rows = [
			"| Package | Findings | Files counted | Production findings | Test findings | Production files | Test files |",
			"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
		];
		for (const agent_package of packages) {
			const production_findings = agent_package.violations.filter((violation) => {
				return !this._test_path_syntax.classify(violation.file()).has(TestPathKind.TestFile);
			}).length;
			const test_findings = agent_package.violations.length - production_findings;
			const package_name = `agent-${String(agent_package.number).padStart(2, "0")}.md`;
			rows.push(
				`| [${package_name}](${package_name}) | ${agent_package.violations.length} | ${agent_package.files.length} | ${production_findings} | ${test_findings} | ${agent_package.production_paths.length} | ${agent_package.test_paths.length} |`,
			);
		}
		return rows;
	}

	/** Responsibilities: _package summary heading_. **/
	private package_summary_heading(
		snapshot_fingerprint: string,
		requested_count: number,
		created_count: number,
	): string[] {
		return [
			AGENT_PACKAGE_SUMMARY_HEADING,
			"",
			`Snapshot: \`${snapshot_fingerprint}\``,
			`Requested packages: ${requested_count}`,
			`Created packages: ${created_count}`,
		];
	}

	/** Responsibilities: _package summary counts_. **/
	private package_summary_counts(request: AgentPackageSummaryCountsRequest): string[] {
		return [
			`Selected findings: ${request.selected_count}`,
			`Packaged findings: ${request.packaged_count}`,
			`Excluded from packages by capacity or linked constraints: ${request.excluded_count}`,
			`Deferred findings: ${request.deferred_count}`,
			`Suppressed findings: ${request.suppressed_count}`,
			`Unresolved partition constraints: ${request.unresolved_count}`,
		];
	}

	/** Responsibilities: _package context rows_. **/
	private package_context_rows(context: AgentPackageDocumentContext<AgentWorkPackage>): string[] {
		const { agent_package, snapshot_id } = context;
		return [
			...this.package_heading_rows(
				agent_package.number,
				snapshot_id,
				agent_package.violations.length,
				agent_package.files.length,
			),
			...this.package_path_rows(agent_package.path_scopes, agent_package.production_paths, agent_package.test_paths),
		];
	}

	/** Responsibilities: _package detail rows_. **/
	private package_detail_rows(request: AgentPackageDetailRequest<AgentWorkPackage>): string[] {
		const { agent_package } = request;
		const finding_rows = agent_package.violations.map((violation) => {
			return `- \`${violation.file()}:${violation.line()}\` (priority ${violation.priority()}, ${violation.rule_id()}): ${violation.message()}\n  Hint: ${violation.hint()}`;
		});
		return [
			AGENT_PACKAGE_TEST_TARGET_LINKS_HEADING,
			"",
			...this.test_target_rows(agent_package.test_target_links),
			"",
			AGENT_PACKAGE_FINDINGS_HEADING,
			"",
			...finding_rows,
			"",
			AGENT_PACKAGE_REQUIRED_CHECKS_HEADING,
			"",
			AGENT_PACKAGE_FOCUSED_CHECKS,
			AGENT_PACKAGE_PROJECT_CHECKS,
		];
	}

	/** Responsibilities: _Markdown renderer setup_. **/
	public constructor() {
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
	}

	/** Responsibilities: _package task document_. **/
	public package_markdown(agent_package: AgentWorkPackage, snapshot_id: string): string {
		const lines = [
			...this.package_context_rows({ agent_package, snapshot_id }),
			"",
			...this.package_detail_rows({ agent_package }),
		];
		return `${lines.join("\n")}\n`;
	}

	/** Responsibilities: _package snapshot identity_. **/
	public snapshot_id(violations: readonly ViolationContract[]): string {
		const records = violations
			.map((violation) => [
				violation.file().replaceAll("\\", "/"),
				violation.line(),
				violation.rule_id(),
				violation.priority(),
				violation.message(),
			])
			.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
		return createHash("sha256").update(JSON.stringify(records)).digest("hex").slice(0, 16);
	}

	/** Responsibilities: _summary document rendering_. **/
	public summary_markdown(request: AgentPackageSummaryRequest): string {
		const plan = request.plan;
		const packaged_count = plan.packages.reduce((total, agent_package) => total + agent_package.violations.length, 0);
		const lines = [
			...this.package_summary_heading(request.snapshot_id, plan.requested_count, plan.packages.length),
			...this.package_summary_counts({
				selected_count: request.selected_findings,
				packaged_count,
				excluded_count: plan.excluded_findings.length,
				deferred_count: request.deferred_findings,
				suppressed_count: request.suppressed_findings,
				unresolved_count: plan.unresolved_partition_constraints,
			}),
			"",
			...this.package_summary_rows(plan.packages),
		];
		return `${lines.join("\n")}\n`;
	}
}
