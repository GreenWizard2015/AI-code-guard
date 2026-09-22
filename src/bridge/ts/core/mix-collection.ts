import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { ClassNode } from 'src/bridge/ts/core/support/class-node';
import type { ClassNodeInput } from 'src/bridge/ts/core/support/types';
import type { MixCallableNode } from 'src/bridge/ts/core/types';
import type { LintFileNameContract } from 'src/types';

/** Responsibilities: _detection mixed classes aggregation_. **/
export class MixCollection {
	private readonly mixed_rule_id = 'mixed-module';

	/** Responsibilities: _classification class qualifies mixin_. **/
	private is_eligible_class(class_node: ClassNode): boolean {
		if (class_node.type_contract || class_node.protocol) {
			return false;
		}
		return !class_node.exception();
	}

	/** Responsibilities: _creation mixin violation class_. **/
	private mix_violation(
		file: string,
		class_node: ClassNode,
		function_node: MixCallableNode
	): Violation {
		const line = Math.min(class_node.start, function_node.start) + 1;
		const rule = new DiagnosticRule(this.mixed_rule_id);
		return rule.violation(file, line);
	}

	/** Responsibilities: _aggregation mixin violation class_. **/
	private append_mixed_class(
		violations: Violation[],
		classes: readonly ClassNodeInput[],
		file: string,
		function_node: MixCallableNode
	): void {
		for (const node of classes) {
			const class_node = new ClassNode(node);
			if (this.is_eligible_class(class_node)) {
				violations.push(this.mix_violation(file, class_node, function_node));
				return;
			}
		}
	}

	/** Responsibilities: _reporting module contains mixed_. **/
	public mixed_module(
		classes: readonly ClassNodeInput[],
		functions: readonly MixCallableNode[],
		file_name: LintFileNameContract
	): boolean {
		if (file_name.test_py()) {
			return false;
		}
		if (functions.length === 0) {
			return false;
		}
		return classes.some(node => this.is_eligible_class(new ClassNode(node)));
	}

	/** Responsibilities: _aggregation mixin violations classes_. **/
	public append_mix_violations(
		violations: Violation[],
		classes: readonly ClassNodeInput[],
		functions: readonly MixCallableNode[],
		file_name: LintFileNameContract
	): void {
		if (!this.mixed_module(classes, functions, file_name)) {
			return;
		}
		const function_node = functions[0];
		this.append_mixed_class(violations, classes, file_name.value, function_node);
	}
}
