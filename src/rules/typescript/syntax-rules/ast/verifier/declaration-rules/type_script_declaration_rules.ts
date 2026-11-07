import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { MODULE_INTERFACE_KIND } from "src/constants";
import type { AstClassNode, NamedLine } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { DeclarationNames } from "src/rules/declaration_names";
import { StructuralFieldRules } from "src/rules/structural_field_rules";
import type { ClassLineMap, TypeScriptClassDeclarationAnalysis } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextState } from "src/types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _declaration naming diagnostics_, _contract field diagnostics_. **/
export class TypeScriptDeclarationRules implements ASTSourceRuleContract {
	private readonly _classes_by_line: WeakMap<ts.SourceFile, ClassLineMap>;

	/** Responsibilities: _class declaration index_. **/
	private classes_by_line(source_file: ts.SourceFile, class_nodes: readonly AstClassNode[]): ClassLineMap {
		const cached = this._classes_by_line.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const classes_by_line = new Map<number, AstClassNode[]>();
		for (const item of class_nodes) {
			const classes = classes_by_line.get(item.identity.start);
			if (classes === undefined) {
				classes_by_line.set(item.identity.start, [item]);
			} else {
				classes.push(item);
			}
		}
		this._classes_by_line.set(source_file, classes_by_line);
		return classes_by_line;
	}

	/** Responsibilities: _class declaration matching_. **/
	private class_declaration(
		class_request: TypeScriptNodeVerificationRequest,
		state: RuleContextState,
		classes_by_line: ClassLineMap,
	): void {
		const { node } = class_request;
		const { source_file } = state.source;
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		const declarations = classes_by_line.get(line);
		if (declarations === undefined) {
			return;
		}
		for (const declaration of declarations) {
			if (!this.matches_declaration(node, declaration)) {
				continue;
			}
			const class_analysis: TypeScriptClassDeclarationAnalysis = { request: class_request, state, declaration };
			this.append_violations(class_request.context, this.class_violations(class_analysis));
			return;
		}
	}

	/** Responsibilities: _class declaration identity matching_. **/
	private matches_declaration(node: ts.Node, declaration: AstClassNode): boolean {
		if (ts.isClassLike(node)) {
			if (node.name === undefined) {
				return true;
			}
			return declaration.identity.name === node.name.text;
		}
		if (ts.isInterfaceDeclaration(node)) {
			return declaration.identity.name === node.name.text;
		}
		return false;
	}

	/** Responsibilities: _class declaration resolution_. **/
	private append_class_declaration(request: TypeScriptNodeVerificationRequest): void {
		const state = request.context.state();
		const { source_file, normalized_ast } = state.source;
		const classes_by_line = this.classes_by_line(source_file, normalized_ast.source.classes);
		this.class_declaration(request, state, classes_by_line);
	}

	/** Responsibilities: _class declaration diagnostics_. **/
	private class_violations(class_analysis: TypeScriptClassDeclarationAnalysis): ViolationContract[] {
		const { request, state, declaration } = class_analysis;
		const names = new DeclarationNames(state.source.file, [declaration]);
		const violations: ViolationContract[] = [];
		names.append(violations);
		if (ts.isInterfaceDeclaration(request.node) && declaration.classification.type_contract) {
			const reporter = new StructuralFieldRules(state.source.file, [], MODULE_INTERFACE_KIND);
			for (const field of declaration.field_analysis.fields) {
				reporter.append_field(violations, state.source.file, declaration, field, MODULE_INTERFACE_KIND);
			}
		}
		return violations;
	}

	/** Responsibilities: _declaration violations_. **/
	private append_violations(violation_context: RuleContextContract, violations: readonly ViolationContract[]): void {
		for (const violation of violations) {
			violation_context.append_violation(violation);
		}
	}

	/** Responsibilities: _type alias naming_. **/
	private append_type_name(type_request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isTypeAliasDeclaration(type_request.node)) {
			return;
		}
		const state = type_request.context.state();
		const line = state.source.source_file.getLineAndCharacterOfPosition(type_request.node.getStart()).line;
		const declaration: NamedLine = { name: type_request.node.name.text, line };
		const names = new DeclarationNames(state.source.file, [], [declaration]);
		const violations: ViolationContract[] = [];
		names.append(violations);
		this.append_violations(type_request.context, violations);
	}

	/** Responsibilities: _declaration verifier initialization_. **/
	public constructor() {
		this._classes_by_line = new WeakMap();
	}

	/** Responsibilities: _declaration rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _declaration node dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (ts.isClassDeclaration(request.node) || ts.isInterfaceDeclaration(request.node)) {
			this.append_class_declaration(request);
			return;
		}
		if (ts.isTypeAliasDeclaration(request.node)) {
			this.append_type_name(request);
		}
	}
}
