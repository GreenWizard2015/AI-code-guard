import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import type { ViolationContract } from "src/reporting_protocols";
import { ObjectLiteralReturns } from "src/rules/typescript/syntax-rules/ast/verifier/object-returns/object_literal_returns";
import type { ObjectReturnNodes } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import type { TypeScriptAstNodeCollection } from "src/typescript_runtime_types";
import ts from "typescript";

/** Responsibilities: _object literal return checks_, _source alias analysis_. **/
export class ObjectLiteralReturnRules implements ASTSourceRuleContract {
	private readonly _nodes_by_context: WeakMap<RuleContextContract, ObjectReturnNodes>;

	/** Responsibilities: _object return violation collection_. **/
	private append_violations(context: RuleContextContract, nodes: ObjectReturnNodes): void {
		const { file, source_file } = context.state().source;
		const { project_names } = context.state().project;
		const checker = new ObjectLiteralReturns(
			project_names.project_contract_names,
			project_names.project_interface_names,
			project_names.project_class_names,
			new Set(nodes.aliases.map((alias) => alias.name.text)),
		);
		const violations: ViolationContract[] = [];
		const index: TypeScriptAstNodeCollection = {
			type_aliases: nodes.aliases,
			return_statements: nodes.returns,
			function_like: [],
			declaration_candidates: [],
		};
		checker.append_violations(violations, file, source_file, index);
		for (const violation of violations) {
			context.append_violation(violation);
		}
	}

	/** Responsibilities: _object return caching_. **/
	public constructor() {
		this._nodes_by_context = new WeakMap();
	}

	/** Responsibilities: _object return rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.includes("return");
	}

	/** Responsibilities: _object return node verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (!ts.isReturnStatement(node) && !ts.isTypeAliasDeclaration(node)) {
			return;
		}
		let nodes = this._nodes_by_context.get(context);
		if (nodes === undefined) {
			nodes = { aliases: [], returns: [] };
			this._nodes_by_context.set(context, nodes);
		}
		if (ts.isTypeAliasDeclaration(node)) {
			nodes.aliases.push(node);
		} else if (ts.isReturnStatement(node)) {
			nodes.returns.push(node);
		}
	}

	/** Responsibilities: _object return source analysis_. **/
	public finish_source(request: TypeScriptSourceVerificationRequest): void {
		const { context } = request;
		const nodes = this._nodes_by_context.get(context);
		this._nodes_by_context.delete(context);
		if (nodes === undefined || nodes.returns.length === 0) {
			return;
		}
		context
			.state()
			.analysis.stage_timer.measure(`rule.${RULE_IDS.typescript_object_literal_return}`, () =>
				this.append_violations(context, nodes),
			);
	}
}
