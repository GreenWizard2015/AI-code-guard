import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { CALLABLE_TYPE_NAME } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import type {
	TypeScriptFunctionTypeRuleRequest,
	TypeScriptNodeVerificationRequest,
} from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _callable type contracts_, _nested generic diagnostics_. **/
export class ASTTypeRules implements ASTSourceRuleContract {
	/** Responsibilities: _nested generic detection_. **/
	private contains_nested_generic(type_node: ts.TypeNode): boolean {
		let nested = false;
		const visit = (node: ts.Node): void => {
			if (ts.isTypeReferenceNode(node) && node.typeArguments !== undefined) {
				nested = true;
				for (const argument of node.typeArguments) {
					argument.forEachChild(visit);
				}
				return;
			}
			node.forEachChild(visit);
		};
		type_node.forEachChild(visit);
		return nested;
	}

	/** Responsibilities: _function type owner_. **/
	private function_type_owner(node: ts.FunctionTypeNode): ts.Node {
		let owner = node.parent;
		while (ts.isParenthesizedTypeNode(owner)) {
			owner = owner.parent;
		}
		return owner;
	}

	/** Responsibilities: _function type rule input_. **/
	/** Responsibilities: _callback contract size diagnosis_. **/
	private append_callback_size(request: TypeScriptFunctionTypeRuleRequest): void {
		const { node, owner, context } = request;
		if (node.parameters.length <= 3) {
			return;
		}
		let name = "callback";
		if (ts.isTypeAliasDeclaration(owner)) {
			name = owner.name.text;
		} else if (ts.isPropertySignature(owner) || ts.isPropertyDeclaration(owner)) {
			name = owner.name.getText(owner.getSourceFile());
		} else {
			return;
		}
		context.for_node(node).append_parameterized_rule(RULE_IDS.callback_contract_size, {
			name,
			count: String(node.parameters.length),
		});
	}

	/** Responsibilities: _nested generic diagnosis_. **/
	private append_nested_generic(node: ts.TypeReferenceNode, request: TypeScriptNodeVerificationRequest): void {
		if (node.typeArguments === undefined || !this.contains_nested_generic(node)) {
			return;
		}
		let parent = node.parent;
		while (ts.isParenthesizedTypeNode(parent)) {
			parent = parent.parent;
		}
		if (ts.isTypeReferenceNode(parent) && parent.typeArguments !== undefined) {
			return;
		}
		request.context.for_node(node).append_rule(RULE_IDS.nested_generic_type);
	}

	/** Responsibilities: _type rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _type node verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		const timer = context.state().analysis.stage_timer;
		if (ts.isFunctionTypeNode(node)) {
			const owner = this.function_type_owner(node);
			const function_request: TypeScriptFunctionTypeRuleRequest = {
				node,
				owner,
				context,
				callable_alias: ts.isTypeAliasDeclaration(owner) && owner.name.text.startsWith(CALLABLE_TYPE_NAME),
			};
			context.state().analysis.stage_timer.measure("rule.callable-type-alias.typescript", () => {
				if (!function_request.callable_alias) {
					context.for_node(node).append_rule(RULE_IDS.callable_type_alias);
				}
			});
			timer.measure(`rule.${RULE_IDS.callback_contract_size}`, () => this.append_callback_size(function_request));
		}
		if (ts.isTypeReferenceNode(node)) {
			timer.measure(`rule.${RULE_IDS.nested_generic_type}`, () => this.append_nested_generic(node, request));
		}
	}
}
