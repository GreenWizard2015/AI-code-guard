import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type {
	AstCallableNode,
	AstTypedArgument,
} from 'src/types';
import { SharedParameterType } from 'src/metrics/shared-parameter-type';
import type { ProjectTypeBoundaryInput } from 'src/metrics/types';

/** Responsibilities: _project boundary reporting_. **/
export class ProjectTypeBoundary {
	private readonly rule = new DiagnosticRule('project-type-boundary');
	private readonly violations: Violation[];
	private readonly file: string;
	private readonly callables: readonly AstCallableNode[];
	private readonly type_classifier: SharedParameterType;

	/** Responsibilities: _classification typed callable arguments_. **/
	private typed_arguments(callable: AstCallableNode): readonly AstTypedArgument[] {
		if (callable.typed_arguments === undefined) {
			return [];
		}
		return callable.typed_arguments;
	}

	/** Responsibilities: _classification project type boundary_. **/
	private forbidden_type(type: string): boolean {
		if (type.length === 0) {
			return false;
		}
		return this.type_classifier.project_reference(type);
	}

	/** Responsibilities: _project type boundary state_. **/
	public constructor(input: ProjectTypeBoundaryInput) {
		this.violations = input.violations;
		this.file = input.file;
		this.callables = input.callables;
		const forbidden_types = new Set(
			[...input.project_types].filter(type => !input.allowed_contracts.has(type))
		);
		this.type_classifier = new SharedParameterType(
			input.reference_aliases,
			forbidden_types,
			input.language
		);
	}

	/** Responsibilities: _classification project boundary callable_. **/
	public violates(callable: AstCallableNode): boolean {
		if (callable.owner !== '' && callable.visibility !== 'public') {
			return false;
		}
		if (this.typed_arguments(callable).some(argument => this.forbidden_type(argument.type))) {
			return true;
		}
		return this.forbidden_type(callable.return_type);
	}

	/** Responsibilities: _aggregation project boundary violations_. **/
	public append(): void {
		for (const callable of this.callables) {
			if (!this.violates(callable)) {
				continue;
			}
			this.violations.push(this.rule.violation(this.file, callable.start + 1));
		}
	}
}
