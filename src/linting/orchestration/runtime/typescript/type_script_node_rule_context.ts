import { performance } from "node:perf_hooks";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { RuleNodeDiagnosticContextContract, RuleParameters } from "src/types";
import type ts from "typescript";

/** Responsibilities: _node-scoped rule diagnostics_, _source-position mapping_. **/
export class TypeScriptNodeRuleContext implements RuleNodeDiagnosticContextContract {
	private readonly _node: ts.Node;
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _violations: ViolationContract[];
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _node diagnostic context_. **/
	public constructor(
		node: ts.Node,
		file: string,
		source_file: ts.SourceFile,
		violations: ViolationContract[],
		stage_timer: LintStageTimerContract,
	) {
		this._node = node;
		this._file = file;
		this._source_file = source_file;
		this._violations = violations;
		this._stage_timer = stage_timer;
	}

	/** Responsibilities: _rule diagnostics_. **/
	public append_rule(rule_id: string): void {
		this.append_parameterized_rule(rule_id, {});
	}

	/** Responsibilities: _parameterized rule diagnostics_. **/
	public append_parameterized_rule(rule_id: string, parameters: RuleParameters): void {
		this._stage_timer.measure(`rule.${rule_id}.typescript.materialization`, () => {
			const rule = new DiagnosticRule(rule_id);
			const position = this._node.getStart(this._source_file);
			const line = this._source_file.getLineAndCharacterOfPosition(position).line + 1;
			this._violations.push(rule.violation(this._file, line, parameters));
		});
	}

	/** Responsibilities: _file-scoped rule diagnostics_. **/
	public append_diagnostic_rule(rule: RuleContract): void {
		if (!rule.supports_file(this._file)) {
			return;
		}
		const started = performance.now();
		const position = this._node.getStart(this._source_file);
		const line = this._source_file.getLineAndCharacterOfPosition(position).line + 1;
		const violation = rule.violation(this._file, line, {});
		this._violations.push(violation);
		this._stage_timer.add_duration({
			name: `rule.${violation.rule_id()}.typescript.materialization`,
			duration_ms: performance.now() - started,
		});
	}
}
