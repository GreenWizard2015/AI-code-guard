import { DuplicateTypeShapes } from "src/duplicate_type_shapes";
import { PythonCodingRuleSourceAnalysis } from "src/linting/orchestration/runtime/python/coding_rules/python_coding_rule_source_analysis";
import { TypeScriptCodingRules } from "src/linting/orchestration/runtime/typescript/type_script_coding_rules";
import { Syntax } from "src/parser/analysis/syntax";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

import {
	RESPONSIBILITY_ACTION_EXTENSIONS,
	RESPONSIBILITY_ACTION_WORDS,
	RESPONSIBILITY_CONDITION_WORDS,
	RESPONSIBILITY_NOUN_WORDS,
	TEST_PATH_SUFFIXES,
} from "src/constants";
import { CodingRuleSourceServicesCache } from "src/linting/orchestration/runtime/coding_rule_source_services_cache";
import type { ViolationContract } from "src/reporting_protocols";
import { ResponsibilityRules } from "src/rules/architecture/responsibility_rules";
import { ResponsibilityWording } from "src/rules/architecture/responsibility_wording";
import { TypeScriptRuleContext } from "src/rules/typescript/syntax-rules/ast/type_script_rule_context";
import type { SyntaxContract } from "src/shared_services_protocols";
import type { SourceFileAstContract } from "src/source_protocols";
import type { CodingRuleSourceData } from "src/source_types";
import type ts from "typescript";

import type { ProjectNames } from "src/project_analysis_types";
import type { CodingRuleLinterContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { TypeScriptRuleScopeContract } from "src/types";
import type { TypeScriptSourceVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _coding rule collection_, _responsibility violation collection_. **/
export class CodingRuleLinter implements CodingRuleLinterContract {
	private readonly _duplicate_type_shapes: DuplicateTypeShapes;
	private readonly _test_path_syntax: TestPathSyntax;
	private readonly _syntax: SyntaxContract;
	private readonly _responsibility_rules: ResponsibilityRules;
	private readonly _typescript_coding_rules: TypeScriptCodingRules;
	private readonly _source_services_cache: CodingRuleSourceServicesCache;
	private readonly _project_names: ProjectNames;
	private readonly _rule_scope: TypeScriptRuleScopeContract;

	/** Responsibilities: _TypeScript rules_. **/
	private append_typescript_rules(
		violations: ViolationContract[],
		source: CodingRuleSourceData,
		source_file: ts.SourceFile,
		stage_timer: LintStageTimerContract,
	): void {
		const services = this._source_services_cache.for_resolver(source.source_resolver);
		const node_rules = services.node_rules.build(source.text);
		const context = new TypeScriptRuleContext(violations, source.file, source_file, {
			stage_timer,
			normalized_ast: source.normalized_ast,
			project_names: this._project_names,
			rule_scope: this._rule_scope,
			source_resolver: source.source_resolver,
			module_exports: services.module_exports,
			source_index: services.source_index,
			traversal: source.traversal,
		});
		const verifier_request: TypeScriptSourceVerificationRequest = { source_root: source_file, context, stage_timer };
		stage_timer.measure("file-analysis.typescript.post-remaining.coding-rules.ast-rules", () =>
			node_rules.verify_source_file(verifier_request),
		);
		if (this._syntax.syntax_issues(source_file).length > 0) {
			this._typescript_coding_rules.append_recovered_rules(violations, source.file, source.text);
		}
	}

	/** Responsibilities: _Python rule collector initialization_. **/
	public constructor(
		rule_scope: TypeScriptRuleScopeContract,
		project_root: string,
		source_io: ProjectSourceIOContract,
		project_names: ProjectNames,
		filesystem_fallback = true,
	) {
		this._syntax = new Syntax();
		this._responsibility_rules = new ResponsibilityRules(
			new ResponsibilityWording(
				new Set([...RESPONSIBILITY_ACTION_WORDS, ...RESPONSIBILITY_ACTION_EXTENSIONS]),
				RESPONSIBILITY_CONDITION_WORDS,
				RESPONSIBILITY_NOUN_WORDS,
			),
		);
		this._project_names = project_names;
		this._rule_scope = rule_scope;
		this._typescript_coding_rules = new TypeScriptCodingRules(this._syntax, this._project_names);
		this._duplicate_type_shapes = new DuplicateTypeShapes();
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._source_services_cache = new CodingRuleSourceServicesCache(project_root, filesystem_fallback, source_io);
	}

	/** Responsibilities: _Python source rule violations_. **/
	public lint_python(source_ast: SourceFileAstContract): ViolationContract[] {
		const prepared_source = source_ast.snapshot();
		const responsibilities = this._responsibility_rules.collect(
			prepared_source.file,
			prepared_source.normalized_ast.module_declarations.responsibility_targets,
		);
		const analysis = new PythonCodingRuleSourceAnalysis(
			prepared_source,
			this._duplicate_type_shapes,
			this._test_path_syntax,
		);
		const is_test_file = this._test_path_syntax.classify(prepared_source.file).has(TestPathKind.TestFile);
		return [...responsibilities, ...analysis.python_issues(is_test_file)];
	}

	/** Responsibilities: _TypeScript source rule violations_. **/
	public lint_typescript(source_ast: SourceFileAstContract, stage_timer: LintStageTimerContract): ViolationContract[] {
		const prepared_source = source_ast.snapshot();
		if (prepared_source.file.endsWith(".py")) {
			return this._responsibility_rules.collect(
				prepared_source.file,
				prepared_source.normalized_ast.module_declarations.responsibility_targets,
			);
		}
		const violations: ViolationContract[] = [];
		this.append_typescript_rules(violations, prepared_source, prepared_source.source_file, stage_timer);
		return violations;
	}
}
