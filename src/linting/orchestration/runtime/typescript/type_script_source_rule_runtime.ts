import { RULE_IDS } from "src/linting/constants";
import { AstPropertySourceIndexCache } from "src/model/ast/ast_property_source_index_cache";
import type { AstLanguage, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ProjectNames } from "src/project_analysis_types";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptRuleContext } from "src/rules/typescript/syntax-rules/ast/type_script_rule_context";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import { TypeScriptMixedModuleRule } from "src/type_script_mixed_module_rule";
import type { RuleContextContract, TypeScriptRuleScopeContract } from "src/types";
import type { TypeScriptSourceVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _file source selection_, _source rule context_, _source AST rule execution_. **/
export class TypeScriptSourceRuleRuntime implements TypeScriptRuleScopeContract {
	private readonly _source: LintSourceRecordData;
	private readonly _project_names: ProjectNames;
	private readonly _module_resolver: TypeScriptModuleResolverContract;

	/** Responsibilities: _source runtime initialization_. **/
	public constructor(
		source: LintSourceRecordData,
		project_names: ProjectNames,
		module_resolver: TypeScriptModuleResolverContract,
	) {
		this._source = source;
		this._project_names = project_names;
		this._module_resolver = module_resolver;
	}

	/** Responsibilities: _file scope classification_. **/
	public project_scope(): boolean {
		return false;
	}

	/** Responsibilities: _invalid project analysis access_. **/
	public project_analysis(): ProjectSourceAnalysisOptions {
		throw new Error("File-scoped TypeScript rule runtime has no project analysis.");
	}

	/** Responsibilities: _file source selection_. **/
	public source_files(language: AstLanguage): readonly LintSourceRecordData[] {
		if (this._source.language !== language) {
			return [];
		}
		return [this._source];
	}

	/** Responsibilities: _source rule context creation_. **/
	public context_for_source(
		violations: ViolationContract[],
		normalized_ast: NormalizedAstFile,
		stage_timer: LintStageTimerContract,
	): RuleContextContract {
		const source = this._source;
		return new TypeScriptRuleContext(violations, source.file_name.value(), source.typescript_ast.source_file_node(), {
			stage_timer,
			normalized_ast,
			project_names: this._project_names,
			rule_scope: this,
			source_resolver: source.source_resolver,
			module_exports: this._module_resolver,
			source_index: new AstPropertySourceIndexCache(),
			traversal: source.traversal,
		});
	}

	/** Responsibilities: _source AST rule traversal_. **/
	public append_source_file(context: RuleContextContract, stage_timer: LintStageTimerContract): void {
		const source = this._source;
		const registry = new ASTVerifierRegistry();
		const mixed_module_rule = new TypeScriptMixedModuleRule(new DiagnosticRule(RULE_IDS.mixed_module));
		registry.register(mixed_module_rule, [ts.SyntaxKind.SourceFile]);
		const verifier = registry.build(source.text);
		const verifier_request: TypeScriptSourceVerificationRequest = {
			source_root: source.typescript_ast.source_file_node(),
			context,
			stage_timer,
		};
		verifier.verify_source_file(verifier_request);
	}
}
