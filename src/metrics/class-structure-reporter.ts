import { MetricViolations } from 'src/metric-violations';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import { MAX_CLASS_INTERFACES, MAX_CLASS_LINES, MAX_CLASS_METHODS, MIN_CLASS_LINES } from 'src/constants';
import type { AstClassNode, LintFileNameContract } from 'src/types';
import { ProceduralClassName } from 'src/metrics/procedural-class-name';


/** Responsibilities: _reporting class mixins state_. **/
export class ClassStructureReporter {
	private readonly violations: Violation[];
	private readonly file_name: LintFileNameContract;
	private readonly node: AstClassNode;
	private readonly suppress_short_class: boolean;
	private readonly minimum_class_size: number;
	private readonly procedural_class_name = new ProceduralClassName();

	/** Responsibilities: _analysis class mixin_. **/
	private is_mixin(): boolean {
		let base_names: readonly string[] = [];
		if (this.node.base_class_names !== undefined) {
			base_names = this.node.base_class_names;
		}
		if (this.node.base_class_name) {
			base_names = [this.node.base_class_name];
		}
return this.node.name.endsWith('Mixin') || base_names.some(name => name.endsWith('Mixin'));
	}

	/** Responsibilities: _classification class owns stateful_. **/
	private has_state(): boolean {
		const { interfaces, fields, methods } = this.node;
		if (interfaces?.length || fields?.length) {
			return true;
		}
		return methods.some(method => method.name === '__init__' || method.name === 'constructor');
	}

	/** Responsibilities: _resolution primary base class_. **/
	private base_class_name(): string {
		if (this.node.base_class_name.length > 0) {
			return this.node.base_class_name;
		}
		if (this.node.base_class_names.length === 0) {
			return '';
		}
		return this.node.base_class_names[0];
	}

	/** Responsibilities: _aggregation mixin violation class_. **/
	private append_mixin_violation(): void {
		if (!this.is_mixin()) {
			return;
		}
		const rule = new DiagnosticRule('mixin');
		this.violations.push(
			rule.violation(this.file_name.value, this.node.start + 1, {
				name: this.node.name,
			})
		);
	}

	/** Responsibilities: _aggregation stateless-class information applicable_. **/
	private append_stateless_info(): void {
		if (this.has_state()) {
			return;
		}
		const rule = new DiagnosticRule('stateless-class');
		this.violations.push(rule.violation(this.file_name.value, this.node.start + 1));
	}

	/** Responsibilities: _aggregation local-inheritance diagnostics analysis_. **/
	private append_local_inheritance(): void {
		if (this.node.extends_external_class) {
			return;
		}
		const base_name = this.base_class_name();
		if (!base_name) {
			return;
		}
		const rule = new DiagnosticRule('local-inheritance');
		this.violations.push(rule.violation(this.file_name.value, this.node.start + 1, { base_name }));
	}

	/** Responsibilities: _aggregation interface-count violation configuration_. **/
	private append_interface_limit(): void {
		let interfaces: readonly string[] = [];
		if (this.node.interfaces !== undefined) {
			interfaces = this.node.interfaces;
		}
		if (interfaces.length <= MAX_CLASS_INTERFACES) {
			return;
		}
		const rule = new DiagnosticRule('class-interface-count');
		this.violations.push(rule.violation(this.file_name.value, this.node.start + 1, { count: String(interfaces.length) }));
	}

	/** Responsibilities: _aggregation class size method-count_. **/
	private append_class_sizes(): void {
		const metric_violations = new MetricViolations();

		const line = this.node.start;
		if (this.minimum_class_size > MAX_CLASS_LINES) {
			this.violations.push(
				metric_violations.metric_violation(this.file_name.value, line, this.minimum_class_size, 'class_size')
			);
		}
		const methods = this.node.methods.filter(
			method => method.name !== 'constructor' && method.name !== '__init__'
		);
		const has_constructor = this.node.methods.some(
			method => method.name === 'constructor' || method.name === '__init__'
		);
		const method_count = methods.length + (has_constructor ? 1 : 0);
		if (method_count > MAX_CLASS_METHODS) {
			this.violations.push(
				metric_violations.metric_violation(this.file_name.value, line, method_count, 'class_methods')
			);
		}
	}

	/** Responsibilities: _initialization class metric model_. **/
	public constructor(
		violations: Violation[],
		file_name: LintFileNameContract,
		node: AstClassNode,
		suppress_short_class = false
	) {
		this.violations = violations;
		this.file_name = file_name;
		this.node = node;
		this.suppress_short_class = suppress_short_class;
		this.minimum_class_size = (node.lines + node.sloc) / 2;
	}

	/** Responsibilities: _reporting design-shape metrics structural_. **/
	public report_design(): void {
		this.append_interface_limit();
if (this.file_name.test() || this.node.type_contract || this.node.protocol) {
			return;
		}
		this.append_mixin_violation();
		if (this.is_mixin() || this.node.extends_external_class) {
			return;
		}
		this.append_stateless_info();
		this.procedural_class_name.append_violation(this.violations, this.file_name.value, this.node);
		this.append_local_inheritance();
	}

	/** Responsibilities: _reporting class size method-count_. **/
	public report_sizes(): void {
		const metric_violations = new MetricViolations();

		if (this.file_name.test() || this.node.type_contract) {
			return;
		}
		if (this.node.protocol || this.node.extends_external_class) {
			return;
		}
		if ((!this.node.is_data_class) && (!this.suppress_short_class) && this.minimum_class_size < MIN_CLASS_LINES) {
			this.violations.push(
				metric_violations.metric_violation(this.file_name.value, this.node.start, this.minimum_class_size, 'short_class')
			);
		}
		this.append_class_sizes();
	}

	/** Responsibilities: _reporting maximum class size_. **/
	public report_max_sizes(): void {
		this.append_interface_limit();
if (this.node.type_contract || this.node.protocol || this.node.extends_external_class) {
			return;
		}
		this.append_class_sizes();
	}
}
