import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { ProjectTestTargetImportPaths } from "src/linting/project_test_target_import_paths";
import { TestFileViolationCollector } from "src/linting/test_file_violation_collector";
import type { ProjectSourceAnalysisOptionsContract } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { DirectoryRules } from "src/rules/directory_rules";
import { TypeScriptProjectRuleResultCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_result_cache";
import type {
	DirectoryRuleContext,
	ProjectViolationsByFile,
	TypeScriptProjectTestRules,
} from "src/rules/typescript/syntax-rules/types";
import type { TestFileViolationCollectorContract } from "src/testing_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _project test policy_, _directory structure policy_. **/
export class TypeScriptProjectFileRules {
	private readonly _test_rule_cache: WeakMap<ProjectSourceAnalysisOptionsContract, TypeScriptProjectTestRules>;
	private readonly _directory_rule_cache: TypeScriptProjectRuleResultCache;

	/** Responsibilities: _project test rule preparation_. **/
	private test_rules(scope: ProjectSourceAnalysisOptionsContract): TypeScriptProjectTestRules {
		const cached = this._test_rule_cache.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const sources = new Map(
			scope
				.context()
				.files()
				.map((source) => [source.relative_path, source] as const),
		);
		const source_paths = [...sources.keys()];
		const collector: TestFileViolationCollectorContract = new TestFileViolationCollector(
			new ProjectTestTargetImportPaths(scope.root(), scope.context()),
			source_paths,
		);
		const prepared = { collector, sources };
		this._test_rule_cache.set(scope, prepared);
		return prepared;
	}

	/** Responsibilities: _directory violation grouping_. **/
	private directory_rule_group(directory_context: DirectoryRuleContext): ProjectViolationsByFile {
		const { analysis, files, owner } = directory_context;
		const sources = files.map((path) => [path, analysis.context().source_record(path)] as const);
		const rules = new DirectoryRules(analysis.file_io(), analysis.context().source_io());
		const violations = rules.collect_directory_violations(
			files,
			analysis.root(),
			new Map(sources.map(([path, source]) => [path, source.normalized_ast.source.classes] as const)),
			new Map(sources.map(([path, source]) => [path, source.normalized_ast] as const)),
			analysis.directory_files(),
		);
		return new Map([[owner.relative_path, violations]]);
	}

	/** Responsibilities: _directory violation selection_. **/
	private collect_directory_violations(rule_scope: ProjectSourceAnalysisOptionsContract): ProjectViolationsByFile {
		const selected_files = new Set(rule_scope.directory_files().files);
		const owner = rule_scope
			.context()
			.files()
			.find((candidate) => {
				if (candidate.language !== TYPESCRIPT_LANGUAGE || !selected_files.has(candidate.absolute_path)) {
					return false;
				}
				return !rule_scope.ignored_files().has(candidate.absolute_path);
			});
		if (owner === undefined) {
			return new Map();
		}
		const files = rule_scope.directory_files().files.filter((path) => !rule_scope.ignored_files().has(path));
		return this.directory_rule_group({ analysis: rule_scope, owner, files });
	}

	/** Responsibilities: _project test rule initialization_. **/
	public constructor() {
		this._test_rule_cache = new WeakMap();
		this._directory_rule_cache = new TypeScriptProjectRuleResultCache();
	}

	/** Responsibilities: _directory structure policy_. **/
	public append_directory_rules(
		request: TypeScriptNodeVerificationRequest,
		analysis: ProjectSourceAnalysisOptionsContract,
	): void {
		const file = request.context.state().source.file;
		const violations = this._directory_rule_cache
			.grouped(analysis, TypeScriptProjectFileRules.name, () => this.collect_directory_violations(analysis))
			.get(file);
		if (violations === undefined) {
			return;
		}
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}

	/** Responsibilities: _project test target reporting_. **/
	public append_test_rules(
		request: TypeScriptNodeVerificationRequest,
		scope: ProjectSourceAnalysisOptionsContract,
	): void {
		const file = request.context.state().source.file;
		const prepared = this.test_rules(scope);
		const source = prepared.sources.get(file);
		if (source === undefined) {
			return;
		}
		const violations: ViolationContract[] = [];
		prepared.collector.append(violations, source, file, scope.root(), request.context.state().analysis.stage_timer);
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}
}
