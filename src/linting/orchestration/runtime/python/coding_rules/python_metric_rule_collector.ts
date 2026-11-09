import { PythonTypeRuleCollector } from "src/linting/orchestration/runtime/python/coding_rules/python_type_rule_collector";
import type { PythonRuleInput } from "src/linting/types";
import { CallableMetrics } from "src/metrics/callable_metrics";
import { CallableNamingRules } from "src/metrics/callable_naming_rules";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { EMPTY_MUTATED_FIELDS } from "src/metrics/constants";
import { SharedParameterAdapter } from "src/metrics/shared_parameter/shared_parameter_adapter";
import type { SharedParameterTypeSource } from "src/metrics/types";
import type { AstCallableNode, AstClassNode } from "src/model/ast/normalized_ast_types";
import type { PythonTypeRuleCollectorContract } from "src/python_protocols";
import { MethodOrder } from "src/rules/method_order";
import type { CallableNamingRulesContract } from "src/shared_services_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _Python metrics_, _Python contracts_. **/
export class PythonMetricRuleCollector {
	private readonly _input: PythonRuleInput;
	private readonly _contracts: CallableNamingRulesContract;
	private readonly _types: PythonTypeRuleCollectorContract;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _Python class metric collection_. **/
	private append_class_metrics(class_node: AstClassNode): void {
		const reporter = new ClassStructureReporter({
			stage_timer: this._stage_timer,
			violations: this._input.violations,
			file_name: this._input.file_name,
			node: class_node,
			suppress_short_class: this._input.project.suppress_short_class,
			mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
			project_class_names: this._input.project.classes,
			project_contract_names: this._input.project.protocols,
			project_alias_names: this._input.project.type_aliases,
			class_state: {
				constructor_injected_state: false,
				inherited_instance_state: false,
				inherited_state_names: new Set<string>(),
			},
		});
		reporter.report_class(this._input.file_name.test());
		this.append_method_order(class_node);
	}

	/** Responsibilities: _class method ordering_. **/
	private append_method_order(class_node: AstClassNode): void {
		if (this._input.file_name.test()) {
			return;
		}
		if (class_node.classification.extends_external_class) {
			return;
		}
		this._stage_timer.measure("rule.method-order.python", () => {
			const order = new MethodOrder(this._input.file_name.value(), class_node);
			order.append_order(this._input.violations);
		});
	}

	/** Responsibilities: _shared-parameter violation collection_. **/
	private append_shared_rules(): void {
		const { classes } = this._input.source;
		const file_name = this._input.file_name;
		if (file_name.test()) {
			return;
		}
		const type_sources = new Map(
			classes.map((item) => [item.identity.name, { file: file_name.value(), name: item.identity.name }] as const),
		);
		this._stage_timer.measure("rule.shared-parameter.python-class-methods", () => {
			for (const node of classes) {
				this.append_shared_class(node, type_sources);
			}
		});
	}

	/** Responsibilities: _Python class shared parameters_. **/
	private append_shared_class(node: AstClassNode, type_sources: Map<string, SharedParameterTypeSource>): void {
		if (node.classification.extends_external_class) {
			return;
		}
		const adapter = new SharedParameterAdapter({
			file: this._input.file_name.value(),
			kind: "method",
			nodes: node.structure.methods,
			type_sources,
			project_types: this._input.project.types,
			reference_aliases: this._input.source.reference_aliases,
			language: "python",
		});
		this._input.violations.push(...adapter.violations());
	}

	/** Responsibilities: _Python callable metric collection_. **/
	private append_callable_metrics(): void {
		const { violations } = this._input;
		const { functions } = this._input.source;
		const file_name = this._input.file_name;
		if (file_name.test()) {
			return;
		}
		for (const node of functions) {
			const metrics = new CallableMetrics(violations, file_name.value(), node, false, this._stage_timer);
			metrics.append_callable_metrics();
		}
	}

	/** Responsibilities: _Python class metric aggregation_. **/
	private class_methods(): AstCallableNode[] {
		const { classes } = this._input.source;
		for (const node of classes) {
			this.append_class_metrics(node);
		}
		return classes.flatMap((node) => node.structure.methods);
	}

	/** Responsibilities: _Python callable contract aggregation_. **/
	/** Responsibilities: _Python metric collection state_. **/
	public constructor(input: PythonRuleInput, stage_timer: LintStageTimerContract) {
		this._input = input;
		this._stage_timer = stage_timer;
		this._contracts = new CallableNamingRules(input.file_name);
		this._types = new PythonTypeRuleCollector(input, stage_timer);
	}

	/** Responsibilities: _Python metric violations_. **/
	public append_metrics(): void {
		const methods = this.class_methods();
		this.append_callable_metrics();
		this._contracts.append(this._input.violations, methods);
		this._contracts.append_flag_parameters(this._input.violations, [...this._input.source.functions, ...methods]);
		this.append_shared_rules();
	}

	/** Responsibilities: _Python type violations_. **/
	public append_type_rules(): void {
		this._types.append_type_rules();
		this._types.append_type_information();
	}
}
