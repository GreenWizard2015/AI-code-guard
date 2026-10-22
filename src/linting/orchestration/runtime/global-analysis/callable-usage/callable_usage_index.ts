import { SourceReferenceIndex } from "src/core/source_reference_index";
import type {
	CallableClassIndex,
	CallableClassCandidates,
	CallableDefinition,
	CallableMatcherClassIndexes,
	CallableMatcherIndexes,
	CallableMatcherNamesByOwner,
	CallableMatcherOwnerIndexes,
	CallableProjectIndex,
	CallableTypeCandidates,
	MutableCallableReferencesByFile,
	ParsedFile,
} from "src/metrics/types";
import type { SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { AstCallableReference, AstClassNodeContract, AstTypeMemberRecord } from "src/types";
import type { CallableUsageIndexState } from "src/linting/orchestration/runtime/composition/types";

/** Responsibilities: _callable symbol indexing_, _reference data aggregation_. **/
export class CallableUsageIndex {
	private readonly type_candidates: CallableTypeCandidates;
	private readonly class_candidates: CallableClassCandidates;
	private readonly files_by_name: Map<string, ParsedFile>;
	private readonly reference_index: SourceReferenceIndexContract<string>;
	private readonly references_by_file: MutableCallableReferencesByFile;

	/** Responsibilities: _named type candidate storage_. **/
	private append_type_candidate(identity: string, members: AstTypeMemberRecord): void {
		const existing = this.type_candidates.get(identity);
		if (existing === undefined) {
			this.type_candidates.set(identity, new Set([members]));
			return;
		}
		existing.add(members);
	}

	/** Responsibilities: _named class candidate storage_. **/
	private append_class_candidate(identity: string, class_node: AstClassNodeContract): void {
		const existing = this.class_candidates.get(identity);
		if (existing === undefined) {
			this.class_candidates.set(identity, new Set([class_node]));
			return;
		}
		existing.add(class_node);
	}

	/** Responsibilities: _source-identified type index_. **/
	private type_index(): CallableProjectIndex {
		const index: CallableProjectIndex = new Map();
		for (const [identity, values] of this.type_candidates) {
			for (const value of values) {
				index.set(identity, value);
				break;
			}
		}
		return index;
	}

	/** Responsibilities: _source-identified class index_. **/
	private class_index(): CallableClassIndex {
		const index: CallableClassIndex = new Map();
		for (const [identity, values] of this.class_candidates) {
			for (const value of values) {
				index.set(identity, value);
				break;
			}
		}
		return index;
	}

	/** Responsibilities: _contract name index_. **/
	private contract_names(): Set<string> {
		const names = new Set<string>();
		for (const identity of this.type_candidates.keys()) {
			const separator = identity.lastIndexOf("::");
			if (separator >= 0) {
				names.add(identity.slice(separator + 2));
			}
		}
		return names;
	}

	/** Responsibilities: _callable matcher classes_. **/
	private matcher_classes(): CallableMatcherClassIndexes {
		const classes = new Map<string, AstClassNodeContract>();
		const protocol_names = this.contract_names();
		for (const [identity, candidates] of this.class_candidates) {
			for (const class_node of candidates) {
				classes.set(identity, class_node);
				if (class_node.protocol || class_node.type_contract) {
					protocol_names.add(class_node.name);
				}
				break;
			}
		}
		return { classes, protocol_names };
	}

	/** Responsibilities: _method owner index_. **/
	private append_method_owner(
		definition: CallableDefinition,
		methods_by_owner: CallableMatcherNamesByOwner,
		method_owner_counts: Map<string, number>,
	): void {
		if (definition.kind !== "method" || definition.node.owner === undefined) {
			return;
		}
		const owner = definition.node.owner;
		let method_names = methods_by_owner.get(owner);
		if (method_names === undefined) {
			method_names = new Set<string>();
			methods_by_owner.set(owner, method_names);
		}
		method_names.add(definition.node.name);
		const previous_count = method_owner_counts.get(owner);
		let owner_count = 1;
		if (previous_count !== undefined) {
			owner_count = previous_count + 1;
		}
		method_owner_counts.set(owner, owner_count);
	}

	/** Responsibilities: _callable matcher owners_. **/
	private matcher_owners(definitions: readonly CallableDefinition[]): CallableMatcherOwnerIndexes {
		const methods_by_owner = new Map<string, Set<string>>();
		const method_owner_counts = new Map<string, number>();
		for (const definition of definitions) {
			this.append_method_owner(definition, methods_by_owner, method_owner_counts);
		}
		return { methods_by_owner, method_owner_counts };
	}

	/** Responsibilities: _callable reference indexing_. **/
	private append_reference_data(
		file: ParsedFile,
		reference: AstCallableReference,
		references_by_name: Map<string, AstCallableReference[]>,
		seen_keys: Set<string>,
	): void {
		const reference_key = `${reference.kind}:${reference.name}`;
		let references = references_by_name.get(reference_key);
		if (references === undefined) {
			references = [];
			references_by_name.set(reference_key, references);
		}
		references.push(reference);
		const index_key = `${reference.kind}:${reference.target_file}:${reference.name}`;
		if (seen_keys.has(index_key)) {
			return;
		}
		seen_keys.add(index_key);
		this.reference_index.add_usage(index_key, { file: file.file, line: reference.line });
		this.append_owner_usage(file, reference);
	}

	/** Responsibilities: _callable owner reference indexing_. **/
	private append_owner_usage(file: ParsedFile, reference: AstCallableReference): void {
		if (reference.kind !== "method" || !reference.owner) {
			return;
		}
		const owner_key = `method-owner:${reference.owner}:${reference.name}`;
		this.reference_index.add_usage(owner_key, { file: file.file, line: reference.line });
	}

	/** Responsibilities: _callable reference indexing_. **/
	private append_callable_references(file: ParsedFile): void {
		const references_by_name = new Map<string, AstCallableReference[]>();
		const seen_keys = new Set<string>();
		for (const reference of file.ast.call_references) {
			this.append_reference_data(file, reference, references_by_name, seen_keys);
		}
		this.references_by_file.set(file.file, references_by_name);
	}

	/** Responsibilities: _callable usage index initialization_. **/
	public constructor() {
		this.type_candidates = new Map();
		this.class_candidates = new Map();
		this.files_by_name = new Map<string, ParsedFile>();
		this.reference_index = new SourceReferenceIndex<string>();
		this.references_by_file = new Map();
	}

	/** Responsibilities: _callable index state construction_. **/
	public state(definitions: readonly CallableDefinition[]): CallableUsageIndexState {
		const project_types = this.type_index();
		const class_nodes = this.class_index();
		const matcher_indexes: CallableMatcherIndexes = {
			...this.matcher_classes(),
			...this.matcher_owners(definitions),
			files_by_name: this.files_by_name,
		};
		return {
			project_types,
			class_nodes,
			matcher_indexes,
			reference_index: this.reference_index,
			references_by_file: this.references_by_file,
		};
	}

	/** Responsibilities: _callable analysis file indexing_. **/
	public append_file(file: ParsedFile): void {
		this.append_reference_file(file);
		if (file.ast.type_members !== undefined) {
			for (const [name, members] of file.ast.type_members) {
				this.append_type_candidate(`${file.file}::${name}`, members);
			}
		}
		for (const class_node of file.ast.classes) {
			this.append_class_candidate(`${file.file}::${class_node.name}`, class_node);
		}
	}

	/** Responsibilities: _callable reference-only file indexing_. **/
	public append_reference_file(file: ParsedFile): void {
		this.files_by_name.set(file.file, file);
		this.append_callable_references(file);
	}

	/** Responsibilities: _callable implementation indexing exposure_. **/
	public append_implementations(definitions: readonly CallableDefinition[]): void {
		for (const definition of definitions) {
			this.reference_index.add_implementation(`${definition.kind}:${definition.file}:${definition.node.name}`, {
				file: definition.file,
				line: definition.node.start + 1,
			});
		}
	}
}
