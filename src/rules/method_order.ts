import type { MethodOrderContract, ViolationContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleParameters } from "src/types";
import type { AstCallableNodeContract, AstClassNode } from "src/types";
import { CONSTRUCTOR_NAME, PYTHON_CONSTRUCTOR_NAME } from "src/metrics/constants";
import { PRIVATE_VISIBILITY, PROTECTED_VISIBILITY, RULE_IDS } from "src/constants";

/** Responsibilities: _constructor ordering checks_, _public method ordering checks_. **/
export class MethodOrder implements MethodOrderContract {
	private readonly constructor_names: Set<string>;
	private readonly hidden_visibilities: Set<string>;

	/** Responsibilities: _identification public methods placed_. **/
	private public_order_violations(
		file: string,
		methods: AstCallableNodeContract[],
		last_non_public: number,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		methods.forEach((method, index) => {
			if (index < last_non_public) {
				if (this.is_public(method)) {
					violations.push(
						this.order_violation(file, method.start, RULE_IDS.method_order_public, {
							name: method.name,
						}),
					);
				}
			}
		});
		return violations;
	}

	/** Responsibilities: _last non-public method lookup_. **/
	private last_hidden_index(methods: AstCallableNodeContract[]): number {
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
		violations: ViolationContract[],
		file: string,
		methods: AstCallableNodeContract[],
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
		method: AstCallableNodeContract,
		methods: AstCallableNodeContract[],
		index: number,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const methods_after = methods.slice(index + 1);
		if (methods_after.some((item) => !this.constructor_names.has(item.name) && !this.is_public(item))) {
			violations.push(this.order_violation(file, method.start, RULE_IDS.method_order_constructor_after));
		}
		const methods_before = methods.slice(0, index);
		if (methods_before.some((item) => !this.constructor_names.has(item.name) && this.is_public(item))) {
			violations.push(this.order_violation(file, method.start, RULE_IDS.method_order_constructor_before));
		}
		return violations;
	}

	/** Responsibilities: _public method classification_. **/
	private is_public(method: AstCallableNodeContract): boolean {
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
	): ViolationContract {
		const reported_line = line + 1;
		const rule = new DiagnosticRule(rule_id);
		let parameters: RuleParameters = {};
		if (parameter_values[0] !== undefined) {
			parameters = parameter_values[0];
		}
		return rule.violation(file, reported_line, parameters);
	}

	/** Responsibilities: _implementation method-order violations addition_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.constructor_names = new Set([CONSTRUCTOR_NAME, PYTHON_CONSTRUCTOR_NAME]);
		this.hidden_visibilities = new Set([PRIVATE_VISIBILITY, PROTECTED_VISIBILITY]);
	}
	/** Responsibilities: _public operation_. **/
	public append_impl_order(violations: ViolationContract[], file: string, methods: AstCallableNodeContract[]): void {
		const implementation_methods = methods.filter((method) => !this.constructor_names.has(method.name));
		const last_non_public = this.last_hidden_index(implementation_methods);
		violations.push(...this.public_order_violations(file, implementation_methods, last_non_public));
	}

	/** Responsibilities: _aggregation constructor visibility ordering_. **/
	public append_order_violations(violations: ViolationContract[], file: string, node: AstClassNode): void {
		const methods = node.methods;
		this.append_impl_order(violations, file, methods);
		this.append_constructor_violations(violations, file, methods);
	}
}
