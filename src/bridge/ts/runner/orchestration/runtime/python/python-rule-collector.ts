import { ClassReporting } from 'src/bridge/ts/core/support/class-reporting';
import { MethodOrder } from 'src/bridge/ts/rules/method-order';
import { MetricViolations } from 'src/metric-violations';
import { NamingSupport } from 'src/bridge/ts/rules/naming-support';
import { PythonArchitecture } from 'src/bridge/ts/runner/orchestration/runtime/python/python-architecture';
import { PythonHacks } from 'src/bridge/ts/runner/orchestration/runtime/python/python-hacks';
import { Syntax } from 'src/syntax';
import { CallableMetrics } from 'src/metrics/callable-metrics';
import { ClassStructureReporter } from 'src/metrics/class-structure-reporter';
import { SharedParameterAdapter } from 'src/metrics/shared-parameter-adapter';
import { MethodContractRules } from 'src/metrics/method-contract-rules';
import { PythonTestRuleCollector } from 'src/bridge/ts/runner/orchestration/runtime/python/python-test-rule-collector';
import { PythonTypeRuleCollector } from 'src/bridge/ts/runner/orchestration/runtime/python/python-type-rule-collector';
import type { PythonRuleInput } from 'src/runner/types';
import type { AstClassNode } from 'src/types';









/** Responsibilities: _collection Python architecture rules_. **/
export class PythonRuleCollector {
	private readonly python_architecture = new PythonArchitecture();
	private readonly python_hacks = new PythonHacks();
	private readonly metric_violations = new MetricViolations();
	private readonly syntax = new Syntax();
	private readonly naming_support = new NamingSupport();
	private readonly input: PythonRuleInput;
	private readonly test_rules: PythonTestRuleCollector;
	private readonly method_contract_rules = new MethodContractRules();
	private readonly type_rules: PythonTypeRuleCollector;

	/** Responsibilities: _shared-parameter violations addition_. **/
	private append_shared_rules(): void {
		const { violations, file_name, classes, project_type_names } = this.input;
		if (file_name.test()) {
			return;
		}
		for (const node of classes) {
			const adapter = new SharedParameterAdapter({
				file: file_name.value,
				kind: 'method',
				nodes: node.methods,
				project_types: project_type_names,
				reference_aliases: this.input.reference_aliases,
				language: 'python',
			});
			violations.push(...adapter.violations());
		}
	}

	/** Responsibilities: _callable metric violations addition_. **/
	private append_callable_metrics(): void {
		const { violations, file_name, functions } = this.input;
		if (!file_name.test()) {
			for (const node of functions) {
				const metrics = new CallableMetrics(violations, file_name.value, node, false);
				metrics.append_callable_metrics();
			}
		}
	}

	/** Responsibilities: _method contract violations addition_. **/
	private append_method_contracts(): void {
		const { violations, file_name, classes } = this.input;
		this.method_contract_rules.append(
			violations,
			file_name.value,
			classes.flatMap(node => node.methods)
		);
	}

	/** Responsibilities: _Python metric violations addition_. **/
	private append_metric_violations(): void {
		const { classes } = this.input;
		classes.forEach(node => this.append_class_metrics(node));
		this.append_callable_metrics();
		this.append_method_contracts();
	}

	/** Responsibilities: _aggregation metrics class_. **/
	private append_class_metrics(node: AstClassNode): void {
		const class_reporting = new ClassReporting();
		const method_order = new MethodOrder();

		const { file_name } = this.input;
		if (file_name.test()) {
			this.append_test_limits(class_reporting, node);
			return;
		}
		this.append_production_limits(class_reporting, method_order, node);
	}

	/** Responsibilities: _production class limits addition_. **/
	private append_production_limits(
		class_reporting: ClassReporting,
		method_order: MethodOrder,
		node: AstClassNode
	): void {
		const { violations, file_name } = this.input;
		class_reporting.report_class_methods(violations, file_name, node);
		const structure = new ClassStructureReporter(
			violations,
			file_name,
			node,
			this.input.suppress_short_class
		);
		structure.report_design();
		structure.report_sizes();
		if (!node.extends_external_class) {
			method_order.append_order_violations(violations, file_name.value, node);
		}
	}

	/** Responsibilities: _class limits addition testing_. **/
	private append_test_limits(class_reporting: ClassReporting, node: AstClassNode): void {
		const { violations, file_name } = this.input;
		class_reporting.report_test_limits({ node, file_name, violations });
		const structure = new ClassStructureReporter(violations, file_name, node);
		structure.report_max_sizes();
	}

	/** Responsibilities: _Python rule collection initialization_. **/
	public constructor(input: PythonRuleInput) {
		this.input = input;
		this.test_rules = new PythonTestRuleCollector(input);
		this.type_rules = new PythonTypeRuleCollector(input);
	}

	/** Responsibilities: _Python architecture violations addition_. **/
	public append_architecture(): void {
		const { violations, file_name, classes, operations, python_imports } = this.input;
		const file = file_name.value;
		this.python_architecture.append_architecture_violations({
			violations,
			file,
			accesses: operations.private_accesses,
			branches: operations.repeated_branches,
			classes,
			imports: python_imports,
		});
		this.python_hacks.append_assignment_violations(violations, file, operations.callables);
		this.metric_violations.append_depth_violations(violations, file, operations.attribute_accesses);
		this.test_rules.append_shape();
		this.test_rules.append_assertions();
		this.syntax.append_parse_issues(violations, file, operations.parse_issues, 'python');
		this.naming_support.append_naming_violations(violations, file, operations.named_symbols, classes, []);
	}

	/** Responsibilities: _Python metric violations addition_. **/
	public append_metrics(): void {
		this.type_rules.append_type_rules();
		this.append_metric_violations();
		this.type_rules.append_type_information();
		this.append_shared_rules();
	}
}
