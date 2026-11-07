import type {
	CallableMatcherContext,
	CallableMatcherIndexes,
	ParsedFilesByName,
	SharedCallableKind,
} from "src/metrics/types";
import type { AstCallableIdentity, AstCallableReference, AstClassNode } from "src/model/ast/normalized_ast_types";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";

/** Responsibilities: _callable reference matching_, _external target detection_. **/
export class CallableReferenceMatch {
	private readonly _context: CallableMatcherContext;
	private readonly _matcher_indexes: CallableMatcherIndexes;
	private readonly _production_file_index: ParsedFilesByName;
	private readonly _definition_file: string;
	private readonly _definition_name: string;
	private readonly _definition_kind: SharedCallableKind;
	private readonly _definition_identity: AstCallableIdentity;
	private readonly _reference: AstCallableReference;
	private readonly _method_count: number;
	private readonly _source_file: string;
	private readonly _definition_owner: string;

	/** Responsibilities: _dynamic method reference classification_. **/
	private matches_method(): boolean {
		if (this._reference.dynamic) {
			if (this._context.callable.is_python) {
				return true;
			}
			return this._method_count === 1;
		}
		return this.matches_owned_method();
	}

	/** Responsibilities: _same owner method reference_. **/
	private matches_same_owner(): boolean {
		if (this._reference.owner !== this._definition_owner) {
			return false;
		}
		return this.matches_definition_class();
	}

	/** Responsibilities: _different owner method reference_. **/
	private matches_different_owner(): boolean {
		if (this.matches_definition_class()) {
			return true;
		}
		const owner_methods = this._matcher_indexes.methods_by_owner.get(this._reference.owner);
		if (owner_methods !== undefined) {
			return !owner_methods.has(this._reference.name);
		}
		return this._method_count === 1;
	}

	/** Responsibilities: _owned method reference classification_. **/
	private matches_owned_method(): boolean {
		const owner = this._reference.owner;
		if (this._matcher_indexes.protocol_names.has(owner)) {
			if (owner !== this._definition_owner || this.matches_definition_class()) {
				return true;
			}
		}
		if (owner.length === 0) {
			return this._method_count === 1;
		}
		return this.matches_same_owner() || this.matches_different_owner();
	}

	/** Responsibilities: _definition class ownership_. **/
	private matches_definition_class(): boolean {
		const class_node = this._matcher_indexes.classes.get(`${this._definition_file}::${this._definition_owner}`);
		if (class_node === undefined) {
			return false;
		}
		if (this.unlinked_contract_reference(class_node)) {
			return false;
		}
		return this._context.references.ownership({
			class_node,
			owner: this._reference.owner,
			method_name: this._reference.name,
			definition_file: this._definition_file,
			source_file: this._source_file,
		});
	}

	/** Responsibilities: _unlinked contract detection_. **/
	private unlinked_contract_reference(class_node: AstClassNode): boolean {
		if (this._reference.owner !== this._definition_owner) {
			return false;
		}
		if (this._reference.target_file.length === 0 || this._reference.target_file === this._definition_file) {
			return false;
		}
		if (class_node.structure.interfaces.includes(this._reference.owner)) {
			return false;
		}
		return !this.imports_contract();
	}

	/** Responsibilities: _implementation contract import lookup_. **/
	private imports_contract(): boolean {
		if (!this._matcher_indexes.protocol_names.has(this._reference.owner)) {
			return false;
		}
		const source = this._production_file_index.get(this._definition_file);
		if (source === undefined) {
			return false;
		}
		const target = this._production_file_index.get(this._reference.target_file);
		if (target === undefined) {
			return false;
		}
		return source.imports.has(target.absolute_file);
	}

	/** Responsibilities: _callable reference match initialization_. **/
	public constructor(
		context: CallableMatcherContext,
		reference: AstCallableReference,
		method_count: number,
		source_file: string,
	) {
		const definition = context.callable.definition;
		const definition_node = definition.node;
		this._context = context;
		this._matcher_indexes = context.project.matcher_indexes;
		this._production_file_index = context.source.production_file_index;
		this._definition_file = definition.file;
		this._definition_identity = definition_node.identity;
		this._definition_name = this._definition_identity.name;
		this._definition_kind = definition.kind;
		this._reference = reference;
		this._method_count = method_count;
		this._source_file = source_file;
		this._definition_owner = this._definition_identity.owner;
	}

	/** Responsibilities: _external callable target classification_. **/
	public external_target(): boolean {
		const target_file = this._reference.target_file;
		if (target_file === undefined || target_file.length === 0) {
			return false;
		}
		if (this.imports_contract()) {
			return false;
		}
		if (target_file === this._definition_file) {
			return false;
		}
		if (this._definition_kind === "method" && this.matches_definition_class()) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _callable reference matching decision_. **/
	public matches(): boolean {
		if (this._definition_kind !== this._reference.kind) {
			return false;
		}
		if (this._definition_name !== this._reference.name) {
			return false;
		}
		if (this.external_target()) {
			return false;
		}
		if (this._definition_kind === MODULE_FUNCTION_KIND) {
			return !this.external_target();
		}
		return this.matches_method();
	}
}
