import { TypeScriptConstructorAssignments } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_constructor_assignments";
import type {
	TypeScriptClassFieldClassifierContract,
	TypeScriptClassFieldReadIndex,
	TypeScriptConstructorAssignmentsContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _field usage analysis_, _constructor state retention_. **/
export class TypeScriptConstructorState {
	private readonly _declaration: ts.ClassLikeDeclaration;
	private readonly _field_reads: TypeScriptClassFieldReadIndex;
	private readonly _classifier: TypeScriptClassFieldClassifierContract;
	private readonly _constructor_assignments: Map<ts.ConstructorDeclaration, TypeScriptConstructorAssignmentsContract>;

	/** Responsibilities: _owned collaborator detection_. **/
	private owns_used_collaborator(
		fields: TypeScriptClassFieldReadIndex,
		classifier: TypeScriptClassFieldClassifierContract,
	): boolean {
		for (const member of this._declaration.members) {
			if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
				continue;
			}
			if (member.initializer === undefined || !ts.isNewExpression(member.initializer)) {
				continue;
			}
			if (!fields.used_fields.has(member.name.text)) {
				continue;
			}
			const classification = classifier.field(member.name.text);
			if (!classification.data && !classification.collection) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _class constructor analysis cache_. **/
	private prepare_assignments(field_reads: TypeScriptClassFieldReadIndex): void {
		if (this._constructor_assignments.size > 0) {
			return;
		}
		for (const member of this._declaration.members) {
			if (!ts.isConstructorDeclaration(member)) {
				continue;
			}
			this._constructor_assignments.set(
				member,
				new TypeScriptConstructorAssignments(member, field_reads, this._classifier),
			);
			break;
		}
	}

	/** Responsibilities: _constructor state analysis initialization_. **/
	public constructor(
		declaration: ts.ClassLikeDeclaration,
		classifier: TypeScriptClassFieldClassifierContract,
		field_reads: TypeScriptClassFieldReadIndex,
	) {
		this._declaration = declaration;
		this._field_reads = field_reads;
		this._classifier = classifier;
		this._constructor_assignments = new Map();
	}

	/** Responsibilities: _constructor dependency retention_. **/
	public retains_dependency(): boolean {
		if (this._classifier.delegates_collection()) {
			return true;
		}
		if (this.owns_used_collaborator(this._field_reads, this._classifier)) {
			return true;
		}
		this.prepare_assignments(this._field_reads);
		for (const assignments of this._constructor_assignments.values()) {
			return assignments.retains_dependency();
		}
		return false;
	}

	/** Responsibilities: _constructor value invariant_. **/
	public retains_value_invariant(): boolean {
		this.prepare_assignments(this._field_reads);
		for (const assignments of this._constructor_assignments.values()) {
			return assignments.retains_value_invariant();
		}
		return false;
	}
}
