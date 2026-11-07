import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { ProjectBoundaryProjectTypes } from "src/metrics/project_boundary_project_types";
import { ProjectBoundaryTypeMembership } from "src/metrics/project_boundary_type_membership";
import { SharedParameterType } from "src/metrics/shared_parameter/shared_parameter_type";
import type {
	ProjectTypeBoundaryInput,
	ProjectTypeBoundarySource,
	SharedProjectTypeClassifierContract,
	StringNameMembershipContract,
} from "src/metrics/types";
import type { AstCallableNode, AstClassField } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";

/** Responsibilities: _parameter boundary diagnostics_, _field boundary diagnostics_. **/
export class ProjectTypeBoundary {
	private readonly _source: ProjectTypeBoundarySource;
	private readonly _rule: RuleContract;
	private readonly _allowed_types: StringNameMembershipContract;
	private readonly _type_classifier: SharedProjectTypeClassifierContract;

	/** Responsibilities: _project type rejection_. **/
	private forbidden_type(type: string): boolean {
		if (type.length === 0) {
			return false;
		}
		if (this._allowed_types.present(type)) {
			return false;
		}
		return this._type_classifier.project_reference(type);
	}

	/** Responsibilities: _field boundary eligibility_. **/
	private field_boundary_allowed(field: AstClassField): boolean {
		if (field.visibility === "private") {
			return false;
		}
		const type = field.type.trim();
		if (/^(ReadonlyMap|ReadonlySet|Map|Set|WeakMap|WeakSet)</u.test(type)) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _callable boundary violations_. **/
	private append_callable_violations(): void {
		for (const callable of this._source.callables) {
			if (this.violates(callable)) {
				this._source.violations.push(this._rule.violation(this._source.file, callable.identity.start + 1, {}));
			}
		}
	}

	/** Responsibilities: _field boundary violations_. **/
	private append_field_violations(): void {
		for (const field of this._source.fields) {
			if (!this.field_boundary_allowed(field) || !this.forbidden_type(field.type.trim())) {
				continue;
			}
			this._source.violations.push(this._rule.violation(this._source.file, field.line, {}));
		}
	}

	/** Responsibilities: _project boundary configuration_. **/
	public constructor(input: ProjectTypeBoundaryInput) {
		this._source = input.source;
		const names = input.names;
		this._allowed_types = new ProjectBoundaryTypeMembership(
			names.allowed_contracts,
			new Set(
				names.reference_aliases
					.filter((alias) => names.project_class_names.has(alias.target))
					.map((alias) => alias.name),
			),
			names.imported_contract_names,
			names.project_class_names,
			names.language === TYPESCRIPT_LANGUAGE,
		);
		this._type_classifier = new SharedParameterType(
			names.reference_aliases,
			new ProjectBoundaryProjectTypes(names.forbidden_project_types, names.imported_contract_names),
			this._allowed_types,
			names.language,
		);
		this._rule = new DiagnosticRule("project-type-boundary");
	}

	/** Responsibilities: _callable boundary classification_. **/
	public violates(callable: AstCallableNode): boolean {
		if (callable.signature.typed_arguments.some((argument) => this.forbidden_type(argument.type))) {
			return true;
		}
		return this.forbidden_type(callable.signature.return_type);
	}

	/** Responsibilities: _project boundary violations_. **/
	public append(): void {
		this.append_callable_violations();
		this.append_field_violations();
	}
}
