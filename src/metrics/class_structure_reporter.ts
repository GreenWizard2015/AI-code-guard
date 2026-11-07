import { MAX_CLASS_LINES, MAX_CLASS_METHODS, MIN_CLASS_LINES } from "src/constants";
import { MethodSpecializationReporter } from "src/core/support/method_specialization_reporter";
import type { LintFileNameContract } from "src/core/support/protocols";
import { CallableMetrics } from "src/metrics/callable_metrics";
import { ClassDesignReporter } from "src/metrics/class_design_reporter";
import {
	CONSTRUCTOR_NAME,
	METRIC_KIND_CLASS_METHODS,
	METRIC_KIND_CLASS_SIZE,
	METRIC_KIND_SHORT_CLASS,
	PYTHON_CONSTRUCTOR_NAME,
} from "src/metrics/constants";
import { MetricViolations } from "src/metrics/metric_violations";
import type { ClassStructureReporterOptions } from "src/metrics/types";
import type {
	AstClassNode,
	AstClassNodeClassification,
	AstClassNodeIdentity,
	AstClassNodeStructure,
} from "src/model/ast/normalized_ast_types";
import type { CallableMetricsContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { ClassStructureReporterContract } from "src/runtime_protocols";

/** Responsibilities: _class design diagnostics_, _class size metric reporting_. **/
export class ClassStructureReporter implements ClassStructureReporterContract {
	private readonly _violations: ViolationContract[];
	private readonly _file_name: LintFileNameContract;
	private readonly _node: AstClassNode;
	private readonly _class_identity: AstClassNodeIdentity;
	private readonly _class_structure: AstClassNodeStructure;
	private readonly _classification: AstClassNodeClassification;
	private readonly _design_reporter: ClassDesignReporter;
	private readonly _suppress_short_class: boolean;
	private readonly _minimum_class_size: number;
	private readonly _metric_violations: MetricViolations;
	private readonly report_as_method = true;

	/** Responsibilities: _aggregation callable metric results_. **/
	private append_metrics(metrics: readonly CallableMetricsContract[]): void {
		for (const item of metrics) {
			item.append_callable_metrics();
		}
	}

	/** Responsibilities: _aggregation class size method-count_. **/
	private append_class_sizes(): void {
		const line = this._class_identity.start;
		if (this._minimum_class_size > MAX_CLASS_LINES) {
			this._metric_violations.metric_violation(line, this._minimum_class_size, METRIC_KIND_CLASS_SIZE);
		}
		const methods = this._class_structure.methods.filter(
			(method) => method.identity.name !== CONSTRUCTOR_NAME && method.identity.name !== PYTHON_CONSTRUCTOR_NAME,
		);
		const has_constructor = this._class_structure.methods.some(
			(method) => method.identity.name === CONSTRUCTOR_NAME || method.identity.name === PYTHON_CONSTRUCTOR_NAME,
		);
		const method_count = methods.length + (has_constructor ? 1 : 0);
		if (method_count > MAX_CLASS_METHODS) {
			this._metric_violations.metric_violation(line, method_count, METRIC_KIND_CLASS_METHODS);
		}
	}

	/** Responsibilities: _reporting size metrics exclusion_. **/
	private sizes_excluded(): boolean {
		if (this._file_name.test()) {
			return true;
		}
		if (this._classification.type_contract) {
			return true;
		}
		if (this._classification.protocol) {
			return true;
		}
		return this._classification.extends_external_class;
	}

	/** Responsibilities: _reporting short class metric_. **/
	private short_class_excluded(): boolean {
		if (this._classification.is_data_class) {
			return true;
		}
		if (this._suppress_short_class) {
			return true;
		}
		return this._minimum_class_size >= MIN_CLASS_LINES;
	}

	/** Responsibilities: _reporting short class metric_. **/
	private append_short_class(): void {
		if (this.short_class_excluded()) {
			return;
		}
		this._metric_violations.metric_violation(
			this._class_identity.start,
			this._minimum_class_size,
			METRIC_KIND_SHORT_CLASS,
		);
	}

	/** Responsibilities: _reporting method metrics_. **/
	private report_method_metrics(): void {
		if (this._class_structure.methods.length === 0) {
			return;
		}
		const metrics = this._class_structure.methods.map(
			(method) => new CallableMetrics(this._violations, this._file_name.value(), method, this.report_as_method),
		);
		this.append_metrics(metrics);
	}

	/** Responsibilities: _class metrics initialization_. **/
	public constructor(options: ClassStructureReporterOptions) {
		this._metric_violations = new MetricViolations(options.violations, options.file_name.value());
		this._violations = options.violations;
		this._file_name = options.file_name;
		this._node = options.node;
		this._class_identity = options.node.identity;
		this._class_structure = options.node.structure;
		this._classification = options.node.classification;
		this._design_reporter = new ClassDesignReporter(options);
		this._suppress_short_class = options.suppress_short_class;
		this._minimum_class_size = (this._class_identity.lines + this._class_identity.sloc) / 2;
	}

	/** Responsibilities: _reporting test method limits_. **/
	public report_test_limits(): void {
		this._design_reporter.report_interface_limit();
		const metrics = this._class_structure.methods.map(
			(method) => new CallableMetrics(this._violations, this._file_name.value(), method, this.report_as_method),
		);
		for (const metric of metrics) {
			metric.append_nesting_depth();
		}
	}

	/** Responsibilities: _reporting class-level methods_. **/
	public report_class_methods(): void {
		if (!this._design_reporter.reportable_class()) {
			return;
		}
		const specialization_reporter = new MethodSpecializationReporter(
			this._violations,
			this._file_name.value(),
			this._node,
		);
		specialization_reporter.report_api();
		specialization_reporter.report_implementation();
		this.report_method_metrics();
	}

	/** Responsibilities: _class design diagnostics_. **/
	public report_design(): void {
		this._design_reporter.report_interface_limit();
		this._design_reporter.report_class_design();
	}

	/** Responsibilities: _reporting class size method-count_. **/
	public report_sizes(): void {
		if (this.sizes_excluded()) {
			return;
		}
		this.append_short_class();
		this.append_class_sizes();
	}

	/** Responsibilities: _class structure reporting_. **/
	public report_class(test_file: boolean): void {
		this.report_class_methods();
		if (test_file) {
			this.report_test_limits();
			return;
		}
		this.report_design();
		this.report_sizes();
	}
}
