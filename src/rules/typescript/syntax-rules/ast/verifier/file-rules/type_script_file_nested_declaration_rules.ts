import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { CallableAstScopePredicate, NestedDeclarationLines } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _nested class placement_, _nested type placement_. **/
export class TypeScriptFileNestedDeclarationRules implements ASTSourceRuleContract {
	private readonly _class_scope_checks: readonly CallableAstScopePredicate[];
	private readonly _type_scope_checks: readonly CallableAstScopePredicate[];
	private readonly _class_declaration_checks: readonly CallableAstScopePredicate[];
	private readonly _type_declaration_checks: readonly CallableAstScopePredicate[];
	private readonly _nested_class_rule: DiagnosticRuleContract;
	private readonly _nested_type_rule: DiagnosticRuleContract;
	private readonly _nested_lines: WeakMap<RuleContextContract, NestedDeclarationLines>;

	/** Responsibilities: _declaration ancestor scope lookup_. **/
	private has_ancestor_scope(node: ts.Node, checks: readonly CallableAstScopePredicate[]): boolean {
		let ancestor = node.parent;
		while (ancestor !== undefined && !ts.isSourceFile(ancestor)) {
			if (checks.some((check) => check(ancestor))) {
				return true;
			}
			ancestor = ancestor.parent;
		}
		return false;
	}

	/** Responsibilities: _nested declaration diagnostics_. **/
	private append_diagnostics(context: RuleContextContract, file: string, lines: NestedDeclarationLines): void {
		const first_nested_class = lines.classes.at(0);
		if (first_nested_class !== undefined) {
			context.append_violation(
				this._nested_class_rule.violation(file, first_nested_class, { count: String(lines.classes.length) }),
			);
		}
		const first_nested_type = lines.types.at(0);
		if (first_nested_type !== undefined) {
			context.append_violation(
				this._nested_type_rule.violation(file, first_nested_type, { count: String(lines.types.length) }),
			);
		}
	}

	/** Responsibilities: _nested declaration rule configuration_. **/
	public constructor() {
		this._class_scope_checks = [
			ts.isClassLike,
			ts.isFunctionLike,
			ts.isBlock,
			ts.isObjectLiteralExpression,
			ts.isArrayLiteralExpression,
			ts.isPropertyAssignment,
			ts.isConditionalExpression,
			(node) => node.kind === ts.SyntaxKind.CaseBlock,
		];
		this._type_scope_checks = [
			ts.isFunctionLike,
			ts.isClassLike,
			ts.isModuleBlock,
			ts.isBlock,
			ts.isObjectLiteralExpression,
			ts.isArrayLiteralExpression,
			(node) => node.kind === ts.SyntaxKind.CaseBlock,
		];
		this._class_declaration_checks = [ts.isClassDeclaration, ts.isClassExpression];
		this._type_declaration_checks = [ts.isTypeAliasDeclaration, ts.isInterfaceDeclaration, ts.isEnumDeclaration];
		this._nested_class_rule = new DiagnosticRule("nested-class");
		this._nested_type_rule = new DiagnosticRule("nested-type");
		this._nested_lines = new WeakMap();
	}

	/** Responsibilities: _nested declaration rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _nested declaration node collection_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { context, node } = request;
		let lines = this._nested_lines.get(context);
		if (lines === undefined) {
			lines = { classes: [], types: [] };
			this._nested_lines.set(context, lines);
		}
		const { source_file } = context.state().source;
		if (this._class_declaration_checks.some((check) => check(node))) {
			if (this.has_ancestor_scope(node, this._class_scope_checks)) {
				lines.classes.push(source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1);
			}
		}
		if (this._type_declaration_checks.some((check) => check(node))) {
			if (this.has_ancestor_scope(node, this._type_scope_checks)) {
				lines.types.push(source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1);
			}
		}
	}

	/** Responsibilities: _nested declaration reporting_. **/
	public finish_source(request: TypeScriptSourceVerificationRequest): void {
		const { context } = request;
		const lines = this._nested_lines.get(context);
		this._nested_lines.delete(context);
		if (lines === undefined) {
			return;
		}
		this.append_diagnostics(context, context.state().source.file, lines);
	}
}
