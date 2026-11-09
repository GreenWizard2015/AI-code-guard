import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _namespace file boundaries_, _namespace declaration placement_. **/
export class TypeScriptFileNamespaceRules implements ASTSourceRuleContract {
	private readonly _namespace_rule: DiagnosticRule;
	private readonly _namespaces: WeakMap<RuleContextContract, ts.ModuleDeclaration[]>;

	/** Responsibilities: _namespace declaration accumulation_. **/
	private append_namespace(context: RuleContextContract, node: ts.ModuleDeclaration): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		let namespaces = this._namespaces.get(context);
		if (namespaces === undefined) {
			namespaces = [];
			this._namespaces.set(context, namespaces);
		}
		namespaces.push(node);
	}

	/** Responsibilities: _namespace placement violations_. **/
	private placement_violation_nodes(
		namespaces: readonly ts.ModuleDeclaration[],
		source_file: ts.SourceFile,
	): ts.Node[] {
		if (namespaces.length > 1) {
			const second_namespace = namespaces[1];
			if (second_namespace !== undefined) {
				return [second_namespace];
			}
			return [];
		}
		for (const statement of source_file.statements) {
			if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement)) {
				continue;
			}
			if (!ts.isModuleDeclaration(statement)) {
				return [statement];
			}
		}
		return [];
	}

	/** Responsibilities: _namespace diagnostic rule setup_. **/
	public constructor() {
		this._namespace_rule = new DiagnosticRule(RULE_IDS.typescript_namespace_file);
		this._namespaces = new WeakMap();
	}

	/** Responsibilities: _namespace source eligibility_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _namespace node collection_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isModuleDeclaration(request.node)) {
			return;
		}
		this.append_namespace(request.context, request.node);
	}

	/** Responsibilities: _namespace file policy_. **/
	public finish_source(request: TypeScriptSourceVerificationRequest): void {
		const { context } = request;
		const {
			source: { file, source_file },
			analysis: { stage_timer },
		} = context.state();
		stage_timer.measure(`rule.${RULE_IDS.typescript_namespace_file}`, () => {
			stage_timer.measure("file-analysis.typescript.coding-rules.root-rules.namespace", () => {
				const namespaces = this._namespaces.get(context);
				this._namespaces.delete(context);
				if (namespaces === undefined || namespaces.length === 0) {
					return;
				}
				for (const node of this.placement_violation_nodes(namespaces, source_file)) {
					const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
					context.append_violation(this._namespace_rule.violation(file, line, {}));
				}
			});
		});
	}
}
