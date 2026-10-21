import { CallableMetrics } from "src/metrics/callable_metrics";
import type { CallableMetricsContract } from "src/reporting_protocols";
import type { ClassReportingContract, ViolationContract } from "src/reporting_protocols";
import type { LintFileNameContract } from "src/source_types";
import type { AstClassNodeContract } from "src/types";
import { MethodSpecializationReporter } from "src/core/support/source-analysis/method_specialization_reporter";
import type { MaxMethodMetricInput } from "src/types";

/** Responsibilities: _callable metrics_, _method limits_. **/
export class ClassReporting implements ClassReportingContract {
	private readonly report_as_method = true;

	/** Responsibilities: _aggregation callable metric results_. **/
	private append_metrics(metrics: readonly CallableMetricsContract[]): void {
		for (const item of metrics) {
			item.append_callable_metrics();
		}
	}

	/** Responsibilities: _classification class contribute class_. **/
	private is_reportable_class(file_name: LintFileNameContract, node: AstClassNodeContract): boolean {
		if (file_name.test()) {
			return false;
		}
		if (node.type_contract || node.protocol || node.extends_external_class) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _reporting metrics methods class_. **/
	public report_method_metrics(
		violations: ViolationContract[],
		file_name: LintFileNameContract,
		node: AstClassNodeContract,
	): void {
		if (node.methods.length === 0) {
			return;
		}
		const metrics = node.methods.map(
			(method) => new CallableMetrics(violations, file_name.value, method, this.report_as_method),
		);
		this.append_metrics(metrics);
	}

	/** Responsibilities: _reporting test method metric_. **/
	public report_test_limits(input: MaxMethodMetricInput): void {
		const metrics = input.node.methods.map(
			(method) => new CallableMetrics(input.violations, input.file_name.value, method, this.report_as_method),
		);
		for (const metric of metrics) {
			metric.append_nesting_depth();
		}
	}

	/** Responsibilities: _reporting class-level method counts_. **/
	public report_class_methods(
		violations: ViolationContract[],
		file_name: LintFileNameContract,
		node: AstClassNodeContract,
	): void {
		if (!this.is_reportable_class(file_name, node)) {
			return;
		}
		const specialization_reporter = new MethodSpecializationReporter(violations, file_name.value, node);
		specialization_reporter.report_api();
		specialization_reporter.report_implementation();
		this.report_method_metrics(violations, file_name, node);
	}
}
