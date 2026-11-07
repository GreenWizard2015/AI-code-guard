import { PYTHON_ASSIGNMENT_KIND } from "src/linting/orchestration/runtime/python/constants";
import type { PythonCollaboratorUseOptions } from "src/linting/orchestration/runtime/python/python_collaborator_types";
import type { AstCallableReference } from "src/model/ast/normalized_ast_types";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";

/** Responsibilities: _typed collaborator matching_, _construction reference scoping_. **/
export class PythonCollaboratorUse {
	private readonly _options: PythonCollaboratorUseOptions;

	/** Responsibilities: _method-local reference matching_. **/
	private in_method(reference: AstCallableReference): boolean {
		if (reference.caller_owner !== this._options.owner) {
			return false;
		}
		if (reference.line < this._options.start || reference.line > this._options.end) {
			return false;
		}
		return !reference.call_use.deferred;
	}

	/** Responsibilities: _collaborator construction matching_. **/
	private is_construction(reference: AstCallableReference): boolean {
		if (reference.kind !== MODULE_FUNCTION_KIND || reference.name !== this._options.class_name) {
			return false;
		}
		if (reference.call_use.callee_name !== this._options.local_name) {
			return false;
		}
		if (reference.call_use.assigned_name.length === 0 || reference.call_use.assigned_type_name.length === 0) {
			return false;
		}
		return this.contract_members(reference.call_use.assigned_type_name).size > 0;
	}

	/** Responsibilities: _imported protocol member lookup_. **/
	private contract_members(local_type: string): ReadonlySet<string> {
		const contract = this._options.imports.get(local_type);
		if (contract === undefined) {
			return new Set();
		}
		const members = this._options.contracts.get(`${contract.file}\u0000${contract.name}`);
		if (members === undefined) {
			return new Set();
		}
		return members;
	}

	/** Responsibilities: _collaborator replacement detection_. **/
	private overwritten(construction: AstCallableReference, usage: AstCallableReference): boolean {
		for (const statement of this._options.statements) {
			if (statement.kind !== PYTHON_ASSIGNMENT_KIND) {
				continue;
			}
			if (statement.name !== construction.call_use.assigned_name) {
				continue;
			}
			if (statement.line > construction.line && statement.line <= usage.line) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _protocol method matching_. **/
	private matches_protocol_method(
		usage: AstCallableReference,
		declaration_line: number,
		assigned_name: string,
	): boolean {
		if (usage.kind !== "method") {
			return false;
		}
		if (!usage.is_call) {
			return false;
		}
		if (usage.owner !== this._options.class_name) {
			return false;
		}
		if (usage.line <= declaration_line) {
			return false;
		}
		return usage.call_use.receiver_name === assigned_name;
	}

	/** Responsibilities: _construction usage line resolution_. **/
	private used_line(references: readonly AstCallableReference[], construction: AstCallableReference): number {
		if (!this.is_construction(construction)) {
			return -1;
		}
		for (const usage of references) {
			if (!this.matches_protocol_method(usage, construction.line, construction.call_use.assigned_name)) {
				continue;
			}
			const methods = this.contract_members(construction.call_use.assigned_type_name);
			if (!methods.has(usage.name)) {
				continue;
			}
			if (this.overwritten(construction, usage)) {
				continue;
			}
			return construction.line;
		}
		return -1;
	}

	/** Responsibilities: _collaborator match input initialization_. **/
	public constructor(options: PythonCollaboratorUseOptions) {
		this._options = options;
	}

	/** Responsibilities: _method reference collection_. **/
	public scoped_references(): AstCallableReference[] {
		return this._options.references.filter((reference) => this.in_method(reference));
	}

	/** Responsibilities: _construction reference line_. **/
	public line(references: readonly AstCallableReference[]): number {
		for (const reference of references) {
			const line = this.used_line(references, reference);
			if (line >= 0) {
				return line;
			}
		}
		return -1;
	}

	/** Responsibilities: _scoped collaborator construction line_. **/
	public violation_line(): number {
		const references = this.scoped_references();
		return this.line(references);
	}
}
