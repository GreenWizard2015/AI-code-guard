import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { UPPER_SNAKE_CASE_PATTERN } from "src/rules/constants";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _module constant naming_, _module variable prohibition_. **/
export class TypeScriptModuleDeclarationNaming implements ASTSourceRuleContract {
	/** Responsibilities: _module-level declaration check_. **/
	private module_declaration(node: ts.VariableDeclaration): boolean {
		const declaration_list = node.parent;
		if (!ts.isVariableDeclarationList(declaration_list)) {
			return false;
		}
		const statement = declaration_list.parent;
		return ts.isVariableStatement(statement) && ts.isSourceFile(statement.parent);
	}

	/** Responsibilities: _binding name collection_. **/
	private append_binding_names(name: ts.BindingName, context: RuleContextContract, constant: boolean): void {
		if (ts.isIdentifier(name)) {
			this.append_binding_name(name, context, constant);
			return;
		}
		for (const element of name.elements) {
			if (!ts.isOmittedExpression(element)) {
				this.append_binding_names(element.name, context, constant);
			}
		}
	}

	/** Responsibilities: _single module binding naming_. **/
	private append_binding_name(name: ts.Identifier, context: RuleContextContract, constant: boolean): void {
		if (constant) {
			if (UPPER_SNAKE_CASE_PATTERN.test(name.text) || name.text.startsWith("_")) {
				return;
			}
			context.for_node(name).append_parameterized_rule(RULE_IDS.typescript_module_constant_case, { name: name.text });
			return;
		}
		context.for_node(name).append_parameterized_rule(RULE_IDS.typescript_module_variable, { name: name.text });
	}

	/** Responsibilities: _module naming activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.includes("const") || source_code.includes("let") || source_code.includes("var");
	}

	/** Responsibilities: _module variable node verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (!ts.isVariableDeclaration(node) || !this.module_declaration(node)) {
			return;
		}
		const declaration_list = node.parent;
		if (!ts.isVariableDeclarationList(declaration_list)) {
			return;
		}
		const constant = (declaration_list.flags & ts.NodeFlags.Const) !== 0;
		this.append_binding_names(node.name, context, constant);
	}
}
