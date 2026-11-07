import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { ProjectTestTargetImportPaths } from "src/linting/orchestration/runtime/test-targets/project_test_target_import_paths";
import { TestFileViolationCollector } from "src/linting/orchestration/runtime/test-targets/test_file_violation_collector";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { DirectoryRules } from "src/rules/support/directory_rules";
import type {
	DirectoryRuleContext,
	ProjectViolationsByFile,
	TypeScriptProjectTestRules,
} from "src/rules/typescript/syntax-rules/types";
import type { TestFileViolationCollectorContract } from "src/testing_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _project test policy_, _directory structure policy_. **/
export class TypeScriptProjectFileRules {
	private readonly _test_rule_cache: WeakMap<ProjectSourceAnalysisOptions, TypeScriptProjectTestRules>;
	private readonly _directory_rule_cache: WeakMap<ProjectSourceAnalysisOptions, ProjectViolationsByFile>;

	/** Responsibilities: _project test rule preparation_. **/
	private test_rules(scope: ProjectSourceAnalysisOptions): TypeScriptProjectTestRules {
		const cached = this._test_rule_cache.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const sources = new Map(scope.context.files().map((source) => [source.relative_path, source] as const));
		const collector: TestFileViolationCollectorContract = new TestFileViolationCollector(
			new ProjectTestTargetImportPaths(scope.root, scope.context),
			[...sources.keys()],
		);
		const prepared = { collector, sources };
		this._test_rule_cache.set(scope, prepared);
		return prepared;
	}

	/** Responsibilities: _directory violation grouping_. **/
	private directory_rule_group(directory_context: DirectoryRuleContext): ProjectViolationsByFile {
		const { analysis, files, owner } = directory_context;
		const sources = files.map((path) => [path, analysis.context.source_record(path)] as const);
		const rules = new DirectoryRules(analysis.file_io, analysis.context.source_io());
		const violations = rules.collect_directory_violations(
			files,
			analysis.root,
			new Map(sources.map(([path, source]) => [path, source.normalized_ast.source.classes] as const)),
			new Map(sources.map(([path, source]) => [path, source.normalized_ast] as const)),
			analysis.directory_files,
		);
		return new Map([[owner.relative_path, violations]]);
	}

	/** Responsibilities: _directory violation selection_. **/
	private collect_directory_violations(rule_scope: ProjectSourceAnalysisOptions): ProjectViolationsByFile {
		const selected_files = new Set(rule_scope.directory_files.files);
		const owner = rule_scope.context.files().find((candidate) => {
			if (candidate.language !== TYPESCRIPT_LANGUAGE || !selected_files.has(candidate.absolute_path)) {
				return false;
			}
			return !rule_scope.ignored_files.has(candidate.absolute_path);
		});
		if (owner === undefined) {
			return new Map();
		}
		const files = rule_scope.directory_files.files.filter((path) => !rule_scope.ignored_files.has(path));
		return this.directory_rule_group({ analysis: rule_scope, owner, files });
	}

	/** Responsibilities: _directory violation cache_. **/
	private directory_violations(cache_scope: ProjectSourceAnalysisOptions): ProjectViolationsByFile {
		const cached = this._directory_rule_cache.get(cache_scope);
		if (cached !== undefined) {
			return cached;
		}
		const grouped = this.collect_directory_violations(cache_scope);
		this._directory_rule_cache.set(cache_scope, grouped);
		return grouped;
	}

	/** Responsibilities: _project test rule initialization_. **/
	public constructor() {
		this._test_rule_cache = new WeakMap();
		this._directory_rule_cache = new WeakMap();
	}

	/** Responsibilities: _directory structure policy_. **/
	public append_directory_rules(
		request: TypeScriptNodeVerificationRequest,
		analysis: ProjectSourceAnalysisOptions,
	): void {
		const file = request.context.state().source.file;
		const violations = this.directory_violations(analysis).get(file);
		if (violations === undefined) {
			return;
		}
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}

	/** Responsibilities: _project test target reporting_. **/
	public append_test_rules(request: TypeScriptNodeVerificationRequest, scope: ProjectSourceAnalysisOptions): void {
		const file = request.context.state().source.file;
		const prepared = this.test_rules(scope);
		const source = prepared.sources.get(file);
		if (source === undefined) {
			return;
		}
		const violations: ViolationContract[] = [];
		prepared.collector.append(violations, source, file, scope.root);
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}
}
