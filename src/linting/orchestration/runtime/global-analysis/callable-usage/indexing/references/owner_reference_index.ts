import type { CallableUsageFile } from "src/contracts/types/callable_usage_types";
import type { MethodOwnerReferences, MethodReferencesByFile, MethodReferencesByName } from "src/metrics/types";
import type { AstCallableReference } from "src/model/ast/normalized_ast_types";
import type { SourceReference } from "src/source_types";

/** Responsibilities: _method owner reference index_, _file index replacement_. **/
export class OwnerReferenceIndex {
	private readonly _files: MethodReferencesByFile;
	private readonly _by_name: MethodReferencesByName;

	/** Responsibilities: _file-local method owner groups_. **/
	private file_references(file: CallableUsageFile): MethodReferencesByName {
		const local: MethodReferencesByName = new Map();
		for (const reference of file.ast.references.call_references) {
			this.append_reference(local, reference, { file: file.file, line: reference.line });
		}
		return local;
	}

	/** Responsibilities: _owned method reference insertion_. **/
	private append_reference(
		local: MethodReferencesByName,
		reference: AstCallableReference,
		source_reference: SourceReference,
	): void {
		if (reference.kind !== "method" || reference.owner.length === 0) {
			return;
		}
		let owners = local.get(reference.name);
		if (owners === undefined) {
			owners = new Map<string, SourceReference[]>();
			local.set(reference.name, owners);
		}
		let locations = owners.get(reference.owner);
		if (locations === undefined) {
			locations = [];
			owners.set(reference.owner, locations);
		}
		locations.push(source_reference);
	}

	/** Responsibilities: _file reference group removal_. **/
	private remove_file_references(file_references: MethodReferencesByName): void {
		for (const [name, owners] of file_references) {
			for (const [owner, references] of owners) {
				this.remove_owner_references(name, owner, references);
			}
		}
	}

	/** Responsibilities: _method owner reference cleanup_. **/
	private remove_owner_references(name: string, owner: string, references: SourceReference[]): void {
		const indexed_owners = this._by_name.get(name);
		if (indexed_owners === undefined) {
			return;
		}
		this.update_owner_bucket(indexed_owners, owner, new Set(references));
		if (indexed_owners.size === 0) {
			this._by_name.delete(name);
		}
	}

	/** Responsibilities: _owner bucket cleanup_. **/
	private update_owner_bucket(
		owners: MethodOwnerReferences,
		owner: string,
		removed: ReadonlySet<SourceReference>,
	): void {
		const indexed_references = owners.get(owner);
		if (indexed_references === undefined) {
			return;
		}
		const retained = indexed_references.filter((reference) => !removed.has(reference));
		if (retained.length === 0) {
			owners.delete(owner);
		} else {
			owners.set(owner, retained);
		}
	}

	/** Responsibilities: _project method reference groups_. **/
	private append_project_references(local: MethodReferencesByName): void {
		for (const [name, owners] of local) {
			let indexed_owners = this._by_name.get(name);
			if (indexed_owners === undefined) {
				indexed_owners = new Map<string, SourceReference[]>();
				this._by_name.set(name, indexed_owners);
			}
			for (const [owner, references] of owners) {
				let indexed_references = indexed_owners.get(owner);
				if (indexed_references === undefined) {
					indexed_references = [];
					indexed_owners.set(owner, indexed_references);
				}
				indexed_references.push(...references);
			}
		}
	}

	/** Responsibilities: _method owner index initialization_. **/
	public constructor() {
		this._files = new Map();
		this._by_name = new Map();
	}

	/** Responsibilities: _file owner index replacement_. **/
	public replace_file(file: CallableUsageFile): void {
		const previous = this._files.get(file.file);
		if (previous !== undefined) {
			this.remove_file_references(previous);
			this._files.delete(file.file);
		}
		const local = this.file_references(file);
		this._files.set(file.file, local);
		this.append_project_references(local);
	}

	/** Responsibilities: _method owner reference view_. **/
	public references(): MethodReferencesByName {
		return this._by_name;
	}
}
