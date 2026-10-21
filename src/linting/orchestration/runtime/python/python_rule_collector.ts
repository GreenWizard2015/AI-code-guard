import { ClassReporting } from "src/core/support/source-analysis/class_reporting";
import { MethodOrder } from "src/rules/method_order";
import { MetricViolations } from "src/metrics/metric_violations";
import { NamingSupport } from "src/rules/naming_support";
import { LeadingUnderscoreNaming } from "src/rules/leading_underscore_naming";
import { PythonArchitecture } from "src/linting/orchestration/runtime/python/python_architecture";
import { PythonHacks } from "src/linting/orchestration/runtime/python/python_hacks";
import { Syntax } from "src/parser/analysis/syntax";
import { CallableMetrics } from "src/metrics/callable_metrics";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { SharedParameterAdapter } from "src/metrics/shared_parameter_adapter";
import { MethodContractRules } from "src/metrics/method_contract_rules";
import { PythonTestRuleCollector } from "src/linting/orchestration/runtime/python/python_test_rule_collector";
import { PythonTypeRuleCollector } from "src/linting/orchestration/runtime/python/python_type_rule_collector";
import type { ClassReportingContract } from "src/reporting_protocols";
import type { MethodContractRulesContract } from "src/shared_services_protocols";
import type { PythonTestRuleCollectorContract } from "src/python_protocols";
import type { PythonRuleInputContract } from "src/linting/types";
import type { AstClassNodeContract } from "src/types";
import type { MetricViolationsContract } from "src/reporting_protocols";
import type { MethodOrderContract, NamingSupportContract } from "src/analysis_protocols";
import type { PythonArchitectureContract, PythonHacksContract, PythonTypeRuleCollectorContract } from "src/python_protocols";
import type { SyntaxContract } from "src/shared_services_protocols";

/** Responsibilities: _architecture rule aggregation_, _metric violation collection_. **/
export class PythonRuleCollector {
	private readonly python_architecture: PythonArchitectureContract;
	private readonly python_hacks: PythonHacksContract;
	private readonly metric_violations: MetricViolationsContract;
	private readonly syntax: SyntaxContract;
	private readonly leading_underscore_naming: LeadingUnderscoreNaming;
	private readonly naming_support: NamingSupportContract;
	private readonly input: PythonRuleInputContract;
	private readonly test_rules: PythonTestRuleCollectorContract;
	private readonly method_contract_rules: MethodContractRulesContract;
	private readonly type_rules: PythonTypeRuleCollectorContract;

	/** Responsibilities: _shared-parameter violations addition_. **/
	private append_shared_rules(): void {
		const { violations, file_name, classes, project_type_names } = this.input;
		if (file_name.test()) {
			return;
		}
		for (const node of classes) {
			const adapter = new SharedParameterAdapter({
				file: file_name.value,
				kind: "method",
				nodes: node.methods,
				type_sources: new Map(
					this.input.classes.map((item) => [item.name, { file: file_name.value, name: item.name }] as const),
				),
				project_types: project_type_names,
				reference_aliases: this.input.reference_aliases,
				language: "python",
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
			classes.flatMap((node) => node.methods),
		);
	}

	/** Responsibilities: _boolean flag parameter diagnostics_. **/
	private append_flag_contracts(): void {
		const { violations, file_name, classes, functions } = this.input;
		this.method_contract_rules.append_flag_parameters(violations, file_name.value, [
			...functions,
			...classes.flatMap((node) => node.methods),
		]);
	}

	/** Responsibilities: _Python metric violations addition_. **/
	private append_metric_violations(): void {
		const { classes } = this.input;
		classes.forEach((node) => this.append_class_metrics(node));
		this.append_callable_metrics();
		this.append_method_contracts();
		this.append_flag_contracts();
	}

	/** Responsibilities: _aggregation metrics class_. **/
	private append_class_metrics(node: AstClassNodeContract): void {
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
		class_reporting: ClassReportingContract,
		method_order: MethodOrderContract,
		node: AstClassNodeContract,
	): void {
		const { violations, file_name } = this.input;
		class_reporting.report_class_methods(violations, file_name, node);
		const structure = new ClassStructureReporter(violations, file_name, node, this.input.suppress_short_class);
		structure.report_design();
		structure.report_sizes();
		if (!node.extends_external_class) {
			method_order.append_order_violations(violations, file_name.value, node);
		}
	}

	/** Responsibilities: _class limits addition testing_. **/
	private append_test_limits(class_reporting: ClassReportingContract, node: AstClassNodeContract): void {
		const { violations, file_name } = this.input;
		class_reporting.report_test_limits({ node, file_name, violations });
		const structure = new ClassStructureReporter(violations, file_name, node);
		structure.append_interface_limit();
	}

	/** Responsibilities: _Python rule collection initialization_. **/
	public constructor(input: PythonRuleInputContract) {
		this.python_architecture = new PythonArchitecture();
		this.python_hacks = new PythonHacks();
		this.metric_violations = new MetricViolations();
		this.syntax = new Syntax();
		this.leading_underscore_naming = new LeadingUnderscoreNaming();
		this.naming_support = new NamingSupport(this.leading_underscore_naming);
		this.method_contract_rules = new MethodContractRules();
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
		this.syntax.append_parse_issues(violations, file, operations.parse_issues, "python");
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
