import { DiagnosticRule } from "src/model/diagnostic_rule";
import ts from "typescript";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { TypeScriptAstStateRulesContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _mutable field classification_, _public state diagnostics_. **/
export class TypeScriptAstStateRules implements TypeScriptAstStateRulesContract {
	private readonly context: TypeScriptScannerRuleContextContract;

	/** Responsibilities: _mutable collection field classification_. **/
	private mutable_collection_field(node: ts.PropertyDeclaration): boolean {
		if (node.type === undefined) {
			return false;
		}
		if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)) {
			return false;
		}
		if (ts.isArrayTypeNode(node.type)) {
			return true;
		}
		if (!ts.isTypeReferenceNode(node.type)) {
			return false;
		}
		const name = node.type.typeName.getText(node.getSourceFile());
		return ["Array", "Map", "Set", "Record"].includes(name);
	}

	/** Responsibilities: _public state field diagnostics_. **/
	private append_state_field(
		violations: ViolationContract[],
		rule: RuleContract,
		source_file: ts.SourceFile,
		node: ts.PropertyDeclaration,
	): void {
		if (!this.mutable_collection_field(node)) {
			return;
		}
		const private_or_protected = node.modifiers?.some((modifier) => {
			if (modifier.kind === ts.SyntaxKind.PrivateKeyword) {
				return true;
			}
			return modifier.kind === ts.SyntaxKind.ProtectedKeyword;
		});
		if (private_or_protected) {
			return;
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		violations.push(rule.violation(this.context.file_name.value, line, {}));
	}

	/** Responsibilities: _state rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.context = context;
	}

	/** Responsibilities: _public state field diagnostics_. **/
	public append_public_state(violations: ViolationContract[]): void {
		if (this.context.file_name.test()) {
			return;
		}
		const source_file = this.context.ast_file.source_file_node();
		const rule = new DiagnosticRule(RULE_IDS.public_state_exposure);
		const visit = (node: ts.Node): void => {
			if (ts.isPropertyDeclaration(node)) {
				this.append_state_field(violations, rule, source_file, node);
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _public state node diagnostics_. **/
	public append_node(violations: ViolationContract[], source_file: ts.SourceFile, node: ts.Node): void {
		if (!ts.isPropertyDeclaration(node)) {
			return;
		}
		const rule = new DiagnosticRule(RULE_IDS.public_state_exposure);
		this.append_state_field(violations, rule, source_file, node);
	}
}
