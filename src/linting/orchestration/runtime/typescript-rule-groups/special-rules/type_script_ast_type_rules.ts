import { RULES_BY_ID } from "src/model/constants";
import ts from "typescript";
import type { RuleContract, ViolationContract } from "src/protocols";
import type { TypeScriptAstTypeRulesContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _nested generic detection_, _callback contract diagnostics_. **/
export class TypeScriptAstTypeRules implements TypeScriptAstTypeRulesContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly maximum_callback_parameters = 3;

	/** Responsibilities: _callback contract name_. **/
	private callback_contract_name(node: ts.FunctionTypeNode): string {
		const parent = node.parent;
		if (ts.isTypeAliasDeclaration(parent)) {
			return parent.name.text;
		}
		if (ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent)) {
			return parent.name.getText(parent.getSourceFile());
		}
		return "callback";
	}

	/** Responsibilities: _nested generic type_. **/
	private contains_nested_generic(node: ts.TypeNode): boolean {
		let nested = false;
		const visit = (child: ts.Node): void => {
			if (ts.isTypeReferenceNode(child)) {
				const arguments_nodes = child.typeArguments;
				if (arguments_nodes !== undefined) {
					nested = true;
					arguments_nodes.forEach((argument) => argument.forEachChild(visit));
					return;
				}
			}
			child.forEachChild(visit);
		};
		node.forEachChild(visit);
		return nested;
	}

	/** Responsibilities: _nested generic node_. **/
	private nested_generic_node(node: ts.Node): boolean {
		if (!ts.isTypeReferenceNode(node)) {
			return false;
		}
		if (node.typeArguments === undefined) {
			return false;
		}
		if (!this.contains_nested_generic(node)) {
			return false;
		}
		const parent = node.parent;
		if (ts.isTypeReferenceNode(parent)) {
			if (parent.typeArguments !== undefined) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _nested generic violation_. **/
	private append_nested_node(
		violations: ViolationContract[],
		source_file: ts.SourceFile,
		rule: RuleContract,
		node: ts.Node,
	): void {
		if (!this.nested_generic_node(node)) {
			return;
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		violations.push(rule.violation(this.context.file_name.value, line, {}));
	}

	/** Responsibilities: _callback contract node diagnostics_. **/
	private append_callback_node(
		violations: ViolationContract[],
		source_file: ts.SourceFile,
		rule: RuleContract,
		node: ts.Node,
	): void {
		if (!ts.isFunctionTypeNode(node)) {
			return;
		}
		const parent = node.parent;
		const named_parent = ts.isTypeAliasDeclaration(parent);
		const property_parent = ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent);
		if (!named_parent && !property_parent) {
			return;
		}
		if (node.parameters.length <= this.maximum_callback_parameters) {
			return;
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		violations.push(rule.violation(this.context.file_name.value, line, {
			name: this.callback_contract_name(node),
			count: String(node.parameters.length),
		}));
	}

	/** Responsibilities: _type rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.context = context;
	}

	/** Responsibilities: _shared type-rule node diagnostics_. **/
	public append_node(
		violations: ViolationContract[],
		source_file: ts.SourceFile,
		node: ts.Node,
	): void {
		const callback_rule = RULES_BY_ID.get(RULE_IDS.callback_contract_size);
		const nested_rule = RULES_BY_ID.get(RULE_IDS.nested_generic_type);
		if (callback_rule !== undefined) {
			this.append_callback_node(violations, source_file, callback_rule, node);
		}
		if (nested_rule !== undefined) {
			this.append_nested_node(violations, source_file, nested_rule, node);
		}
	}

	/** Responsibilities: _callback contract diagnostics_. **/
	public append_callback_contracts(violations: ViolationContract[]): void {
		const source_file = this.context.ast_file.source_file_node();
		const rule = RULES_BY_ID.get(RULE_IDS.callback_contract_size);
		if (rule === undefined) {
			return;
		}
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionTypeNode(node)) {
				const parent = node.parent;
				const named_parent = ts.isTypeAliasDeclaration(parent);
				const property_parent = ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent);
				if ((named_parent || property_parent) && node.parameters.length > this.maximum_callback_parameters) {
					const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
					violations.push(rule.violation(this.context.file_name.value, line, {
						name: this.callback_contract_name(node),
						count: String(node.parameters.length),
					}));
				}
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _nested generic diagnostics_. **/
	public append_nested_generics(violations: ViolationContract[]): void {
		const source_file = this.context.ast_file.source_file_node();
		const rule = RULES_BY_ID.get(RULE_IDS.nested_generic_type);
		if (rule === undefined) {
			return;
		}
		const visit = (node: ts.Node): void => {
			this.append_nested_node(violations, source_file, rule, node);
			node.forEachChild(visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _shared TypeScript type-rule traversal_. **/
	public append_type_rules(violations: ViolationContract[]): void {
		const source_file = this.context.ast_file.source_file_node();
		const callback_rule = RULES_BY_ID.get(RULE_IDS.callback_contract_size);
		const nested_rule = RULES_BY_ID.get(RULE_IDS.nested_generic_type);
		if (callback_rule === undefined && nested_rule === undefined) {
			return;
		}
		const visit = (node: ts.Node): void => {
			this.append_node(violations, source_file, node);
			node.forEachChild(visit);
		};
		visit(source_file);
	}
}
