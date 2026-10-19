import type { ViolationContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { ClassNode } from "src/core/support/class_node";
import type { ClassNodeInput } from "src/model/types/types";
import type { ClassNodeContract } from "src/protocols";
import type { MixCallableNode } from "src/types";
import type { LintFileNameContract } from "src/types";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _mixed-module classification_, _mixin violation aggregation_. **/
export class MixCollection {
	private readonly mixed_rule_id = RULE_IDS.mixed_module;

	/** Responsibilities: _classification class qualifies mixin_. **/
	private is_eligible_class(class_node: ClassNodeContract): boolean {
		if (class_node.type_contract()) {
			return false;
		}
		if (class_node.protocol()) {
			return false;
		}
		return !class_node.exception();
	}

	/** Responsibilities: _creation mixin violation class_. **/
	private mix_violation(file: string, class_node: ClassNodeInput, function_node: MixCallableNode): ViolationContract {
		const line = Math.min(class_node.start, function_node.start) + 1;
		const rule = new DiagnosticRule(this.mixed_rule_id);
		return rule.violation(file, line);
	}

	/** Responsibilities: _aggregation mixin violation class_. **/
	private append_mixed_class(
		violations: ViolationContract[],
		classes: readonly ClassNodeInput[],
		file: string,
		function_node: MixCallableNode,
	): void {
		for (const node of classes) {
			const class_node = new ClassNode(node);
			if (this.is_eligible_class(class_node)) {
				violations.push(this.mix_violation(file, node, function_node));
				return;
			}
		}
	}

	/** Responsibilities: _reporting module contains mixed_. **/
	public mixed_module(
		classes: readonly ClassNodeInput[],
		functions: readonly MixCallableNode[],
		file_name: LintFileNameContract,
	): boolean {
		if (file_name.test() && file_name.value.endsWith(".py")) {
			return false;
		}
		if (functions.length === 0) {
			return false;
		}
		return classes.some((node) => this.is_eligible_class(new ClassNode(node)));
	}

	/** Responsibilities: _aggregation mixin violations classes_. **/
	public append_mix_violations(
		violations: ViolationContract[],
		classes: readonly ClassNodeInput[],
		functions: readonly MixCallableNode[],
		file_name: LintFileNameContract,
	): void {
		if (!this.mixed_module(classes, functions, file_name)) {
			return;
		}
		const function_node = functions[0];
		this.append_mixed_class(violations, classes, file_name.value, function_node);
	}
}
