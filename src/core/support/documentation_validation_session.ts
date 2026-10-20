import { relative, resolve } from "node:path";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import type {
	DocumentationExampleLintContract,
	DocumentationValidationOperation,
} from "documentation_validation/types";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintExecutionReport } from "src/runtime_types";
import { RULE_DATA } from "src/constants";
import { UnusedCode } from "src/core/project-source/unused_code";
import { DOCUMENTATION_PROJECT_ANALYSIS_RULES } from "documentation_validation/constants";
import type { DocumentationExampleSourceFile } from "documentation_validation/types";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";

/** Responsibilities: _documentation validation lifecycle_, _rule catalog synchronization_. **/
export class DocumentationValidationSession implements DocumentationExampleLintContract {
	private readonly configuration: LintRunConfiguration;
	private readonly unused_code: UnusedCode;

	/** Responsibilities: _example source path mapping_. **/
	private source_texts(
		absolute_files: readonly string[],
		source_files: readonly DocumentationExampleSourceFile[],
	): Map<string, string> {
		const texts = new Map<string, string>();
		for (const [index, source_file] of source_files.entries()) {
			const path = absolute_files[index];
			if (path === undefined) {
				throw new Error("Documentation source path mapping is incomplete.");
			}
			texts.set(path, source_file.text);
		}
		return texts;
	}

	/** Responsibilities: _documentation source validation_. **/
	private validate_source_paths(
		absolute_files: readonly string[],
		absolute_source_path: string,
		source_path: string,
	): void {
		if (!absolute_files.includes(absolute_source_path)) {
			throw new Error(`Documentation example source was not discovered: ${source_path}`);
		}
		const unique_files = new Set(absolute_files);
		if (unique_files.size !== absolute_files.length) {
			throw new Error("Documentation example contains duplicate source paths.");
		}
	}

	/** Responsibilities: _documentation project diagnostics_. **/
	private project_violations(repo_root: string, execution: LintExecutionReport): ViolationContract[] {
		const target_files = new Set(execution.report.files.map((file) => relative(repo_root, file)));
		const project_violations = this.unused_code.collect_unused_files(repo_root, {
			context_state: { available: true, value: execution.context },
			entry_files: [],
		});
		return project_violations.filter((violation) => target_files.has(violation.file));
	}

	/** Responsibilities: _virtual project execution_. **/
	private execute_example(
		repo_root: string,
		absolute_files: readonly string[],
		source_texts: ReadonlyMap<string, string>,
	): LintExecutionReport {
		const inputs = {
			files: [...absolute_files],
			project_files: [...absolute_files],
			ignored_files: [],
			markdown_files: [],
			ignore_files: [],
		};
		return this.configuration.lint_report(
			{
				repo_root,
				ignored_directories: [],
				stage_timer: new LintStageTimer(),
				inputs,
				source_texts,
				entry_files: [],
			},
			LintReportMode.IN_MEMORY_PROJECT,
		);
	}

	/** Responsibilities: _rule-specific project diagnostics_. **/
	private example_violations(rule_id: string, repo_root: string, execution: LintExecutionReport): ViolationContract[] {
		if (!DOCUMENTATION_PROJECT_ANALYSIS_RULES.has(rule_id)) {
			return execution.report.violations;
		}
		return [...execution.report.violations, ...this.project_violations(repo_root, execution)];
	}

	/** Responsibilities: _lint configuration ownership_. **/
	public constructor() {
		this.configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO());
		this.unused_code = new UnusedCode();
	}

	/** Responsibilities: _documentation example diagnostics_. **/
	public lint(
		repo_root: string,
		source_path: string,
		rule_id: string,
		source_files: readonly DocumentationExampleSourceFile[],
	): readonly ViolationContract[] {
		const absolute_files = source_files.map((source_file) => resolve(repo_root, source_file.path));
		const absolute_source_path = resolve(repo_root, source_path);
		this.validate_source_paths(absolute_files, absolute_source_path, source_path);
		const source_texts = this.source_texts(absolute_files, source_files);
		const execution = this.execute_example(repo_root, absolute_files, source_texts);
		return this.example_violations(rule_id, repo_root, execution);
	}

	/** Responsibilities: _rule catalog synchronization_. **/
	public rule_ids(): readonly string[] {
		return Object.keys(RULE_DATA);
	}

	/** Responsibilities: _validation session lifecycle_. **/
	public with_worker<T>(operation: DocumentationValidationOperation<T>): T {
		try {
			return operation();
		} finally {
			this.configuration.python_ast_worker.close();
		}
	}
}
