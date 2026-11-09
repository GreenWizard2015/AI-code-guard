import type {
	ASTNodeVerificationContract,
	ASTSourceRuleContract,
	ASTVerifierContract,
	ASTVerifierNodeGroupContract,
	ASTVerifierNodeRegistrationContract,
} from "src/ast_verifier_protocols";
import { EMPTY_AST_NODE_VERIFIERS } from "src/constants";
import { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import { TypeScriptAstNodeObserverRegistry } from "src/parser/analysis/type_script_ast_node_observer_registry";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import type { CallableTypeScriptAstNodeObserver } from "src/typescript_runtime_types";
import type ts from "typescript";

/** Responsibilities: _AST verifier dispatch_, _applicable verifier selection_. **/
export class ASTVerifier implements ASTVerifierContract {
	private readonly _verifiers: ASTVerifierNodeGroupContract[][];
	private readonly _source_finalizers: readonly ASTSourceRuleContract[];
	private readonly _node_dispatcher: TypeScriptAstNodeObserverRegistry<RuleContextContract>;
	private readonly _node_verifier: CallableTypeScriptAstNodeObserver<RuleContextContract>;

	/** Responsibilities: _AST verifier initialization_. **/
	public constructor(source_rules: readonly ASTSourceRuleContract[] = []) {
		this._verifiers = [];
		this._source_finalizers = source_rules.filter((rule) => rule.finish_source !== undefined);
		this._node_dispatcher = new TypeScriptAstNodeObserverRegistry();
		this._node_verifier = ({ node }, context) => this.verify(node, context);
	}

	/** Responsibilities: _node-kind verifier indexing_. **/
	public register(registration: ASTVerifierNodeRegistrationContract): void {
		const kind = registration.node_kind();
		this._node_dispatcher.register(TypeScriptAstDispatchPhase.FileRules, [kind], this._node_verifier);
		const groups = this._verifiers[kind] ?? [];
		registration.append_to(groups);
		this._verifiers[kind] = groups;
	}

	/** Responsibilities: _applicable AST verifier selection_. **/
	public verifiers(node: ts.Node): readonly ASTNodeVerificationContract[] {
		const candidates = this._verifiers[node.kind];
		if (candidates === undefined) {
			return EMPTY_AST_NODE_VERIFIERS;
		}
		const selected: ASTNodeVerificationContract[] = [];
		for (const candidate of candidates) {
			candidate.append_match(node, selected);
		}
		if (selected.length > 0) {
			return selected;
		}
		return EMPTY_AST_NODE_VERIFIERS;
	}

	/** Responsibilities: _AST verifier identity_. **/
	public name(): string {
		return "ast-verifier";
	}

	/** Responsibilities: _nested AST rule application_. **/
	public verify(node: ts.Node, context: RuleContextContract): void {
		const candidates = this._verifiers[node.kind];
		if (candidates !== undefined) {
			const request: TypeScriptNodeVerificationRequest = { node, context };
			for (const candidate of candidates) {
				context
					.state()
					.analysis.stage_timer.measure(`typescript.ast-rule.${candidate.timing_name()}`, () =>
						candidate.verify_if_match(request),
					);
			}
		}
	}

	/** Responsibilities: _timed source-file verifier traversal_. **/
	public verify_source_file(request: TypeScriptSourceVerificationRequest): void {
		const { source_root, context, stage_timer } = request;
		stage_timer.measure("file-analysis.typescript.post-remaining.coding-rules.ast-rules.node-rules", () => {
			this._node_dispatcher.dispatch(
				TypeScriptAstDispatchPhase.FileRules,
				context.state().analysis.traversal,
				source_root,
				context,
			);
			for (const rule of this._source_finalizers) {
				const finalizer = rule.finish_source;
				if (finalizer === undefined) {
					continue;
				}
				stage_timer.measure(`typescript.ast-rule.${rule.constructor.name}.finalize`, () =>
					finalizer.call(rule, request),
				);
			}
		});
	}
}
