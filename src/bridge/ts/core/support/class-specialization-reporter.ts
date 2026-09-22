import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { AstCallableNode, AstClassNode } from 'src/types';
/** Responsibilities: _reporting callback API mixin_. **/
export class MethodSpecializationReporter {
	private readonly violations: Violation[];

	private readonly file: string;

	private readonly node: AstClassNode;

	private readonly methods: readonly AstCallableNode[];

	/** Responsibilities: _aggregation callback-field diagnostics analysis_. **/
	private append_callback_rule(): void {
		const inline_callback_fields = this.node.inline_callback_fields;
		if (inline_callback_fields === 0) {
			return;
		}
		const rule = new DiagnosticRule('class-callback-fields');
		this.violations.push(
			rule.violation(this.file, this.node.start + 1, {
				count: String(inline_callback_fields),
			})
		);
	}

	/** Responsibilities: _aggregation implementation metrics concrete_. **/
	private append_implementation_rules(methods: readonly AstCallableNode[]): void {
		const count = methods.filter(method => method.visibility !== 'public').length;
		if (count > 15) {
			const rule = new DiagnosticRule('class-method-max-count');
			this.violations.push(
					rule.violation(
					this.file,
					this.node.start + 1,
					{ count: String(count), visibility: 'non-public' }
				)
			);
		}
	}

	/** Responsibilities: _aggregation visibility method-count diagnostics_. **/
	private append_public_rules(
		methods: readonly AstCallableNode[],
		implements_interface: boolean
	): void {
		const count = methods.filter(method => method.visibility === 'public').length;
		const rule_id = this.public_method_rule(count, implements_interface);
		if (rule_id.length > 0) {
			const rule = new DiagnosticRule(rule_id);
			this.violations.push(
					rule.violation(
					this.file,
					this.node.start + 1,
					{ count: String(count), visibility: 'public' }
				)
			);
		}
	}

	/** Responsibilities: _creation configuration public-method diagnostic_. **/
	private public_method_rule(
		count: number,
		implements_interface: boolean
	): string {
		if (implements_interface && count < 2) {
			return '';
		}
		if (count < 2) {
			return 'class-method-min-count';
		}
		if (count > 15) {
			return 'class-method-max-count';
		}
		if (count > 5) {
			return 'class-method-count-info';
		}
		return '';
	}

	/** Responsibilities: _classification class participates mixin_. **/
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

	/** Responsibilities: _classification inherited class_. **/
	private has_base_type(): boolean {
if (this.node.interfaces !== undefined && this.node.interfaces.length > 0) {
			return true;
		}
if (this.node.base_class_name !== undefined && this.node.base_class_name.length > 0) {
			return true;
		}
return this.node.base_class_names !== undefined && this.node.base_class_names.length > 0;
	}

	/** Responsibilities: _initialization violation sink file_. **/
	public constructor(violations: Violation[], file: string, node: AstClassNode) {
		this.violations = violations;
		this.file = file;
		this.node = node;
		this.methods = node.methods.filter(
			method => method.name !== 'constructor' && method.name !== '__init__'
		);
	}

	/** Responsibilities: _reporting API-facing class method_. **/
	public report_api(): void {
		if (this.node.is_data_class || this.is_mixin()) {
			return;
		}
if ((this.node.type_contract || this.node.protocol) && this.methods.length === 0) {
			return;
		}
		this.append_public_rules(this.methods, this.has_base_type());
		this.append_callback_rule();
	}

	/** Responsibilities: _reporting implementation-facing class specialization_. **/
	public report_implementation(): void {
		if (this.node.is_data_class || this.is_mixin()) {
			return;
		}
		if (this.node.type_contract || this.node.protocol) {
			return;
		}
		this.append_implementation_rules(this.methods);
	}
}
