import type {
	ASTNodeVerificationContract,
	ASTSourceRuleContract,
	ASTVerifierContract,
	ASTVerifierNodeGroupContract,
	ASTVerifierNodeRegistrationContract,
} from "src/ast_verifier_protocols";
import { EMPTY_AST_NODE_VERIFIERS } from "src/constants";
import { TypeScriptAstNodeObserverRegistry } from "src/model/type_script_ast_node_observer_registry";
import { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
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
	private readonly _timing_names: string[][];
	private readonly _source_finalizers: readonly ASTSourceRuleContract[];
	private readonly _node_dispatcher: TypeScriptAstNodeObserverRegistry<RuleContextContract>;
	private readonly _node_verifier: CallableTypeScriptAstNodeObserver<RuleContextContract>;

	/** Responsibilities: _verifier dispatch timing_. **/
	private verify_candidates(
		candidates: readonly ASTVerifierNodeGroupContract[],
		timing_names: readonly string[],
		request: TypeScriptNodeVerificationRequest,
		stage_timer: LintStageTimerContract,
	): void {
		for (let index = 0; index < candidates.length; index += 1) {
			const candidate = candidates[index];
			const timing_name = timing_names[index];
			if (candidate === undefined || timing_name === undefined) {
				continue;
			}
			const start_time = stage_timer.start_measurement();
			try {
				candidate.verify_if_match(request);
			} finally {
				stage_timer.finish_measurement(timing_name, start_time);
			}
		}
	}

	/** Responsibilities: _AST verifier initialization_. **/
	public constructor(source_rules: readonly ASTSourceRuleContract[] = []) {
		this._verifiers = [];
		this._timing_names = [];
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
		this._timing_names[kind] = groups.map((candidate) => `typescript.ast-rule.${candidate.timing_name()}`);
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
			const timing_names = this._timing_names[node.kind] ?? [];
			const stage_timer = context.state().analysis.stage_timer;
			this.verify_candidates(candidates, timing_names, request, stage_timer);
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
