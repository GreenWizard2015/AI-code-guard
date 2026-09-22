import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { RuleParameters } from 'src/types';
import type { AstCallableNode, AstClassNode } from 'src/types';

/** Responsibilities: _validation constructor position public_. **/
export class MethodOrder {
	private readonly constructor_names = new Set(['constructor', '__init__']);
	private readonly hidden_visibilities = new Set(['private', 'protected']);

	/** Responsibilities: _identification public methods placed_. **/
	private public_order_violations(
		file: string,
		methods: AstCallableNode[],
		last_non_public: number
	): Violation[] {
		const violations: Violation[] = [];
		methods.forEach((method, index) => {
			if (index < last_non_public && this.is_public(method)) {
				violations.push(
					this.order_violation(file, method.start, 'method-order-public', {
						name: method.name,
					})
				);
			}
		});
		return violations;
	}

	/** Responsibilities: _last non-public method lookup_. **/
	private last_hidden_index(methods: AstCallableNode[]): number {
		let last_index = -1;
		methods.forEach((method, index) => {
			if (!this.is_public(method)) {
				last_index = index;
			}
		});
		return last_index;
	}

	/** Responsibilities: _aggregation constructor-order violations class_. **/
	private append_constructor_violations(
		violations: Violation[],
		file: string,
		methods: AstCallableNode[]
	): void {
		for (const [index, method] of methods.entries()) {
			if (!this.constructor_names.has(method.name)) {
				continue;
			}
			violations.push(...this.constructor_order_violations(file, method, methods, index));
		}
	}

	/** Responsibilities: _placement violations calculation _. **/
	private constructor_order_violations(
		file: string,
		method: AstCallableNode,
		methods: AstCallableNode[],
		index: number
	): Violation[] {
		const violations: Violation[] = [];
		const methods_after = methods.slice(index + 1);
		if (methods_after.some(item => !this.constructor_names.has(item.name) && !this.is_public(item))) {
			violations.push(this.order_violation(file, method.start, 'method-order-constructor-after'));
		}
		const methods_before = methods.slice(0, index);
		if (methods_before.some(item => !this.constructor_names.has(item.name) && this.is_public(item))) {
			violations.push(this.order_violation(file, method.start, 'method-order-constructor-before'));
		}
		return violations;
	}

	/** Responsibilities: _public method classification_. **/
	private is_public(method: AstCallableNode): boolean {
		if (this.hidden_visibilities.has(method.visibility)) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _method-order diagnostic creation_. **/
	private order_violation(
		file: string,
		line: number,
		rule_id: string,
		...parameter_values: RuleParameters[]
	): Violation {
		const reported_line = line + 1;
		const rule = new DiagnosticRule(rule_id);
		let parameters: RuleParameters = {};
		if (parameter_values[0] !== undefined) {
			parameters = parameter_values[0];
		}
		return rule.violation(file, reported_line, parameters);
	}

	/** Responsibilities: _implementation method-order violations addition_. **/
	public append_impl_order(
		violations: Violation[],
		file: string,
		methods: AstCallableNode[]
	): void {
		const implementation_methods = methods.filter(method => !this.constructor_names.has(method.name));
		const last_non_public = this.last_hidden_index(implementation_methods);
		violations.push(...this.public_order_violations(file, implementation_methods, last_non_public));
	}

	/** Responsibilities: _aggregation constructor visibility ordering_. **/
	public append_order_violations(violations: Violation[], file: string, node: AstClassNode): void {
		const methods = node.methods;
		this.append_impl_order(violations, file, methods);
		this.append_constructor_violations(violations, file, methods);
	}
}
