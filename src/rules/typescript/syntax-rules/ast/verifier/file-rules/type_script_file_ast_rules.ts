import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { DuplicateTypeShapes } from "src/duplicate_type_shapes";
import { RULE_IDS } from "src/linting/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptFileDeclarationRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_declaration_rules";
import { TypeScriptFileSemanticRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_semantic_rules";
import { TypeScriptFileTextRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_text_rules";
import { TypeScriptProjectFileRules } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_file_rules";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _source file analysis_, _project file analysis_. **/
export class TypeScriptFileAstRules implements ASTSourceRuleContract {
	private readonly _text_rules: TypeScriptFileTextRules;
	private readonly _declaration_rules: TypeScriptFileDeclarationRules;
	private readonly _semantic_rules: TypeScriptFileSemanticRules;
	private readonly _project_rules: TypeScriptProjectFileRules;

	/** Responsibilities: _duplicate type shape reporting_. **/
	private append_type_shapes(
		file: string,
		source_file: ts.SourceFile,
		stage_timer: LintStageTimerContract,
		context: RuleContextContract,
	): void {
		stage_timer.measure(`rule.${RULE_IDS.duplicate_type_shape}.typescript`, () => {
			const shape_analyzer = new DuplicateTypeShapes();
			const duplicates = shape_analyzer.typescript(source_file);
			const rule = new DiagnosticRule(RULE_IDS.duplicate_type_shape);
			for (const duplicate of duplicates) {
				context.append_violation(rule.violation(file, duplicate.line, { names: duplicate.names.join(", ") }));
			}
		});
	}

	/** Responsibilities: _project file rule dispatch_. **/
	private append_project_rules(context: RuleContextContract, node: ts.SourceFile): void {
		const rule_scope = context.state().project.rule_scope;
		if (!rule_scope.project_scope()) {
			return;
		}
		const project_analysis = rule_scope.project_analysis();
		const request = { context, node };
		this._project_rules.append_test_rules(request, project_analysis);
		this._project_rules.append_directory_rules(request, project_analysis);
	}

	/** Responsibilities: _source file rule dispatch_. **/
	private append_source_rules(request: TypeScriptNodeVerificationRequest): void {
		this._text_rules.append_text_rules(request);
		this._text_rules.append_test_path(request);
		this._declaration_rules.append_class_filename(request);
		this._declaration_rules.append_module_declarations(request);
		this._semantic_rules.append(request);
		this._semantic_rules.append_responsibilities(request);
	}

	/** Responsibilities: _file rule initialization_. **/
	public constructor() {
		this._text_rules = new TypeScriptFileTextRules();
		this._declaration_rules = new TypeScriptFileDeclarationRules();
		this._semantic_rules = new TypeScriptFileSemanticRules();
		this._project_rules = new TypeScriptProjectFileRules();
	}

	/** Responsibilities: _file rule activation_. **/
	public active_for(): boolean {
		return true;
	}

	/** Responsibilities: _file rule dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isSourceFile(request.node)) {
			return;
		}
		this.append_source_rules(request);
		this.append_project_rules(request.context, request.node);
		const {
			source: { file, source_file },
			analysis: { stage_timer },
		} = request.context.state();
		this.append_type_shapes(file, source_file, stage_timer, request.context);
	}
}
