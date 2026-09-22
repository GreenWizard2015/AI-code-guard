import { AnyTypes } from 'src/rules/typescript/any-types';
import { MetricViolations } from 'src/metric-violations';
import { CallableMetrics } from 'src/metrics/callable-metrics';
import { MethodContractRules } from 'src/metrics/method-contract-rules';
import type { Violation } from 'src/protocols';
import type { AstCallableNode } from 'src/types';
import type { TypeScriptScannerRuleContext } from 'src/bridge/ts/runner/orchestration/runtime/types';
import type { TypeScriptRuleGroupContract } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/types';

/** Responsibilities: _callable metrics application_, _application callable naming type_. **/
export class TypeScriptCallableRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContext;
	private readonly any_types = new AnyTypes();
	private readonly metric_violations = new MetricViolations();
	private readonly method_contract_rules = new MethodContractRules();

	/** Responsibilities: _function metric violations addition_. **/
	private append_function_metrics(violations: Violation[], file: string, functions: readonly AstCallableNode[]): void {
		if (this.context.file_name.test()) {
			return;
		}
		for (const node of functions) {
			const metrics = new CallableMetrics(violations, file, node, false);
			metrics.append_callable_metrics();
		}
	}

	/** Responsibilities: _callable rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContext) {
		this.context = context;
	}

	/** Responsibilities: _aggregation callable rule violations_. **/
	public append(violations: Violation[]): void {
		const file = this.context.file_name.value;
		const functions = this.context.ast.functions;
		const classes = this.context.ast.classes;
		const methods = classes.flatMap(node => node.methods);
		this.append_function_metrics(violations, file, functions);
		this.any_types.append_any_info(violations, file, [...functions, ...methods], classes);
		this.method_contract_rules.append(violations, file, methods);
		this.metric_violations.append_depth_violations(violations, file, this.context.ast.attribute_accesses);
	}
}
