import type { MethodOrderContract } from "src/analysis_protocols";
import { PRIVATE_VISIBILITY, PROTECTED_VISIBILITY } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import { CONSTRUCTOR_NAME, PYTHON_CONSTRUCTOR_NAME } from "src/metrics/constants";
import type { AstCallableNode, AstClassNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _order public methods_, _place constructors_. **/
export class MethodOrder implements MethodOrderContract {
	private readonly _file: string;
	private readonly _methods: readonly AstCallableNode[];
	private readonly _constructor_names: ReadonlySet<string>;
	private readonly _hidden_visibilities: ReadonlySet<string>;
	private readonly _order_rule: RuleContract;

	/** Responsibilities: _final non-public method index_. **/
	private last_hidden_method(methods: readonly AstCallableNode[]): number {
		let last = -1;
		methods.forEach((method, index) => {
			if (this._hidden_visibilities.has(method.identity.visibility)) {
				last = index;
			}
		});
		return last;
	}

	/** Responsibilities: _constructor position validation_. **/
	private constructor_misplaced(before: readonly AstCallableNode[], after: readonly AstCallableNode[]): boolean {
		const public_before = before.some(
			(item) =>
				!this._constructor_names.has(item.identity.name) && !this._hidden_visibilities.has(item.identity.visibility),
		);
		const hidden_after = after.some(
			(item) =>
				!this._constructor_names.has(item.identity.name) && this._hidden_visibilities.has(item.identity.visibility),
		);
		return public_before || hidden_after;
	}

	/** Responsibilities: _implementation-order violation reporting_. **/
	private append_implementation_violation(violations: ViolationContract[]): boolean {
		const implementation_methods = this._methods.filter((method) => !this._constructor_names.has(method.identity.name));
		const last_hidden = this.last_hidden_method(implementation_methods);
		for (const [index, method] of implementation_methods.entries()) {
			if (index < last_hidden && !this._hidden_visibilities.has(method.identity.visibility)) {
				violations.push(this._order_rule.violation(this._file, method.identity.start + 1, {}));
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _method ordering state_. **/
	public constructor(file: string, class_node: AstClassNode) {
		this._file = file;
		this._methods = class_node.structure.methods;
		this._constructor_names = new Set([CONSTRUCTOR_NAME, PYTHON_CONSTRUCTOR_NAME]);
		this._hidden_visibilities = new Set([PRIVATE_VISIBILITY, PROTECTED_VISIBILITY]);
		this._order_rule = new DiagnosticRule(RULE_IDS.method_order);
	}

	/** Responsibilities: _class method ordering validation_. **/
	public append_order(violations: ViolationContract[]): void {
		if (this.append_implementation_violation(violations)) {
			return;
		}
		const methods = this._methods;
		for (const [index, method] of methods.entries()) {
			if (!this._constructor_names.has(method.identity.name)) {
				continue;
			}
			const before = methods.slice(0, index);
			const after = methods.slice(index + 1);
			if (this.constructor_misplaced(before, after)) {
				violations.push(this._order_rule.violation(this._file, method.identity.start + 1, {}));
				return;
			}
		}
	}
}
