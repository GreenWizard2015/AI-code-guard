import type { LintFileNameContract } from "src/core/support/protocols";
import { CallableNamingAnalysis } from "src/metrics/callable_naming_analysis";
import type { AstCallableNode } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableNamingRulesContract } from "src/shared_services_protocols";

/** Responsibilities: _callable verb naming_, _boolean result naming_. **/
export class CallableNamingRules implements CallableNamingRulesContract {
	private readonly _file_name: LintFileNameContract;

	/** Responsibilities: _field initialization_. **/
	public constructor(file_name: LintFileNameContract) {
		this._file_name = file_name;
	}

	/** Responsibilities: _file naming contracts application_. **/
	public append(violations: ViolationContract[], nodes: readonly AstCallableNode[]): void {
		if (this._file_name.test()) {
			return;
		}
		for (const node of nodes) {
			const analysis = new CallableNamingAnalysis(this._file_name, node, violations);
			analysis.append();
		}
	}

	/** Responsibilities: _boolean flag parameter collection_. **/
	public append_flag_parameters(violations: ViolationContract[], nodes: readonly AstCallableNode[]): void {
		if (this._file_name.test()) {
			return;
		}
		for (const node of nodes) {
			const analysis = new CallableNamingAnalysis(this._file_name, node, violations);
			analysis.append_flag_parameter();
		}
	}
}
