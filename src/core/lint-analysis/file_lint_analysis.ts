import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { TypeScriptRuleScope } from "src/core/lint-analysis/type_script_rule_scope";
import type { FileLintAnalysisOptions, FileLintRunOptions } from "src/core/types";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { FileLinter } from "src/linting/orchestration/runtime/file_linter";
import { FileViolationCollector } from "src/linting/orchestration/runtime/file_violation_collector";
import { ProjectTestTargetImportPaths } from "src/linting/orchestration/runtime/test-targets/project_test_target_import_paths";
import { TestFileViolationCollector } from "src/linting/orchestration/runtime/test-targets/test_file_violation_collector";
import type { FileLinterOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CodingRuleLinterContract, FileViolationCollectorContract } from "src/shared_services_protocols";

/** Responsibilities: _file rule execution_, _file rule dependency configuration_. **/
export class FileLintAnalysis {
	private readonly _options: FileLintAnalysisOptions;

	/** Responsibilities: _test-aware violation collection_. **/
	private violation_collector(): FileViolationCollectorContract {
		const { state, file_io, source_io } = this._options;
		const source_paths = state.context.files().map((record) => record.relative_path);
		const import_paths = new ProjectTestTargetImportPaths(state.repo_root, state.context);
		const test_violations = new TestFileViolationCollector(import_paths, source_paths);
		return new FileViolationCollector(test_violations, file_io, source_io);
	}

	/** Responsibilities: _ignore-file identity content_. **/
	private ignore_file_content(): string[] {
		const { state } = this._options;
		const source_io = state.context.source_io();
		const content: string[] = [];
		for (const path of state.ignore_files) {
			let identity = JSON.stringify([path, false, ""]);
			if (source_io.source_available(path)) {
				identity = JSON.stringify([path, true, source_io.source_text(path)]);
			}
			content.push(identity);
		}
		content.sort();
		return content;
	}

	/** Responsibilities: _file analysis identity_. **/
	private context_identity(): string {
		const { state, analysis_identity } = this._options;
		const files = [...state.inventory.files];
		files.sort();
		const entry_files = [...state.inventory.entry_files];
		entry_files.sort();
		const ignored_files = [...state.inventory.ignored_files];
		ignored_files.sort();
		const ignore_content = this.ignore_file_content();
		const has_typescript = state.inventory.files.some(
			(file) => state.context.source_record(file).language === TYPESCRIPT_LANGUAGE,
		);
		if (!has_typescript) {
			return this._options.context_identity;
		}
		return analysis_identity.content(
			JSON.stringify([this._options.context_identity, files, entry_files, ignored_files, ignore_content]),
		);
	}

	/** Responsibilities: _coding rule execution configuration_. **/
	private coding_rule_linter(): CodingRuleLinterContract {
		const { state } = this._options;
		return new CodingRuleLinter(
			new TypeScriptRuleScope(state.project_scope),
			state.repo_root,
			state.context.source_io(),
			state.names,
			!state.cache.virtual_project,
		);
	}

	/** Responsibilities: _file lint execution options_. **/
	private run_options(): FileLintRunOptions {
		const { state, stage_timer, analysis_identity } = this._options;
		return {
			files: state.inventory.files,
			repo_root: state.repo_root,
			names: {
				project_class_names: state.names.python_class_names,
				project_protocol_names: state.names.project_protocol_names,
				project_type_names: state.names.project_type_names,
				project_alias_names: state.names.project_alias_names,
			},
			context: state.context,
			ignored_files: state.inventory.ignored_files,
			analysis_identity,
			context_identity: this.context_identity(),
			timers: [stage_timer],
			coding_rule_linter: this.coding_rule_linter(),
			violation_collector: this.violation_collector(),
		};
	}

	/** Responsibilities: _file analysis initialization_. **/
	public constructor(options: FileLintAnalysisOptions) {
		this._options = options;
	}

	/** Responsibilities: _file-specific linter configuration_. **/
	public file_linter_options(): FileLinterOptions {
		const { state, analysis_identity, file_io } = this._options;
		return {
			repo_root: state.repo_root,
			project_names: {
				project_class_names: state.names.project_class_names,
				python_class_names: state.names.python_class_names,
				typescript_class_names: state.names.typescript_class_names,
				project_protocol_names: state.names.project_protocol_names,
				project_interface_names: state.names.project_interface_names,
				project_type_names: state.names.project_type_names,
				project_alias_names: state.names.project_alias_names,
				project_contract_names: state.names.project_contract_names,
				typescript_type_names: state.names.typescript_type_names,
				typescript_alias_names: state.names.typescript_alias_names,
			},
			context: state.context,
			ignored_files: state.inventory.ignored_files,
			analysis_identity,
			cache_enabled: !state.cache.virtual_project,
			file_io,
		};
	}

	/** Responsibilities: _file rule execution_. **/
	public collect(): ViolationContract[] {
		const options = this.run_options();
		const linter = new FileLinter(this.file_linter_options());
		return linter.lint_files(options);
	}
}
