import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstCallableNode, AstClassNode } from 'src/types';
import { GENERIC_TYPES } from 'src/rules/typescript/constants';

/** Responsibilities: _reporting any-typed parameters output_. **/
export class AnyTypes {
	private readonly generic_types = GENERIC_TYPES;

	/** Responsibilities: _aggregation any diagnostics callable_. **/
	private append_parameter_infos(
		violations: Violation[],
		file: string,
		callable: AstCallableNode
	): void {
		let typed_arguments = callable.typed_arguments;
		if (typed_arguments === undefined) {
			typed_arguments = [];
		}
		for (const type of typed_arguments) {
			this.append_parameter_info(violations, file, callable, type.name, type.type);
		}
	}

	/** Responsibilities: _aggregation any diagnostic parameter_. **/
	private append_parameter_info(
		violations: Violation[], file: string, callable: AstCallableNode, name: string, type: string
	): void {
		const is_receiver = name === 'self' || name === 'cls' || name === '_';
		if (!this.generic_types.has(type) || is_receiver) {
			return;
		}
		const subject = `parameter "${name}"`;
		this.append_info(violations, file, callable, subject, type);
		if (!file.endsWith('.py') && type === 'unknown') {
			const rule = new DiagnosticRule('typescript-unknown-parameter-type');
			violations.push(rule.violation(file, callable.start + 1, { name }));
		}
	}

	/** Responsibilities: _aggregation any diagnostic callable_. **/
	private append_return_info(
		violations: Violation[],
		file: string,
		callable: AstCallableNode
	): void {
		const return_type = callable.return_type;
		if (!return_type) {
			return;
		}
		if (!this.generic_types.has(return_type)) {
			return;
		}
		this.append_info(violations, file, callable, 'return type', return_type);
	}

	/** Responsibilities: _aggregation normalization any diagnostic_. **/
	private append_info(
		violations: Violation[],
		file: string,
		callable: AstCallableNode,
		subject: string,
		type: string
	): void {
		const line = callable.start + 1;
		const rule = new DiagnosticRule('type-info');
		violations.push(rule.violation(file, line, { subject, type }));
	}

	/** Responsibilities: _aggregation any diagnostic class_. **/
	private append_field_info(violations: Violation[], file: string, name: string, type: string, line: number): void {
		if (!this.generic_types.has(type)) {
			return;
		}
		const rule = new DiagnosticRule('type-warning');
		violations.push(rule.violation(file, line, { subject: `field "${name}"`, type }));
	}

	/** Responsibilities: _aggregation any diagnostics callable_. **/
	public append_any_info(
		violations: Violation[],
		file: string,
		callables: AstCallableNode[],
		...class_lists: AstClassNode[][]
	): void {
		let classes: AstClassNode[] = [];
		if (class_lists[0] !== undefined) {
			classes = class_lists[0];
		}
		for (const callable of callables) {
			this.append_parameter_infos(violations, file, callable);
			this.append_return_info(violations, file, callable);
		}
		this.append_field_infos(violations, file, classes);
	}

	/** Responsibilities: _aggregation any diagnostics class_. **/
	public append_field_infos(violations: Violation[], file: string, classes: AstClassNode[]): void {
		for (const item of classes) {
			let fields = item.fields;
			if (fields === undefined) {
				fields = [];
			}
			for (const field of fields) {
				if (field.type !== undefined) {
					this.append_field_info(violations, file, field.name, field.type, field.line + 1);
				}
			}
		}
	}
}
