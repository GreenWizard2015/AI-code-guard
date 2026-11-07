import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptTemporalCoupling } from "src/rules/typescript/syntax-rules/ast/verifier/temporal-analysis/type_script_temporal_coupling";
import type { TypeScriptTemporalCouplingContract } from "src/typescript_analysis_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _method order analysis_, _source analysis caching_. **/
export class TypeScriptTemporalCouplingRules implements ASTSourceRuleContract {
	private readonly _analyses: WeakMap<ts.SourceFile, TypeScriptTemporalCouplingContract>;

	/** Responsibilities: _operation order state_. **/
	private analysis(request: TypeScriptNodeVerificationRequest): TypeScriptTemporalCouplingContract {
		const source_file = request.context.state().source.source_file;
		const cached = this._analyses.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const analysis: TypeScriptTemporalCouplingContract = new TypeScriptTemporalCoupling(source_file);
		this._analyses.set(source_file, analysis);
		return analysis;
	}

	/** Responsibilities: _temporal coupling rule initialization_. **/
	public constructor() {
		this._analyses = new WeakMap();
	}

	/** Responsibilities: _temporal coupling rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _class state protocol dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isClassDeclaration(request.node)) {
			return;
		}
		const source_state = request.context.state().source;
		if (source_state.test_file) {
			return;
		}
		const violations: ViolationContract[] = [];
		this.analysis(request).append_class(violations, source_state.file, request.node);
		for (const violation of violations) {
			request.context.append_violation(violation);
		}
	}
}
