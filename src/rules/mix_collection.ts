import { ClassNode } from "src/core/support/class_node";
import type { LintFileNameContract } from "src/core/support/protocols";
import type { AstCallableNode, AstClassNode } from "src/model/ast/normalized_ast_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _mixed module classification_, _mixed module violations_. **/
export class MixCollection {
	private readonly _file_name: LintFileNameContract;
	private readonly _classes: readonly AstClassNode[];
	private readonly _functions: readonly AstCallableNode[];
	private readonly _mixed_rule: RuleContract;

	/** Responsibilities: _eligible implementation class_. **/
	private eligible_class(input: AstClassNode): boolean {
		const node = new ClassNode(input);
		if (node.type_contract()) {
			return false;
		}
		if (node.protocol()) {
			return false;
		}
		return !node.exception();
	}

	/** Responsibilities: _mixed module analysis state_. **/
	public constructor(
		file_name: LintFileNameContract,
		classes: readonly AstClassNode[],
		functions: readonly AstCallableNode[],
		mixed_rule: RuleContract,
	) {
		this._file_name = file_name;
		this._classes = classes;
		this._functions = functions;
		this._mixed_rule = mixed_rule;
	}

	/** Responsibilities: _report mixed module presence_. **/
	public mixed_module(): boolean {
		if (this._file_name.test() && this._file_name.value().endsWith(".py")) {
			return false;
		}
		if (this._functions.length === 0) {
			return false;
		}
		return this._classes.some((node) => this.eligible_class(node));
	}

	/** Responsibilities: _mixed module diagnostics_. **/
	public append_mix_violations(violations: ViolationContract[]): void {
		if (!this.mixed_module()) {
			return;
		}
		const class_node = this._classes.find((node) => this.eligible_class(node));
		const function_node = this._functions[0];
		if (class_node === undefined || function_node === undefined) {
			return;
		}
		const line = Math.min(class_node.identity.start, function_node.identity.start) + 1;
		violations.push(this._mixed_rule.violation(this._file_name.value(), line, {}));
	}
}
