import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { AstCallableNodeContract, AstClassField, AstTypedArgument } from "src/types";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { ProjectBoundaryTypeMembership } from "src/metrics/project-boundary/project_boundary_type_membership";
import { ProjectBoundaryProjectTypes } from "src/metrics/project-boundary/project_boundary_project_types";
import { SharedParameterType } from "src/metrics/shared_parameter_type";
import type {
	ProjectTypeBoundaryInput,
	ProjectTypeBoundaryNames,
	ProjectTypeBoundaryState,
	SharedProjectTypeClassifierContract,
	StringNameMembershipContract,
} from "src/metrics/types";
import { CONTRACT_SUFFIX, RESOLVER_SUFFIX } from "src/metrics/constants";

/** Responsibilities: _parameter boundary diagnostics_, _field boundary diagnostics_. **/
export class ProjectTypeBoundary {
	private readonly rule: RuleContract;
	private readonly violations: ViolationContract[];
	private readonly file: string;
	private readonly callables: readonly AstCallableNodeContract[];
	private readonly fields: readonly AstClassField[];
	private readonly names: ProjectTypeBoundaryNames;

	/** Responsibilities: _allowed boundary type membership_. **/
	private allowed_types_for(): StringNameMembershipContract {
		const concrete_aliases = new Set(
			this.names.reference_aliases
				.filter((alias) => this.names.project_class_names.has(alias.target))
				.map((alias) => alias.name),
		);
		return new ProjectBoundaryTypeMembership(
			this.names.allowed_contracts,
			concrete_aliases,
			this.names.imported_contract_names,
			this.names.project_class_names,
			this.names.language === TYPESCRIPT_LANGUAGE,
		);
	}

	/** Responsibilities: _project boundary type classifier_. **/
	private type_classifier_for(allowed_types: StringNameMembershipContract): SharedProjectTypeClassifierContract {
		return new SharedParameterType(
			this.names.reference_aliases,
			new ProjectBoundaryProjectTypes(
				this.names.forbidden_project_types,
				this.names.imported_contract_names,
			),
			this.names.language,
			allowed_types,
		);
	}

	/** Responsibilities: _classification typed callable arguments_. **/
	private typed_arguments(callable: AstCallableNodeContract): readonly AstTypedArgument[] {
		if (callable.typed_arguments === undefined) {
			return [];
		}
		return callable.typed_arguments;
	}

	/** Responsibilities: _allowed boundary type classification_. **/
	private exempt_type(type: string, state: ProjectTypeBoundaryState): boolean {
		if (type.endsWith(CONTRACT_SUFFIX)) {
			return true;
		}
		return state.allowed_types.present(type);
	}

	/** Responsibilities: _classification project type boundary_. **/
	private forbidden_type(type: string, state: ProjectTypeBoundaryState): boolean {
		if (type.length === 0) {
			return false;
		}
		if (this.exempt_type(type, state)) {
			return false;
		}
		return state.type_classifier.project_reference(type);
	}

	/** Responsibilities: _field boundary eligibility_. **/
	private field_boundary_allowed(field: AstClassField, state: ProjectTypeBoundaryState): boolean {
		if (field.visibility === "private") {
			return false;
		}
		const type = field.type.trim();
		if (this.exempt_type(type, state)) {
			return false;
		}
		if (/^(ReadonlyMap|ReadonlySet|Map|Set|WeakMap|WeakSet)</u.test(type)) {
			return false;
		}
		return !type.includes(RESOLVER_SUFFIX);
	}

	/** Responsibilities: _callable boundary violations_. **/
	private append_callable_violations(state: ProjectTypeBoundaryState): void {
		for (const callable of this.callables) {
			if (this.violates(callable, state)) {
				this.violations.push(this.rule.violation(this.file, callable.start + 1, {}));
			}
		}
	}

	/** Responsibilities: _field boundary violations_. **/
	private append_field_violations(state: ProjectTypeBoundaryState): void {
		for (const field of this.fields) {
			if (!this.field_boundary_allowed(field, state) || !this.forbidden_type(field.type.trim(), state)) {
				continue;
			}
			this.violations.push(this.rule.violation(this.file, field.line + 1, {}));
		}
	}

	/** Responsibilities: _project type boundary state_. **/
	public constructor(input: ProjectTypeBoundaryInput) {
		this.rule = new DiagnosticRule("project-type-boundary");
		this.violations = input.source.violations;
		this.file = input.source.file;
		this.callables = input.source.callables;
		this.fields = input.source.fields;
		this.names = input.names;
	}

	/** Responsibilities: _classification project boundary callable_. **/
	public violates(callable: AstCallableNodeContract, state: ProjectTypeBoundaryState): boolean {
		if (this.typed_arguments(callable).some((argument) => this.forbidden_type(argument.type, state))) {
			return true;
		}
		return this.forbidden_type(callable.return_type, state);
	}

	/** Responsibilities: _aggregation project boundary violations_. **/
	public append(): void {
		const allowed_types = this.allowed_types_for();
		const state = { allowed_types, type_classifier: this.type_classifier_for(allowed_types) };
		this.append_callable_violations(state);
		this.append_field_violations(state);
	}
}
