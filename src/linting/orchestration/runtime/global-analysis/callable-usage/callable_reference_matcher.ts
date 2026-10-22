import type {
	CallableMatcherContext,
	CallableMatcherIndexes,
	CallableReferencesByFile,
	ParsedFile,
} from "src/metrics/types";
import type { AstCallableReference, CallableOwnershipResolver } from "src/types";
import type { SourceReference } from "src/source_types";
import type { CallableReferenceMatcherContract, SourceReferenceIndexContract } from "src/shared_services_protocols";
import { MIN_USAGE_FILES } from "src/constants";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";

/** Responsibilities: _callable reference matching_, _external target resolution_. **/
export class CallableReferenceMatcher implements CallableReferenceMatcherContract {
	private readonly context: CallableMatcherContext;
	private readonly ownership: CallableOwnershipResolver;
	private readonly definition_owner: string;
	private readonly definition_reference: string;
	private readonly reference_index: SourceReferenceIndexContract<string>;
	private readonly references_by_file: CallableReferencesByFile;
	private readonly matcher_indexes: CallableMatcherIndexes;
	private readonly candidate_files: Map<string, ParsedFile>;
	private readonly contract_reference_cache: Map<string, readonly SourceReference[]>;

	/** Responsibilities: _classification function reference_. **/
	private matches_function(reference: AstCallableReference): boolean {
		let target_file = reference.target_file;
		if (target_file === undefined) {
			target_file = "";
		}
		if (target_file.length > 0 && target_file !== this.context.definition.file) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _classification method reference_. **/
	private matches_method(reference: AstCallableReference, method_count: number): boolean {
		if (reference.dynamic) {
			if (this.context.is_python) {
				return true;
			}
			return method_count === 1;
		}
		return this.matches_owned_method(reference, method_count);
	}

	/** Responsibilities: _classification reference matches requested_. **/
	private matches_reference(reference: AstCallableReference, method_count: number): boolean {
		const { definition } = this.context;
		if (definition.kind !== reference.kind || definition.node.name !== reference.name) {
			return false;
		}
		if (this.context.definition.kind === MODULE_FUNCTION_KIND) {
			return this.matches_function(reference);
		}
		return this.matches_method(reference, method_count);
	}

	/** Responsibilities: _known method reference matching_. **/
	private matches_same_owner(reference: AstCallableReference, owner: string): boolean {
		if (owner === this.definition_owner) {
			if (!this.external_target(reference)) {
				return true;
			}
			const owner_count = this.matcher_indexes.method_owner_counts.get(owner);
			if (owner_count === undefined) {
				return true;
			}
			return owner_count <= 1;
		}
		return false;
	}

	/** Responsibilities: _different method owner matching_. **/
	private matches_different_owner(reference: AstCallableReference, method_count: number): boolean {
		const owner = reference.owner;
		if (this.external_target(reference)) {
			return false;
		}
		if (this.matches_definition_class(owner, reference.name)) {
			return true;
		}
		const owner_methods = this.matcher_indexes.methods_by_owner.get(owner);
		if (owner_methods !== undefined) {
			return !owner_methods.has(reference.name);
		}
		return method_count === 1;
	}

	/** Responsibilities: _known method reference matching_. **/
	private matches_owned_method(reference: AstCallableReference, method_count: number): boolean {
		const owner = reference.owner;
		if (this.matcher_indexes.protocol_names.has(owner)) {
			return true;
		}
		if (owner.length === 0) {
			return method_count === 1;
		}
		if (this.matches_same_owner(reference, owner)) {
			return true;
		}
		return this.matches_different_owner(reference, method_count);
	}

	/** Responsibilities: _external callable target detection_. **/
	private external_target(reference: AstCallableReference): boolean {
		const target_file = reference.target_file;
		if (target_file.length === 0) {
			return false;
		}
		return target_file !== this.context.definition.file;
	}

	/** Responsibilities: _classification definition class contains_. **/
	private matches_definition_class(owner: string, method_name: string): boolean {
		const class_node = this.matcher_indexes.classes.get(`${this.context.definition.file}::${this.definition_owner}`);
		if (class_node !== undefined) {
			return this.ownership({
				class_node,
				owner,
				method_name,
				source_file: this.context.definition.file,
			});
		}
		return false;
	}

	/** Responsibilities: _selection parsing files containing_. **/
	private reference_candidates(): readonly ParsedFile[] {
		const definition = this.context.definition;
		const definition_kind = definition.kind;
		const definition_name = definition.node.name;
		const exact = this.reference_index.references_for(
			`${definition_kind}:${definition.file}:${definition_name}`,
			"usage",
		);
		if (definition_kind === MODULE_FUNCTION_KIND) {
			return this.reference_files(exact);
		}
		const unresolved = this.reference_index.references_for(`${definition_kind}::${definition_name}`, "usage");
		return this.reference_files([...exact, ...unresolved, ...this.contract_references(definition_name)]);
	}

	/** Responsibilities: _contract-dispatched method reference lookup_. **/
	private contract_references(method_name: string): readonly SourceReference[] {
		const cached = this.contract_reference_cache.get(method_name);
		if (cached !== undefined) {
			return cached;
		}
		const references: SourceReference[] = [];
		for (const contract_name of this.matcher_indexes.protocol_names) {
			references.push(...this.reference_index.references_for(`method-owner:${contract_name}:${method_name}`, "usage"));
		}
		this.contract_reference_cache.set(method_name, references);
		return references;
	}

	/** Responsibilities: _source reference file resolution_. **/
	private reference_files(references: readonly SourceReference[]): readonly ParsedFile[] {
		this.candidate_files.clear();
		for (const reference of references) {
			const file = this.matcher_indexes.files_by_name.get(reference.file);
			if (file !== undefined) {
				this.candidate_files.set(file.file, file);
			}
		}
		return [...this.candidate_files.values()];
	}

	/** Responsibilities: _file callable references_. **/
	private file_reference_values(file: ParsedFile): readonly AstCallableReference[] {
		const references_by_name = this.references_by_file.get(file.file);
		if (references_by_name === undefined) {
			return [];
		}
		const references = references_by_name.get(this.definition_reference);
		if (references === undefined) {
			return [];
		}
		return references;
	}

	/** Responsibilities: _initialization parsing files ownership_. **/
	public constructor(context: CallableMatcherContext) {
		this.candidate_files = new Map<string, ParsedFile>();
		this.context = context;
		this.definition_owner = context.definition.node.owner;
		this.definition_reference = `${context.definition.kind}:${context.definition.node.name}`;
		this.ownership = context.ownership;
		this.reference_index = context.reference_index;
		this.references_by_file = context.references_by_file;
		this.matcher_indexes = context.matcher_indexes;
		this.contract_reference_cache = new Map<string, readonly SourceReference[]>();
	}

	/** Responsibilities: _classification file references requested_. **/
	public file_references(file: ParsedFile, method_count: number): boolean {
		const references = this.file_reference_values(file);
		for (const reference of references) {
			if (this.matches_reference(reference, method_count)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _collection external files reference_. **/
	public external_files(
		excluded_file: string,
		method_count: number,
		candidate_files: ReadonlySet<string>,
	): Set<string> {
		const external_files = new Set<string>();
		for (const file of this.reference_candidates()) {
			if (file.file === excluded_file) {
				continue;
			}
			if (!candidate_files.has(file.file)) {
				continue;
			}
			if (this.file_references(file, method_count)) {
				external_files.add(file.file);
				if (external_files.size >= MIN_USAGE_FILES) {
					return external_files;
				}
			}
		}
		return external_files;
	}
}
